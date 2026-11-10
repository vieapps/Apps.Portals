import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
// Use the esbuild version owned and locked by the project's Angular build tooling.
const buildRequire = createRequire(require.resolve("@angular/build/package.json"));
const { build } = buildRequire("esbuild");
const suite = process.argv[2] ?? "core";
if (!["core", "session", "transport", "forms", "completer"].includes(suite)) throw new Error("Unknown verification suite: " + suite);
const outfile = resolve(root, `node_modules/.cache/portals-cms/${suite}.contracts.mjs`);
await mkdir(dirname(outfile), { recursive: true });
await build({
	absWorkingDir: root,
	entryPoints: [`verification/${suite}.contracts.ts`],
	outfile,
	bundle: true,
	platform: "node",
	format: "esm",
	packages: "external",
	tsconfig: "tsconfig.app.json",
	logLevel: "warning"
});
await import(pathToFileURL(outfile).href);
