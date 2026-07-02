import { buildJsHarness } from "../harness";
import type { CodeRunner, RawRun } from "../types";

/**
 * The worker body. It evaluates the harness expression, awaits a possible
 * promise, and posts back the JSON-stringified result. Runs in a separate
 * thread so a runaway loop can be killed with `worker.terminate()`.
 */
const WORKER_SRC = `
self.onmessage = async (e) => {
	try {
		const value = await Promise.resolve((0, eval)(e.data.src));
		self.postMessage({ ok: true, output: JSON.stringify(value === undefined ? null : value) });
	} catch (err) {
		self.postMessage({ ok: false, error: String((err && err.stack) || err) });
	}
};
`;

/**
 * Executes JavaScript in a Web Worker with a hard timeout. This is the runner
 * used inside Obsidian: the user's code cannot touch the app, and an infinite
 * loop is terminated rather than freezing the UI.
 */
export const jsWorkerRunner: CodeRunner = {
	run(req): Promise<RawRun> {
		const { timeoutMs } = req;
		const src = buildJsHarness(req.program, req.entry ?? "", req.argsJson ?? "[]");
		return new Promise<RawRun>((resolve) => {
			const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
			const worker = new Worker(url);

			let settled = false;
			const finish = (r: RawRun) => {
				if (settled) return;
				settled = true;
				window.clearTimeout(timer);
				worker.terminate();
				URL.revokeObjectURL(url);
				resolve(r);
			};

			const timer = window.setTimeout(
				() => finish({ ok: false, timedOut: true, error: `Timed out after ${timeoutMs}ms` }),
				timeoutMs,
			);

			worker.onmessage = (ev: MessageEvent) => finish(ev.data as RawRun);
			worker.onerror = (ev: ErrorEvent) => finish({ ok: false, error: ev.message || "Worker error" });
			worker.postMessage({ src });
		});
	},
};
