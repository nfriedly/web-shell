#! /usr/bin/env node

var http = require('http'),
    cp = require('child_process'),
    fs = require('fs'),
    index = fs.readFileSync(__dirname + '/public/index.html');


// Send index.html to all requests
var app = http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
    res.end(index);
});

// Socket.io server listens to our app
var io = require('socket.io').listen(app);

// handle connections
io.sockets.on('connection', function(socket) {
    socket.emit('stdout', {line:'connected!'});
    socket.on('error', console.error);
    socket.on('kill', function(data) {
        if (socket.ps) {
            socket.ps.kill();
        }
    });
    socket.on('stdin', function(data) {
        console.log(data);
        socket.emit('stdin', {line: data.line});

        // if there's already a running process, send stdin to it
        if (socket.ps) {
            return socket.ps.stdin.write(data.line + "\n");
        }

        // otherwise start a process
        var args = data.line.split(' ');
        var cmd = args.shift();
        console.log("executing %s with %s", cmd, args);
        var ps = cp.spawn(cmd, args);
        socket.ps = ps;

        ps.stdout.on('data', function (stdout) {
            socket.emit('stdout', {line: stdout.toString()});
        });

        ps.stderr.on('data', function (stderr) {
            socket.emit('stderr', {line: stderr.toString()});
        });

        ps.on('error', function(err) {
            socket.ps = null;
            socket.emit('stderr', {line: err.stack});
        });

        ps.on('close', function (code) {
            socket.ps = null;
            socket.emit('close', {code: code})
        });
        /*
        cp.exec(data.line, function(err, stdout, stderr) {
            if (err) {
                socket.emit('stderr', {line: err.stack});
            }
            if (stdout) {
                socket.emit('stdout', {line: stdout});
            }
            if (stderr) {
                socket.emit('stderr', {line: stderr});
            }
        });
        */
    });
});

var port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;

app.listen(port, function() {
    console.log('web shell listening on ' + port);
});
