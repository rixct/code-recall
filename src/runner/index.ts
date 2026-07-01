import type { CodeRunner, RawRun, RunnerOptions } from "../types";
import { cppRunner } from "./cpp";
import { makeNativeCppRunner } from "./cppNative";
import { makeNativeJavaRunner } from "./javaNative";
import { jsWorkerRunner } from "./jsWorker";
import { pyodideRunner } from "./pyodide";

const DEFAULT_OPTS: RunnerOptions = { nativeExecution: true };

/** A runner that always fails, used for languages we don't execute. */
function unsupported(message: string): CodeRunner {
	return {
		async run(): Promise<RawRun> {
			return { ok: false, error: message };
		},
	};
}

/** Pick the execution backend for a card's language. */
export function getRunner(lang: string, opts: RunnerOptions = DEFAULT_OPTS): CodeRunner {
	switch (lang.toLowerCase()) {
		case "javascript":
		case "js":
			return jsWorkerRunner;
		case "python":
		case "py":
			return pyodideRunner;
		case "c++":
		case "cpp":
		case "c":
			// Native compiler (full STL) when enabled; JSCPP interpreter otherwise.
			return opts.nativeExecution ? makeNativeCppRunner(opts) : cppRunner;
		case "java":
			return opts.nativeExecution
				? makeNativeJavaRunner(opts)
				: unsupported("Java needs native execution — enable it in Settings → CodeRecall.");
		default:
			return unsupported(`Language "${lang}" can't be executed. Supported: javascript, python, c++, java.`);
	}
}

/** True if we can execute this language (highlighting works for more). */
export function isSupportedLang(lang: string): boolean {
	return ["javascript", "js", "python", "py", "c++", "cpp", "c", "java"].includes(lang.toLowerCase());
}
