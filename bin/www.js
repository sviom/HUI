#!/usr/bin/env node
var debug = require('debug')('my-application');
var http = require('http');
var app = require('../app');

const port = 3000; //process.env.PORT || 8080;
app.set('port', port);

var server = http.createServer(app);

server.listen(app.get('port'),function(){
    console.log("Server listening on port 8080.");
});

// var server = app.listen(app.get('port'), function() {
//   debug('Express server listening on port ' + server.address().port);
// });

var chatServer = require('../lib/chat_server');

chatServer.listen(server);