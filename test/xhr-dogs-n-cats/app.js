#!/usr/local/bin/node
var express = require('express');
 var isocode = require('../../connect-isocode');

var app = express();

app.use('/assets', express.static(__dirname + '/assets', { maxAge: 5 }));
app.use('/api', express.static(__dirname + '/api', { maxAge: 5 }));

app.use(isocode('phantom'));

app.get(/^index|^\//, function(req, res) {

    res.sendfile(__dirname + '/index.html');
});

app.listen(3020);
