var express = require('express');
var proxy = require('http-proxy-middleware');
var concat = require('concat-stream')
var bodyParser = require('body-parser');
var ecstatic = require('ecstatic')
var redis = require('redis')

module.exports = function(opts){

  console.log('using redis server')

  var port = opts.redis_port || process.env.USE_REDIS_PORT || 6379
  var host = opts.redis_host || process.env.USE_REDIS_HOST || 'redis'

  var connectionStatus = false
  var client = null

  var app = express()
  //app.use(bodyParser.raw())

  function getRedisClient() {
    connectionStatus = false

    client = redis.createClient(port, host, {
      socket_keepalive: true,
      enable_offline_queue: false,
      retry_strategy: function (options) {
        // retry connection after 1 second
        return 1000;
      }
    })

    client.on('error', function(err){
      connectionStatus = false
      console.log('Error from the redis connection:')
      console.log(err)
    })
    client.on('end', function(err){
      connectionStatus = false
      console.log('Lost connection to Redis server')
    })
    client.on('ready', function(err){
      connectionStatus = true
      console.log('Connection made to the Redis server')
    })
  }
  console.log('-------------------------------------------');
  console.log('have host: ' + host)
  console.log('have port: ' + port)

  var fileServer = ecstatic({ root: __dirname + '/client' })


  app.get('/v1/ping', function(req, res){
    if(!connectionStatus || !client) {
      getRedisClient()
    }
    res.setHeader('Content-type', 'application/json')
    res.end(JSON.stringify({
      connected:connectionStatus
    }))
  })

  app.get('/v1/whales', function (req, res) {
    client.lrange('whales', 0, -1, function(err, data){
      res.json(data)
    })
  })

  app.post('/v1/whales', function (req, res) {
    req.pipe(concat(function(data){
      data = data.toString()
      client.rpush('whales', data, function(){
        client.save(function(){
          res.end('ok')  
        })
      })
    }))
  })



  app.use(proxy('/users', {target: 'http://users:8000', changeOrigin: true}))
  app.use(proxy('/login', {target: 'http://users:8000', changeOrigin: true}))

  app.use(fileServer)

  return app
}
