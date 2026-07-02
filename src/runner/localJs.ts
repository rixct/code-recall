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
			// Test-only runner: indirect eval keeps the harness out of this scope.
			// The shipped plugin runs JS in a Web Worker (see jsWorker.ts), not here.
			// eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-assignment
			const value: unknown = await Promise.resolve((0, eval)(src));
			return { ok: true, output: JSON.stringify(value ?? null) };
		} catch (err) {
			return { ok: false, error: String((err as Error)?.stack ?? err) };
		}
	},
};
