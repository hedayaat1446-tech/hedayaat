import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_FILE = path.join(DIST_DIR, "index.html");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

function sendFile(res, filePath, statusCode = 200) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      mimeTypes[ext] || "application/octet-stream";

    res.writeHead(statusCode, {
      "Content-Type": contentType,
      "Cache-Control":
        ext === ".html"
          ? "no-cache"
          : "public, max-age=31536000, immutable"
    });

    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const rawPath = (req.url || "/").split("?")[0];

  let decodedPath;

  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    decodedPath = "/";
  }

  const requestedPath =
    decodedPath === "/" ? "/index.html" : decodedPath;

  const normalizedPath = path
    .normalize(requestedPath)
    .replace(/^(\.\.[/\\])+/, "");

  let filePath = path.join(
    DIST_DIR,
    normalizedPath
  );

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(
        filePath,
        "index.html"
      );

      sendFile(res, filePath);
      return;
    }

    if (!err && stat.isFile()) {
      sendFile(res, filePath);
      return;
    }

    if (fs.existsSync(INDEX_FILE)) {
      sendFile(res, INDEX_FILE);
      return;
    }

    res.writeHead(500, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end(
      "dist/index.html was not found. Check that the build command creates the dist folder before npm start."
    );
  });
});

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Hedayaat site running on port ${PORT}`
    );

    console.log(
      `Serving files from: ${DIST_DIR}`
    );

    console.log(
      `index.html exists: ${fs.existsSync(INDEX_FILE)}`
    );
  }
);
