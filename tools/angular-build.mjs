import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isolatedNode = resolve(project, ".node/bin/node");
const executable = existsSync(isolatedNode) ? isolatedNode : Number(process.versions.node.split(".")[0]) >= 24 ? process.execPath : undefined;
if (!executable) {
	console.error("Node 24 is unavailable. Install it in .node or activate the version in .nvmrc, then run npm run build again.");
	process.exit(1);
}
console.log(`[build] Node: ${executable}`);
const child = spawn(executable, [
	resolve(project, "node_modules/@angular/cli/bin/ng.js"),
	"build", ...process.argv.slice(2)
], {
	cwd: project,
	stdio: "inherit",
	env: {
		...process.env,
		PATH: dirname(executable) + ":" + process.env.PATH,
		NG_CLI_ANALYTICS: "false",
		CI: "true"
	}
});
child.on("error", error => { console.error(error.message); process.exit(1); });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 130 : 0)));
