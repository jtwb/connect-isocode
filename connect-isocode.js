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

function error(source) {
  return function(error) {
    console.log('Connect-Isocode | Error (' +source+ ') ' + error);
  };
};

module.exports = function isocode(driver) {

  var driver = driver || 'phantomjs';

  /*
   * Wrap res.end, res.write to filter the output stream.
   * See http://www.senchalabs.org/connect/compress.html
   */
  return function(req, res, next) {
    var setHeader = res.setHeader
    var write = res.write;
    var writeHead = res.writeHead;
    var writeHeader = res.writeHeader;
    var end = res.end;
    var filter = cproc.spawn('isocode', [' --driver=' + driver]);
    var buffer = [];

    filter.on('error', error('child process'));
    filter.stderr.on('error', error('stderr'));
    filter.stdout.on('error', error('stdout'));
    filter.stdin.on('error', error('stdin'));

    filter.stderr.on('data', function (data) {
      console.log('STDERR> ', '' + data);
    });

    filter.stdout.on('data', function (chunk) {
      console.log('out', arguments);
      buffer.push(chunk);
    });

    filter.on('close', function(code) {
      console.log('close', arguments);
      if (code) {
        // TODO maybe a race condition: user app may set statusCode
        // res.statusCode = 500;
        console.error('Isocode sent status code 500. Headless browser absent or unable to process page.');
        return end.call(res, '{ error: "success" }');
      }
      console.log(buffer);
      console.log(buffer.join(''));
      end.call(res, buffer.join(''));
    });

    // res.write = filter.stdin.write;
    res.write = function() {
      console.log('write', arguments);
      filter.stdin.write.apply(filter.stdin, arguments);
    };

    // res.end = filter.stdin.end;
    res.end = function() {
      console.log('end', arguments);
      filter.stdin.end.apply(filter.stdin, arguments);
    };

    next();
  };
};
