import * as fs from "fs";
import * as path from "path";
import type { CodeRunner, RawRun, RunnerOptions } from "../types";
import { cleanup, makeTempDir, runProcess } from "./native";

let javaOk: boolean | undefined;

async function javaAvailable(javaCmd: string): Promise<boolean> {
	if (javaOk !== undefined) return javaOk;
	const r = await runProcess(javaCmd, ["-version"], { timeoutMs: 5000 });
	javaOk = !r.spawnError && r.code === 0;
	return javaOk;
}

/**
 * Runs Java via the JDK's single-file source-code mode (`java Foo.java`,
 * Java 11+), which compiles and runs in one step — no separate javac. The
 * program is a full class with `public static void main`; the test input is
 * piped to stdin and stdout is compared.
 */
export function makeNativeJavaRunner(opts: RunnerOptions): CodeRunner {
	const javaCmd = opts.javaPath?.trim() || "java";
	return {
		async run(req): Promise<RawRun> {
			if (req.mode !== "stdio") {
				return { ok: false, error: "Java uses stdin/stdout tests (mode: stdio)." };
			}
			if (!(await javaAvailable(javaCmd))) {
				return { ok: false, error: "Java runtime not found — install a JDK 11+ (needs `java` on PATH)." };
			}

			const dir = await makeTempDir();
			try {
				// JEP 330 relaxes the file-name == class-name rule in single-file mode.
				const file = path.join(dir, "Main.java");
				await fs.promises.writeFile(file, req.program, "utf8");

				const run = await runProcess(javaCmd, [file], {
					input: req.stdin ?? "",
					timeoutMs: Math.max(req.timeoutMs, 20000),
				});
				if (run.timedOut) return { ok: false, timedOut: true, error: `Timed out after ${req.timeoutMs}ms` };
				if (run.spawnError) return { ok: false, error: run.spawnError };
				if (run.code !== 0) {
					return { ok: false, error: run.stderr.trim() || `Exited with code ${run.code}` };
				}
				return { ok: true, output: run.stdout };
			} finally {
				void cleanup(dir);
			}
		},
	};
}
