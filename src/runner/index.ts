import type { CodeRunner, RawRun } from "../types";
import { cppRunner } from "./cpp";
import { jsWorkerRunner } from "./jsWorker";
import { pyodideRunner } from "./pyodide";

/** A runner that always fails, used for languages we don't execute yet. */
function unsupported(lang: string): CodeRunner {
	return {
		async run(): Promise<RawRun> {
			return {
				ok: false,
				error: `Language "${lang}" can't be executed yet. Supported: javascript, python, c++.`,
			};
		},
	};
}

/** Pick the execution backend for a card's language. */
export function getRunner(lang: string): CodeRunner {
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
			return cppRunner;
		default:
			return unsupported(lang);
	}
}

/** True if we can actually execute this language (used to warn in the UI). */
export function isSupportedLang(lang: string): boolean {
	return ["javascript", "js", "python", "py", "c++", "cpp", "c"].includes(lang.toLowerCase());
}
