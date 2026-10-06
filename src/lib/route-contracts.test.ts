import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

function entryPoints(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? entryPoints(filename) : /^(page|route)\.tsx?$/.test(entry.name) ? [filename] : [];
  });
}

function routeContractErrors(program: ts.Program, filename: string, segments: string[]) {
  const checker = program.getTypeChecker(); const source = program.getSourceFile(filename)!; const errors: string[] = [];
  const routeModule = checker.getSymbolAtLocation(source);
  if (!routeModule) return ["No module exports"];
  for (const exported of checker.getExportsOfModule(routeModule)) {
    if (!["default", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(exported.name)) continue;
    const declaration = exported.valueDeclaration ?? exported.declarations?.[0];
    if (!declaration) continue;
    const signatures = checker.getTypeOfSymbolAtLocation(exported, declaration).getCallSignatures();
    for (const signature of signatures) {
      let found = false;
      for (const parameter of signature.parameters) {
        const props = checker.getTypeOfSymbolAtLocation(parameter, declaration);
        const params = props.getProperty("params"); if (!params) continue;
        found = true;
        const value = checker.getTypeOfSymbolAtLocation(params, declaration);
        const resolved = checker.getAwaitedType(value) ?? value;
        const names = resolved.getProperties().map((property) => property.name);
        for (const segment of segments) if (!names.includes(segment)) errors.push(`${exported.name}: missing ${segment}`);
        for (const property of resolved.getProperties()) if (!(property.flags & ts.SymbolFlags.Optional) && !segments.includes(property.name)) errors.push(`${exported.name}: unexpected required ${property.name}`);
      }
      // Parameterless handlers can intentionally reject a retired endpoint without consuming its URL identifiers.
      if (!found && signature.parameters.length) errors.push(`${exported.name}: missing params context`);
    }
  }
  return errors;
}

test("dynamic route contracts detect a renamed folder even through imported context aliases", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "innove-route-contract-"));
  try {
    const filename = path.join(directory, "route.ts"); const shared = path.join(directory, "context.ts");
    writeFileSync(shared, "export type Context = { params: Promise<{ oldId: string }> };\n");
    writeFileSync(filename, 'import type { Context } from "./context"; export async function GET(_request: unknown, context: Context) { return (await context.params).oldId; }\n');
    const program = ts.createProgram([filename], { target: ts.ScriptTarget.ES2022, types: [], skipLibCheck: true });
    assert.deepEqual(routeContractErrors(program, filename, ["newId"]), ["GET: missing newId", "GET: unexpected required oldId"]);
    assert.deepEqual(routeContractErrors(program, filename, ["oldId"]), []);
  } finally { rmSync(directory, { recursive: true }); }
});

test("every dynamic page and API consumes the parameters declared by its directory", () => {
  const routes = entryPoints(path.resolve("src/app")).filter((filename) => filename.includes("["));
  assert.ok(routes.length > 50, "Expected the complete application route inventory");
  const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const program = ts.createProgram(routes, { ...parsed.options, incremental: false });
  const violations = routes.flatMap((filename) => {
    const segments = [...filename.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)].map((match) => match[1]);
    return routeContractErrors(program, filename, segments).map((error) => `${path.relative(process.cwd(), filename)}: ${error}`);
  });
  assert.deepEqual(violations, []);
});
