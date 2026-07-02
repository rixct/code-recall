import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Helpers for native (compiler-backed) runners. These use Node APIs
 * (child_process, fs) and therefore only work on desktop — the plugin is
 * marked isDesktopOnly.
 */

export interface ProcResult {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
	/** Set when the process could not be spawned (e.g. command not found). */
	spawnError?: string;
}

/** Spawn a process, optionally pipe `input` to stdin, and capture output. */
export function runProcess(
	cmd: string,
	args: string[],
	opts: { cwd?: string; input?: string; timeoutMs: number },
): Promise<ProcResult> {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let settled = false;
		let timedOut = false;

		const child = spawn(cmd, args, { cwd: opts.cwd });
		const finish = (r: ProcResult) => {
			if (settled) return;
			settled = true;
			// Node timers (not window.*): this spawns/kills child processes and
			// also runs under Node in unit tests, where `window` is undefined.
			clearTimeout(timer);
			resolve(r);
		};
		const timer = setTimeout(() => {
			timedOut = true;
			try {
				child.kill("SIGKILL");
			} catch {
				/* already gone */
			}
		}, opts.timeoutMs);

		child.stdout?.on("data", (d) => (stdout += d.toString()));
		child.stderr?.on("data", (d) => (stderr += d.toString()));
		child.on("error", (e) => finish({ code: null, stdout, stderr, timedOut, spawnError: e.message }));
		child.on("close", (code) => finish({ code, stdout, stderr, timedOut }));

		if (opts.input !== undefined) {
			child.stdin?.on("error", () => {
				/* ignore EPIPE if the process exits before reading stdin */
			});
			child.stdin?.write(opts.input);
		}
		child.stdin?.end();
	});
}

/** True if `cmd versionArg` runs and exits 0 (i.e. the tool is usable). */
export async function commandWorks(cmd: string, versionArg = "--version"): Promise<boolean> {
	const r = await runProcess(cmd, [versionArg], { timeoutMs: 5000 });
	return !r.spawnError && r.code === 0;
}

export function makeTempDir(): Promise<string> {
	return fs.promises.mkdtemp(path.join(os.tmpdir(), "coderecall-"));
}

export async function cleanup(dir: string): Promise<void> {
	try {
		await fs.promises.rm(dir, { recursive: true, force: true });
	} catch {
		/* best-effort */
	}
}
