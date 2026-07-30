import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { retrieveByVector, getLexiconMeta } from "./rag-retriever.mjs";

const currentFile = fileURLToPath(import.meta.url);
const workspaceDir = path.resolve(path.dirname(currentFile), "..");
const demoDir = path.join(workspaceDir, "hybrid-search-demo");

const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "File not found" });
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
    "Access-Control-Allow-Origin": "*"
  });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function routeStatic(req, res, pathname) {
  if (pathname === "/") {
    return sendFile(res, path.join(workspaceDir, "index.html"));
  }

  if (pathname === "/hybrid-search-demo" || pathname === "/hybrid-search-demo/") {
    return sendFile(res, path.join(demoDir, "index.html"));
  }

  if (
    pathname === "/app.js" ||
    pathname === "/styles.css" ||
    pathname === "/browser-rag.mjs"
  ) {
    return sendFile(res, path.join(demoDir, pathname.slice(1)));
  }

  if (
    pathname === "/hybrid-search-demo/app.js" ||
    pathname === "/hybrid-search-demo/styles.css" ||
    pathname === "/hybrid-search-demo/browser-rag.mjs"
  ) {
    return sendFile(res, path.join(demoDir, path.basename(pathname)));
  }

  if (pathname === "/README.zh-CN.md") {
    return sendFile(res, path.join(demoDir, "README.zh-CN.md"));
  }

  if (pathname.startsWith("/fuse-search/")) {
    return sendFile(res, path.join(workspaceDir, pathname.slice(1)));
  }

  if (pathname === "/acg_slang_lexicon.zh-CN.json") {
    return sendFile(res, path.join(workspaceDir, "acg_slang_lexicon.zh-CN.json"));
  }

  sendJson(res, 404, { error: "Route not found" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (pathname === "/api/meta" && req.method === "GET") {
    return sendJson(res, 200, getLexiconMeta());
  }

  if (pathname === "/api/rag/retrieve" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const result = retrieveByVector({
        query: body.query,
        topK: body.topK ?? 10,
        filters: body.filters ?? {}
      });
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, {
        error: "Invalid request body",
        message: error.message
      });
    }
  }

  return routeStatic(req, res, pathname);
});

server.listen(port, () => {
  console.log(`Hybrid search demo running at http://localhost:${port}`);
});
