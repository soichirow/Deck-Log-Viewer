const { createServer } = require("http-server");
const port = process.env.PORT || 3001;
const server = createServer({ root: ".", cache: -1 });
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
