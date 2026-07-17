import { readFile } from "node:fs/promises";

const spec = JSON.parse(await readFile("docs/api/openapi.yaml", "utf8"));
const routeSource = await readFile("src/backend/routes.ts", "utf8");
const traceability = await readFile("docs/api/brain-api-traceability.md", "utf8");

if (spec.openapi !== "3.1.0" || typeof spec.paths !== "object") {
  throw new Error("docs/api/openapi.yaml must be an OpenAPI 3.1 document.");
}

const operations = new Map();
for (const [path, pathItem] of Object.entries(spec.paths)) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem[method];
    if (!operation) continue;
    if (!operation.operationId) throw new Error(`${method.toUpperCase()} ${path} is missing operationId.`);
    if (operations.has(operation.operationId)) throw new Error(`Duplicate operationId: ${operation.operationId}`);
    for (const extension of ["x-auth-class", "x-operator-scope", "x-idempotency", "x-pagination"]) {
      if (!(extension in operation)) throw new Error(`${operation.operationId} is missing ${extension}.`);
    }
    operations.set(operation.operationId, {
      auth: operation["x-auth-class"],
      method: method.toUpperCase(),
      path,
    });
  }
}

const implemented = [];
const routePattern = /\{\s*auth:\s*"([^"]+)"\s*,\s*handler:\s*[^,]+,\s*method:\s*"([A-Z]+)"\s*,\s*operationId:\s*"([^"]+)"\s*,\s*path:\s*"([^"]+)"/g;
for (const match of routeSource.matchAll(routePattern)) {
  implemented.push({
    auth: match[1] === "optional" ? "optional_user" : match[1],
    method: match[2],
    operationId: match[3],
    path: `/${match[4].replace(/:([A-Za-z0-9_]+)/g, "{$1}")}`,
  });
}

if (!implemented.length) throw new Error("No v1 routes were found in src/backend/routes.ts.");
const implementedIds = new Set();
for (const route of implemented) {
  if (implementedIds.has(route.operationId)) throw new Error(`Duplicate implemented operationId: ${route.operationId}`);
  implementedIds.add(route.operationId);
  const contract = operations.get(route.operationId);
  if (!contract) throw new Error(`Implemented operation is missing from OpenAPI: ${route.operationId}`);
  if (contract.method !== route.method || contract.path !== route.path) {
    throw new Error(`${route.operationId} route mismatch: code=${route.method} ${route.path}, spec=${contract.method} ${contract.path}`);
  }
  if (contract.auth !== route.auth) {
    throw new Error(`${route.operationId} auth mismatch: code=${route.auth}, spec=${contract.auth}`);
  }
}
const missingImplementations = [...operations.keys()].filter((operationId) => !implementedIds.has(operationId));
if (missingImplementations.length) {
  throw new Error(`Documented operations without handlers: ${missingImplementations.join(", ")}`);
}
const missingTraceability = [...operations.keys()].filter((operationId) => !traceability.includes(`\`${operationId}\``));
if (missingTraceability.length) {
  throw new Error(`Documented operations without a Brain traceability entry: ${missingTraceability.join(", ")}`);
}

function resolvePointer(pointer) {
  let value = spec;
  for (const part of pointer.slice(2).split("/")) {
    value = value?.[part.replaceAll("~1", "/").replaceAll("~0", "~")];
  }
  return value;
}

function walk(value, location = "#") {
  if (!value || typeof value !== "object") return;
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
    if (resolvePointer(value.$ref) === undefined) throw new Error(`Broken $ref at ${location}: ${value.$ref}`);
  }
  for (const [key, child] of Object.entries(value)) walk(child, `${location}/${key}`);
}
walk(spec);

console.log(`API contract checks passed (${implemented.length} implemented, ${operations.size} documented operations).`);
