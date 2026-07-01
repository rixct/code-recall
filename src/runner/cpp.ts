import * as JSCPP from "JSCPP";
import type { CodeRunner, RawRun } from "../types";

/**
 * Runs C/C++ through JSCPP, a pure-JS C++ interpreter. It runs on the main
 * thread (it's synchronous), but that's safe: JSCPP is a sandboxed interpreter
 * that can't touch the system, and `maxTimeout` aborts runaway loops.
 *
 * Supported: core C++, C-style arrays/pointers/structs, and the bundled
 * headers (iostream, cstdio, cstdlib, cmath, cstring, cctype, ctime, iomanip).
 * NOT supported: the STL containers (vector, map, string, algorithm, …).
 *
 * Uses stdio mode: the program's stdin is the test input, stdout is compared.
 */
export const cppRunner: CodeRunner = {
	async run(req): Promise<RawRun> {
		if (req.mode !== "stdio") {
			return { ok: false, error: "C++ cards use stdin/stdout tests (mode: stdio)." };
		}
		let out = "";
		try {
			JSCPP.run(req.program, req.stdin ?? "", {
				stdio: { write: (s: string) => (out += s) },
				maxTimeout: req.timeoutMs,
			});
			return { ok: true, output: out };
		} catch (err) {
			const msg = String((err as Error)?.message ?? err);
			const timedOut = /time limit/i.test(msg);
			return { ok: false, error: msg, timedOut };
		}
	},
};
