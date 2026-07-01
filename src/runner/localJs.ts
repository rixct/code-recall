import { buildJsHarness } from "../harness";
import type { CodeRunner, RawRun } from "../types";

/**
 * Runs JavaScript on the current thread via `eval`. No isolation and no real
 * timeout, so it is NOT used in Obsidian (see jsWorker.ts) — but it's perfect
 * for unit-testing the grading pipeline in Node.
 */
export const localJsRunner: CodeRunner = {
	async run(req): Promise<RawRun> {
		const src = buildJsHarness(req.program, req.entry ?? "", req.argsJson ?? "[]");
		try {
			// Indirect eval keeps the harness out of this function's scope.
			const value = await Promise.resolve((0, eval)(src));
			return { ok: true, output: JSON.stringify(value ?? null) };
		} catch (err) {
			return { ok: false, error: String((err as Error)?.stack ?? err) };
		}
	},
};
