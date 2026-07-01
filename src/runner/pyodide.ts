import { buildPyHarness } from "../harness";
import type { CodeRunner, RawRun } from "../types";

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// How long the first-ever run may take while Pyodide (~10MB + wasm) downloads.
const LOAD_TIMEOUT_MS = 120_000;

/**
 * Runs inside a Web Worker. Because a worker has no Node globals, Pyodide takes
 * its browser code path — this is what avoids the "node:url" dynamic-import
 * failure seen when loading Pyodide directly in Obsidian's Electron renderer.
 */
const WORKER_SRC = `
// Obsidian runs on Electron and may expose Node globals even inside workers,
// which makes Pyodide take its Node code path and fail on \`import("node:url")\`.
// Setting process.browser forces the browser path (fetch-based loading).
try { if (typeof process !== "undefined" && process) { process.browser = true; } } catch (e) {}

let ready = null;
function ensure() {
	if (!ready) {
		ready = (async () => {
			importScripts("${PYODIDE_BASE}pyodide.js");
			self.__cr_py = await self.loadPyodide({ indexURL: "${PYODIDE_BASE}" });
		})();
	}
	return ready;
}
self.onmessage = async (e) => {
	const { id, type, code } = e.data;
	try {
		if (type === "init") { await ensure(); self.postMessage({ id, ok: true }); return; }
		await ensure();
		self.__cr_py.globals.set("_cr_out", undefined);
		await self.__cr_py.runPythonAsync(code);
		const out = self.__cr_py.globals.get("_cr_out");
		self.postMessage({ id, ok: true, output: out == null ? "null" : String(out) });
	} catch (err) {
		self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
	}
};
`;

let worker: Worker | null = null;
let workerUrl: string | null = null;
let ready = false;
let seq = 0;
const pending = new Map<number, (r: { ok: boolean; output?: string; error?: string }) => void>();

function resetWorker(): void {
	if (worker) worker.terminate();
	if (workerUrl) URL.revokeObjectURL(workerUrl);
	worker = null;
	workerUrl = null;
	ready = false;
	for (const cb of pending.values()) cb({ ok: false, error: "Python runtime was reset" });
	pending.clear();
}

function getWorker(): Worker {
	if (worker) return worker;
	workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
	worker = new Worker(workerUrl);
	worker.onmessage = (ev: MessageEvent) => {
		const { id, ...rest } = ev.data as { id: number };
		const cb = pending.get(id);
		if (cb) {
			pending.delete(id);
			cb(rest as { ok: boolean; output?: string; error?: string });
		}
	};
	worker.onerror = (ev: ErrorEvent) => {
		const msg = ev.message || "Pyodide worker error";
		for (const cb of pending.values()) cb({ ok: false, error: msg });
		pending.clear();
		resetWorker();
	};
	return worker;
}

function send(type: "init" | "run", code: string, timeoutMs: number): Promise<RawRun> {
	return new Promise<RawRun>((resolve) => {
		const id = ++seq;
		let settled = false;
		const finish = (r: RawRun) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			pending.delete(id);
			resolve(r);
		};
		const timer = setTimeout(() => {
			resetWorker(); // kill a hung load or an infinite loop
			finish({ ok: false, timedOut: true, error: `Timed out after ${timeoutMs}ms` });
		}, timeoutMs);
		pending.set(id, (r) => finish(r as RawRun));
		try {
			getWorker().postMessage({ id, type, code });
		} catch (e) {
			finish({ ok: false, error: String(e) });
		}
	});
}

/** True once Pyodide has finished loading in the worker. */
export function isPyodideReady(): boolean {
	return ready;
}

/** Load Pyodide if needed. Safe to call repeatedly; only the first load pays. */
export async function warmupPyodide(): Promise<RawRun> {
	if (ready) return { ok: true };
	const r = await send("init", "", LOAD_TIMEOUT_MS);
	if (r.ok) ready = true;
	return r;
}

export const pyodideRunner: CodeRunner = {
	async run(req): Promise<RawRun> {
		if (!ready) {
			const w = await warmupPyodide();
			if (!w.ok) return w;
		}
		return send("run", buildPyHarness(req.program, req.entry ?? "", req.argsJson ?? "[]"), req.timeoutMs);
	},
};
