// Local development: serves the website AND the API from http://localhost:3000
process.env.SERVE_FRONTEND = "1";
require("./server.js");
