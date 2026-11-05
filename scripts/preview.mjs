import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/web");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
};

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : null;
}

http
  .createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      let info = await stat(file);
      if (info.isDirectory()) {
        file = resolve(file, "index.html");
        info = await stat(file);
      }
      if (!info.isFile()) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Accept-Ranges", "bytes");
      const range =
        req.headers.range && byteRange(req.headers.range, info.size);
      if (req.headers.range && !range) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
        return;
      }
      if (range) {
        res.writeHead(206, {
          "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
          "Content-Length": range.end - range.start + 1,
        });
      } else {
        res.writeHead(200, { "Content-Length": info.size });
      }
      if (req.method === "HEAD") res.end();
      else await pipeline(createReadStream(file, range || undefined), res);
    } catch {
      if (res.headersSent) return;
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        "Preview file not found. Build the local preview with npm run export:web:preview.",
      );
    }
  })
  .listen(8082, "127.0.0.1", () =>
    console.log("Solace built preview: http://127.0.0.1:8082"),
  );
