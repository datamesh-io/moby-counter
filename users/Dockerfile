FROM golang:1.8

WORKDIR /go/src/app
COPY . .

# TODO use vendoring
RUN go get -d -v ./...
RUN go install -v ./...

CMD ["app"]
