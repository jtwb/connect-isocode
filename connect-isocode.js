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
module.exports = function isocode(driver) {

  var driver = driver || 'phantomjs';

  /*
   * Wrap res.end, res.write to filter the output stream.
   * See http://www.senchalabs.org/connect/compress.html
   */
  return function(req, res, next) {
    var write = res.write;
    var end = res.end;
    var buffer = [];

    function writeBuffer(chunk) {
      buffer.push(chunk);
    }

    res.write = function(chunk, encoding) {
      writeBuffer(chunk);
    };

    res.end = function(chunk, encoding) {
      if (chunk) {
        writeBuffer(chunk);
      }

      filter.on('close', function(code) {
        if (code) {
          res.statusCode = 500;
          console.error('Isocode sent status code 500. Headless browser absent or unable to process page.');
          end.call(res, '{ error: "success" }', encoding);
        }
        // TODO - hook into headless browser here
        end.call(res, buffer.join(''), encoding);
      });
    };

    next();
  };
};
