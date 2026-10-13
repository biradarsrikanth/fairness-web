// Saves the gateway's OpenAPI spec to openapi/gateway.json; `npm run api:generate` turns it into src/app/api.
// From a running gateway (GATEWAY_URL, default http://localhost:8080), or from a file the gateway's tests
// write (GATEWAY_SPEC=../Fairness-Checker/target/openapi.json, after `mvnw test`).
import { readFile, writeFile } from 'node:fs/promises';

async function load() {
  if (process.env.GATEWAY_SPEC) {
    return JSON.parse(await readFile(process.env.GATEWAY_SPEC, 'utf8'));
  }
  const base = process.env.GATEWAY_URL ?? 'http://localhost:8080';
  const response = await fetch(`${base}/v3/api-docs`);
  if (!response.ok) {
    console.error(`GET ${base}/v3/api-docs answered ${response.status}; is the gateway running?`);
    process.exit(1);
  }
  return response.json();
}

const spec = await load();
// Where it was served from doesn't matter: the app calls the API on its own origin
delete spec.servers;
// Pretty-printed with sorted paths, so a regenerated spec diffs cleanly
spec.paths = Object.fromEntries(Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b)));
await writeFile('openapi/gateway.json', JSON.stringify(spec, null, 2) + '\n');
console.log(`Saved openapi/gateway.json (${Object.keys(spec.paths).length} paths)`);
