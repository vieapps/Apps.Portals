import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isolatedNode = resolve(project, ".node/bin/node");
const executable = existsSync(isolatedNode) ? isolatedNode : Number(process.versions.node.split(".")[0]) >= 24 ? process.execPath : undefined;
if (!executable) {
	console.error("Node 24 is unavailable. Install it in .node or activate the version in .nvmrc, then run npm run serve again.");
	process.exit(1);
}
const environment = {
	...process.env,
	PATH: dirname(executable) + ":" + process.env.PATH,
	NG_CLI_ANALYTICS: "false",
	CI: "true",
	IONIC_CONFIG_DIRECTORY: resolve(project, ".node/ionic-config")
};
delete environment.IONIC_TOKEN;
delete environment.IONIC_EMAIL;
delete environment.IONIC_PASSWORD;
console.log(`[serve] Node: ${executable}`);
const child = spawn(executable, [
	resolve(project, "node_modules/@ionic/cli/bin/ionic"),
	"serve", "--host", "127.0.0.1", "--no-open", "--no-interactive", ...process.argv.slice(2)
], { cwd: project, stdio: "inherit", env: environment });
child.on("error", error => { console.error(error.message); process.exit(1); });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 130 : 0)));
