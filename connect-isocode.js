/*
 * connect-isocode
 *
 * Evaluate the page in a headless browser or browser emulator and respond with the result.
 * Makes Javascript apps accessible to no-js clients.
 *
 * TODO auto-insert isocode.js script tag?
 *
 * * On incoming request,
 *     Send request to isocode
 *       via command-line args e.g. --header="Host: example.com" --header="User-Agent: a...."
 *       including the callback port (localhost:8080 etc)
 *     Respond with result
 *
 * * Isocode will replay the user's request
 *     with the X-Isocode: Bypass header
 *
 * * Skip Isocode processing when
 *   1
 *   X-Isocode: Bypass header
 *
 *   2
 *   req.url matches options.exclude regex list (e.g. /^api/)
 *
 *   3
 *   User-Agent does not match "SEO" agents iff options.restrict == 'SEO'
 *
 *   4
 *   User-Agent does not match "NoJS" agents iff options.restrict == 'NoJS' (superset of SEO)
 */
var cproc = require('child_process');


var DEBUG = !!process.env['DEBUG_ISO'];

function error(source) {
  return function(error) {
    console.error('Connect-Isocode | Error (' +source+ ') ' + error);
  };
};

// TODO support restrict == seo, restrict = nojs
function should_bypass(req, flags) {
  var param = req.query['bypass-isocode'];
  var header = req.headers['x-isocode'];
  return param || (header && header.toLowerCase() == 'bypass');
};


module.exports = function isocode(driver, options) {

  if (arguments.length == 1) {
    options = driver;
    driver = undefined;
  }

  return function(req, res, next) {
    console.log('connect-isocode:req', req.url);

    console.log('connect-isocode:bypass? ' + (should_bypass(req, options) ? 't' : 'f'));
    console.log('connect-isocode:headers ', req.headers);

    if (should_bypass(req, options)) { return next(); }

    var isocodeArgs = [];
    var responseBody = [];
    var responseHeaders = [];

    if (driver) {
      isocodeArgs.push('--driver='+driver);
    }

    // TODO insert the following arguments
    // * Request method (GET, POST, etc)
    // * Request path
    // * Request headers
    isocodeArgs = isocodeArgs.concat([
      '--',
      (req.connection.encrypted ? 'https' : 'http') +
        '://localhost:' +
        req.connection.server.address().port +
        req.url
    ]);

    var isocode = cproc.spawn('isocode', isocodeArgs);

    isocode.on(        'error', error('child process'));
    isocode.stderr.on( 'error', error('stderr'));
    isocode.stdout.on( 'error', error('stdout'));
    isocode.stdin.on(  'error', error('stdin'));


    // TODO recieve metadata from isocode:
    // * statusCode
    // * response headers
    //   preserve order!
    isocode.stderr.on('data', function (data) {
      console.error('Connect-Isocode | STDERR> ', '' + data);
    });



    // TODO support both Chunked Transfer Encoding and fixed length content modes
    // using chunked for simplicity
    // http://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html
    // just respect the user app's behavior
    res.setHeader('Transfer-Encoding', 'chunked');

    isocode.stdout.on('data', function (chunk) {
      DEBUG && console.log('Connect-Isocode | STDOUT>', chunk.toString());
      res.write.apply(res, arguments);
    });



    isocode.on('close', function(code) {
      DEBUG && console.log('isocode:close', arguments);

      if (code) {
        res.statusCode = 500;
        console.error('Isocode sent status code 500. Headless browser absent or unable to process page.');
        return res.end('{ error: "success" }');
      }

      // TODO read from real response
      res.statusCode = 200;
      // res.setHeader('Content-Length', content.length);
      res.end();
    });

















    /*
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
    */
  };
};
