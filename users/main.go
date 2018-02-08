package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"github.com/rs/cors"
)

type User struct {
	Id   int
	Name string
}

// TODO: split the image service out into a separate microservice

/* environment variables:
   DB_HOST: localhost
   DB_PORT: 5432
   DB_USER: postgres
   DB_PASSWORD: your-password
   DB_NAME: mobycounter
*/

func connect() (*sql.DB, error) {
	psqlInfo := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"),
	)
	return sql.Open("postgres", psqlInfo)
}

func LoginUser(w http.ResponseWriter, r *http.Request) {
	// login method just returns an id for a user for now
	// it creates a new one for the user if there isn't one.
	// TODO add authentication
	var u User
	// POST {"Name": "fishbadger"}
	//
	// returns {"Id": 123, "Name": "fishbadger"}
	err := json.NewDecoder(r.Body).Decode(&u)
	if err != nil {
		panic(err)
	}

	db, err := connect()
	if err != nil {
		panic(err)
	}
	var id int
	err = db.QueryRow(
		`SELECT id FROM users WHERE username=$1`,
		u.Name,
	).Scan(&id)

	if id == 0 {
		// there was no such user, create one!
		err = db.QueryRow(
			`INSERT INTO users (username) VALUES ($1) RETURNING id`,
			u.Name,
		).Scan(&id)
		if err != nil {
			panic(err)
		}
		u.Id = id
	}

	if err != nil {
		panic(err)
	}
	json.NewEncoder(w).Encode(&User{Id: id, Name: u.Name})
}

const DEFAULT_IMAGE = "default.png"

/* environment variables:
   IMAGE_STORE: path to writeable filesystem where we should store images
*/
func GetImageForUser(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userId := params["id"]

	db, err := connect()
	if err != nil {
		panic(err)
	}

	// lookup username based on id to fetch image
	var username string
	err = db.QueryRow(
		`SELECT username FROM users WHERE id=$1`, userId,
	).Scan(&username)
	if err != nil {
		panic(err)
	}

	filename := getImageFilename(username)
	if _, err := os.Stat(
		os.Getenv("IMAGE_STORE") + "/" + filename,
	); os.IsNotExist(err) {
		filename = DEFAULT_IMAGE
	}
	// TODO support more image types
	w.Header().Set("Content-Type", "image/png")

	f, err := os.Open(os.Getenv("IMAGE_STORE") + "/" + filename)
	if err != nil {
		panic(err)
	}

	_, err = io.Copy(w, f)
	if err != nil {
		panic(err)
	}
}

func SetImageForUser(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userId := params["id"]

	db, err := connect()
	if err != nil {
		panic(err)
	}

	// lookup username based on id to fetch image
	var username string
	err = db.QueryRow(
		`SELECT username FROM users WHERE id=$1`, userId,
	).Scan(&username)
	if err != nil {
		panic(err)
	}

	r.ParseMultipartForm(32 << 20)
	file, _, err := r.FormFile("uploadfile")
	if err != nil {
		fmt.Println(err)
		return
	}
	defer file.Close()

	f, err := os.OpenFile(
		os.Getenv("IMAGE_STORE")+"/"+getImageFilename(username),
		os.O_WRONLY|os.O_CREATE,
		0666,
	)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer f.Close()
	io.Copy(f, file)

	http.Redirect(w, r, fmt.Sprintf("/?user=%s", userId), 301)
}

func getImageFilename(username string) string {
	if username == "" {
		// not logged in
		return DEFAULT_IMAGE
	} else {
		return fmt.Sprintf("%s.png", username)
	}
}

func main() {
	db, err := connect()
	if err != nil {
		// TODO retry
		panic(err)
	}
	defer db.Close()

	// TODO use a schema migrations library.
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS users (
	  id SERIAL PRIMARY KEY,
	  username TEXT UNIQUE NOT NULL
	);`)
	if err != nil {
		panic(err)
	}
	log.Println("Initialized users table if it didn't exist.")

	// copy the default image into the image store
	if _, err := os.Stat(os.Getenv("IMAGE_STORE") + "/" + DEFAULT_IMAGE); os.IsNotExist(err) {
		exec.Command("cp", "/go/src/app/"+DEFAULT_IMAGE, os.Getenv("IMAGE_STORE")+"/"+DEFAULT_IMAGE).Run()
	}

	router := mux.NewRouter()

	// Login (or register)
	router.HandleFunc("/login", LoginUser).Methods("POST")

	// Images
	router.HandleFunc("/users/{id}/image", GetImageForUser).Methods("GET")
	router.HandleFunc("/users/{id}/image", SetImageForUser).Methods("POST")

	// TODO implement
	//router.HandleFunc("/users/{id}", GetUser).Methods("GET")
	//router.HandleFunc("/users", GetUsers).Methods("GET")
	//router.HandleFunc("/users/{id}", DeleteUser).Methods("DELETE")

	handler := cors.Default().Handler(router)
	log.Fatal(http.ListenAndServe(":8000", handler))
}
