require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 8083;
const ROOT = __dirname;

app.use(cors());
app.use(express.json());
app.use(express.static(ROOT));

const BMS_URL = process.env.BMS_URL || "https://api.mnotify.com";
let BMS_KEY = process.env.BMS_API_KEY || "";

const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/BMS_API_KEY=(.+)/);
  if (match) BMS_KEY = match[1].trim();
}

function proxyBMS(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BMS_URL}${endpoint}`);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      port: 443,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BMS_KEY}`,
        "Accept": "application/json",
        "Content-Length": data ? data.length : 0
      }
    };
    const req = https.request(options, (res) => {
      let resp = "";
      res.on("data", chunk => resp += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(resp)); } catch(e) { resolve(resp); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

app.post("/api/sms/bulk", async (req, res) => {
  try {
    const { recipients, message } = req.body;
    if (!recipients || !message) return res.status(400).json({ error: "recipients and message required" });
    const result = await proxyBMS("POST", "/bulksms", { recipients, message });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/voice/bulk", async (req, res) => {
  try {
    const { recipients, message } = req.body;
    if (!recipients || !message) return res.status(400).json({ error: "recipients and message required" });
    const result = await proxyBMS("POST", "/voice", { recipients, message });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings", (req, res) => {
  res.json({ bmsKeySet: BMS_KEY.length > 0 });
});

app.post("/api/settings", (req, res) => {
  const { bmsApiKey } = req.body;
  BMS_KEY = bmsApiKey;
  let content = "";
  if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, "utf8");
  if (content.includes("BMS_API_KEY=")) {
    content = content.replace(/BMS_API_KEY=.+/, `BMS_API_KEY=${bmsApiKey}`);
  } else {
    content += `\nBMS_API_KEY=${bmsApiKey}\n`;
  }
  fs.writeFileSync(envPath, content);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Krobo Presbyterian (YPG) running at http://localhost:${PORT}`);
  try { require("child_process").exec("start http://localhost:" + PORT); } catch(e) {}
});
