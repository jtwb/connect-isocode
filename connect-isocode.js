/*
 * connect-isocode
 *
 * Filter the response by evaluating the page in a headless browser
 *  or browser emulator.
 * Makes Javascript apps accessible to no-js clients.
 *
 * TODO stream output to headless browser
 *
 * TODO auto-insert isocode.js script tag?
 */
var cproc = require('child_process');
module.exports = function isocode(driver) {

  var driver = driver || 'phantomjs';

  /*
   * Wrap res.end, res.write to filter the output stream.
   * See http://www.senchalabs.org/connect/compress.html
   */
  return function(req, res, next) {
    var write = res.write;
    var end = res.end;
    var filter = cproc.spawn('bin/drivers/' + driver);
    var buffer = [];

    filter.stdout.on('data', function (data) {
      buffer.push(chunk);
    });

    filter.on('close', function(code) {
      if (code) {
        res.statusCode = 500;
        console.error('Isocode sent status code 500. Headless browser absent or unable to process page.');
        end.call(res, '{ error: "success" }', encoding);
      }
      end.call(res, buffer.join(''), encoding);
    });

    res.write = filter.stdin.write;

    res.end = filter.stdin.end;

    next();
  };
};
