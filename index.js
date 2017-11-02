var http = require('http')
var args = require('minimist')(process.argv, {
  alias:{
    p:'port',
    r:'redis_host',
    v:'verbose'
  },
  default:{
    port:80
  },
  boolean:['verbose']
})

var PostgresServer = require('./server-postgres')
var server = http.createServer(PostgresServer(args))

server.listen(args.port, function(){
  console.log('server listening on port: ' + args.port)
})

process.on('SIGTERM', function () {
  server.close(function () {
    process.exit(0)
  })
})