import * as fs from "fs";
import * as path from "path";
import type { CodeRunner, RawRun, RunnerOptions } from "../types";
import { cppRunner as jscppRunner } from "./cpp";
import { cleanup, commandWorks, makeTempDir, runProcess } from "./native";

let resolvedCompiler: string | null | undefined;

/** Find a usable C++ compiler: the configured one, else g++, else clang++. */
async function detectCompiler(preferred?: string): Promise<string | null> {
	const pref = preferred?.trim();
	if (pref && pref !== "auto") {
		return (await commandWorks(pref)) ? pref : null;
	}
	if (resolvedCompiler !== undefined) return resolvedCompiler;
	for (const c of ["g++", "clang++"]) {
		if (await commandWorks(c)) {
			resolvedCompiler = c;
			return c;
		}
	}
	resolvedCompiler = null;
	return null;
}

/**
 * Full C++ via a locally-installed compiler (g++/clang++). Compiles the program
 * to a temp binary and runs it, piping the test input to stdin. If no compiler
 * is found, falls back to the bundled JSCPP interpreter (core C++, no STL).
 */
export function makeNativeCppRunner(opts: RunnerOptions): CodeRunner {
	return {
		async run(req): Promise<RawRun> {
			if (req.mode !== "stdio") {
				return { ok: false, error: "C++ uses stdin/stdout tests (mode: stdio)." };
			}
			const compiler = await detectCompiler(opts.cppCompiler);
			if (!compiler) {
				const r = await jscppRunner.run(req);
				if (!r.ok && r.error && /cannot find library/i.test(r.error)) {
					r.error += "\n(No C++ compiler found — install g++/clang++ for full STL support.)";
				}
				return r;
			}

			const dir = await makeTempDir();
			try {
				const src = path.join(dir, "main.cpp");
				const bin = path.join(dir, "main.out");
				await fs.promises.writeFile(src, req.program, "utf8");

				const compile = await runProcess(compiler, ["-std=c++17", "-O1", src, "-o", bin], {
					timeoutMs: Math.max(req.timeoutMs, 20000),
				});
				if (compile.spawnError) return { ok: false, error: `Compiler error: ${compile.spawnError}` };
				if (compile.code !== 0) return { ok: false, error: `Compile error:\n${compile.stderr.trim()}` };

				const run = await runProcess(bin, [], { input: req.stdin ?? "", timeoutMs: req.timeoutMs });
				if (run.timedOut) return { ok: false, timedOut: true, error: `Timed out after ${req.timeoutMs}ms` };
				if (run.spawnError) return { ok: false, error: run.spawnError };
				if (run.code !== 0) {
					return { ok: false, error: `Exited with code ${run.code}${run.stderr ? `\n${run.stderr.trim()}` : ""}` };
				}
				return { ok: true, output: run.stdout };
			} finally {
				void cleanup(dir);
			}
		},
	};
}
