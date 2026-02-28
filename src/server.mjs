import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const schemaDir = path.join(root, "schemas");

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "minas-watch-api", uptime_s: process.uptime() });
});

app.get("/schemas", (_req, res) => {
  res.json({ count: schemaFiles.length, schemas: schemaFiles });
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
