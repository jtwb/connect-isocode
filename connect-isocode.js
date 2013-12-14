/*
 * connect-isocode
 *
 * Filter the response by evaluating the page in a headless browser
 *  or browser emulator.
 * Makes Javascript apps accessible to no-js clients.
 *
 * TODO auto-insert isocode.js script tag?
 */
var cproc = require('child_process');


var DEBUG = !!process.env['DEBUG_ISO'];

function error(source) {
  return function(error) {
    console.error('Connect-Isocode | Error (' +source+ ') ' + error);
  };
};



module.exports = function isocode(driver) {

  var driver = driver || 'phantomjs';

  /*
   * Wrap res.end, res.write to filter the output stream.
   * See http://www.senchalabs.org/connect/compress.html
   */
  return function(req, res, next) {
    var nativeMethods = {
      setHeader:    res.setHeader,
      write:        res.write,
      writeHead:    res.writeHead,
      writeHeader:  res.writeHeader,
      end:          res.end
    };

    var override = {
      setHeader: function(name, value) {
        if (name.toLowerCase() == 'content-length') { return; }
        nativeMethods.setHeader.apply(res, arguments);
      }
    };

    var buffer = [];
    var userMethodCallQueue = [];

    var context = [
      '--',
      '-',
      req.connection.server.address().port,
      req.url
    ];

    var filter = cproc.spawn('isocode', ['--driver=' + driver].concat(context));

    filter.on(        'error', error('child process'));
    filter.stderr.on( 'error', error('stderr'));
    filter.stdout.on( 'error', error('stdout'));
    filter.stdin.on(  'error', error('stdin'));


    var queueMethodCalls = function(method) {
      return function() {
        var call = [method].concat(Array.prototype.slice.apply(arguments));
        DEBUG && console.log('user:' + method, arguments);
        userMethodCallQueue.push(call);
      };
    };

    var restoreNativeMethods = function() {
      var name;
      for (name in nativeMethods) {
        res[name] = nativeMethods[name];
      }
    };

    var drainUserMethodQueue = function() {
      var q = userMethodCallQueue;
      var call;
      while (call = q.shift()) {
        var method = call.shift();
        if (method in override) {
          DEBUG && console.log('override:' + method, call);
          override[method].apply(this, call);
        } else {
          DEBUG && console.log('apply:' + method, call);
          nativeMethods[method].apply(res, call);
        }
      }
    };

    filter.stderr.on('data', function (data) {
      console.error('Connect-Isocode | STDERR> ', '' + data);
    });

    filter.stdout.on('data', function (chunk) {
      DEBUG && console.log('Connect-Isocode | STDOUT>', chunk.toString());
      buffer.push(chunk);
    });

    filter.on('close', function(code) {
      var content;
      DEBUG && console.log('isocode:close', arguments);
      restoreNativeMethods();

      if (code) {
        res.statusCode = 500;
        console.error('Isocode sent status code 500. Headless browser absent or unable to process page.');
        return res.end('{ error: "success" }');
      }

      drainUserMethodQueue();

      content = buffer.join('');
      DEBUG && console.log(content);
      res.setHeader('Content-Length', content.length);
      res.end(content);
    });



    res.setHeader   = queueMethodCalls('setHeader');
    res.writeHead   = queueMethodCalls('writeHead');
    res.writeHeader = queueMethodCalls('writeHeader');

    // res.write = filter.stdin.write;
    res.write = function() {
      DEBUG && console.log('user:write', arguments, arguments[0].toString());
      filter.stdin.write.apply(filter.stdin, arguments);
    };

    // res.end = filter.stdin.end;
    res.end = function() {
      DEBUG && console.log('user:end', arguments);
      filter.stdin.end.apply(filter.stdin, arguments);
    };

    next();
  };
};
