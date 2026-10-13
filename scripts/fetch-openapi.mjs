// Saves the gateway's OpenAPI spec to openapi/gateway.json; `npm run api:generate` turns it into src/app/api.
// GATEWAY_URL defaults to a gateway running locally on :8080.
import { writeFile } from 'node:fs/promises';

const base = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const response = await fetch(`${base}/v3/api-docs`);
if (!response.ok) {
  console.error(`GET ${base}/v3/api-docs answered ${response.status}; is the gateway running?`);
  process.exit(1);
}
const spec = await response.json();
// Pretty-printed with sorted paths, so a regenerated spec diffs cleanly
spec.paths = Object.fromEntries(Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b)));
await writeFile('openapi/gateway.json', JSON.stringify(spec, null, 2) + '\n');
console.log(`Saved openapi/gateway.json (${Object.keys(spec.paths).length} paths)`);
