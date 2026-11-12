import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = process.execPath;
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
