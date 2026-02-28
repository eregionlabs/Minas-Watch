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
  const content = fs.readFileSync(path.join(schemaDir, file), "utf8");
  const schema = JSON.parse(content);
  ajv.addSchema(schema, path.basename(file, ".json"));
}

console.log(`✅ Loaded ${schemaFiles.length} schemas`);
