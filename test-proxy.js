// ローカルテスト用プロキシサーバー（Node.js）
// 使い方: node test-proxy.js
const http = require("http");
const https = require("https");
const url = require("url");

const PORT = 8787;

http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const deckId = parsed.query.deck_id;

  if (!deckId || !/^[A-Za-z0-9]{1,10}$/.test(deckId)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid deck_id" }));
    return;
  }

  const apiUrl = `https://decklog.bushiroad.com/system/app/api/view/${deckId}`;
  const postReq = https.request(apiUrl, {
    method: "POST",
    headers: {
      "Referer": "https://decklog.bushiroad.com/",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  }, (apiRes) => {
    let body = "";
    apiRes.on("data", (chunk) => body += chunk);
    apiRes.on("end", () => {
      res.writeHead(apiRes.statusCode, { "Content-Type": "application/json" });
      res.end(body);
    });
  });

  postReq.on("error", (e) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  });

  postReq.end();
}).listen(PORT, () => {
  console.log(`Proxy running at http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}?deck_id=3XLS`);
});
