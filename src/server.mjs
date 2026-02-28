import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createNewsService } from "./news-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const schemaDir = path.join(root, "schemas");
const publicDir = path.join(root, "public");

const schemaFiles = fs
  .readdirSync(schemaDir)
  .filter((f) => f.endsWith(".schema.json"))
  .sort();

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

for (const file of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, file), "utf8"));
  ajv.addSchema(schema, path.basename(file, ".json"));
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(publicDir, { extensions: ["html"] }));

app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

const newsService = createNewsService();
newsService.start();

function clampLimit(rawLimit, maxLimit) {
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return maxLimit;
  }

  return Math.min(parsed, maxLimit);
}

function writeSseEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "minas-watch-api", uptime_s: process.uptime() });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/schemas", (_req, res) => {
  res.json({ count: schemaFiles.length, schemas: schemaFiles });
});

app.get("/api/news", async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, newsService.maxItems);
    const payload = await newsService.getLatest(limit);
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: "news_unavailable",
      message: error?.message || "Failed to load news"
    });
  }
});

app.get("/api/news/stream", async (req, res) => {
  const limit = clampLimit(req.query.limit, newsService.maxItems);
  let initialPayload;

  try {
    initialPayload = await newsService.getLatest(limit);
  } catch (error) {
    return res.status(500).json({
      error: "news_stream_unavailable",
      message: error?.message || "Failed to initialize stream"
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  writeSseEvent(res, "news", initialPayload);
  const unsubscribe = newsService.subscribe((payload) => {
    try {
      writeSseEvent(res, "news", {
        ...payload,
        items: payload.items.slice(0, limit),
        count: Math.min(limit, payload.count)
      });
    } catch {
      clearInterval(heartbeat);
      unsubscribe();
    }
  });

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

app.post("/validate/:schema", (req, res) => {
  const raw = req.params.schema;
  const schemaName = raw.endsWith(".schema") ? `${raw}.json` : `${raw}.schema.json`;
  const validate = ajv.getSchema(schemaName);

  if (!validate) {
    return res.status(404).json({
      error: "schema_not_found",
      requested: req.params.schema,
      hint: "Use one of GET /schemas entries without .json suffix"
    });
  }

  const valid = validate(req.body);
  if (!valid) {
    return res.status(400).json({
      valid: false,
      errors: validate.errors ?? []
    });
  }

  return res.json({ valid: true });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Minas Watch API listening on http://localhost:${port}`);
});
