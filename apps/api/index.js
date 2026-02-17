const http = require("http");

http.createServer((req, res) => {
  res.end("Wedding API running");
}).listen(3000);

console.log("API running on port 3000");