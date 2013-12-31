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

    process.env.PATH += ':' + __dirname + '/node_modules/isocode'
    var isocode = cproc.spawn('isocode', isocodeArgs);

    isocode.on(        'error', error('child process'));
    isocode.stderr.on( 'error', error('stderr'));
    isocode.stdout.on( 'error', error('stdout'));
    isocode.stdin.on(  'error', error('stdin'));


    // TODO recieve metadata from isocode:
    // * statusCode
    // * response headers
    //   preserve header order!
    isocode.stderr.on('data', function (data) {
      console.error('Connect-Isocode | STDERR> ', '' + data);
    });



    // TODO support fixed content length and reflect the true server behavior
    // using Chunked Transfer Encoding for simplicity
    // http://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html
    res.setHeader('Transfer-Encoding', 'chunked');

    isocode.stdout.on('data', function (chunk) {
      DEBUG && console.log('Connect-Isocode | STDOUT>', chunk.toString());
      res.write.apply(res, arguments);
    });



    isocode.on('close', function(code) {
      DEBUG && console.log('isocode:close', arguments);

      if (code) {
        res.statusCode = 500;
        console.error('Isocode [500]: Headless browser absent or unable to process page.');
        return res.end('<h1>500 Internal Server Error</h1>');
      }

      // TODO relay the real server response code
      res.statusCode = 200;
      // TODO support fixed content length
      // res.setHeader('Content-Length', content.length);
      res.end();
    });
  };
};
