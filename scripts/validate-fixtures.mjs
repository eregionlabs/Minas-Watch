import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const schemaDir = path.join(root, "schemas");
const fixtureDir = path.join(root, "fixtures");

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

const mapping = [
  ["source.schema", "source.sample.json"],
  ["signal.schema", "signal.sample.json"],
  ["incident.schema", "incident.sample.json"],
  ["evidence.schema", "evidence.sample.json"],
  ["alert.schema", "alert.sample.json"],
  ["audit-log.schema", "audit-log.sample.json"]
];

let failures = 0;

for (const [schemaName, fixtureFile] of mapping) {
  const validate = ajv.getSchema(schemaName);
  const payload = JSON.parse(fs.readFileSync(path.join(fixtureDir, fixtureFile), "utf8"));
  const ok = validate?.(payload) ?? false;

  if (!ok) {
    failures += 1;
    console.error(`❌ ${fixtureFile} failed ${schemaName}`);
    console.error(validate?.errors ?? "No validation function");
  } else {
    console.log(`✅ ${fixtureFile} valid`);
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log("\nAll fixtures are valid.");
