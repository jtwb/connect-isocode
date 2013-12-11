#!/usr/local/bin/node
var express = require('express');
var isocode = require('../../connect-isocode');

var app = express();

app.use(isocode('phantom'));

app.get(/.*/, function(req, res) {

    res.sendfile(__dirname + '/index.html');
});

app.listen(3141);

