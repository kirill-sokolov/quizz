const http = require("http");

http.createServer((req, res) => {
  res.end("Wedding TV screen");
}).listen(5173);

console.log("Web running on port 5173");