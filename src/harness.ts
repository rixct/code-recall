/**
 * Harness builders: wrap the user's program so that calling the entry function
 * with a test's input produces a comparable result.
 *
 * `argsJson` is a JSON array of positional arguments, e.g. "[[2,7,11,15], 9]".
 * These builders are pure so they can be unit-tested (and the JS one actually
 * executed) without Obsidian.
 */

/**
 * A self-contained JavaScript expression that evaluates to the entry function's
 * return value. The runner `eval`s it and JSON-stringifies the result.
 */
export function buildJsHarness(program: string, entry: string, argsJson: string): string {
	return [
		"(function () {",
		'"use strict";',
		program,
		`return (${entry})(...(${argsJson}));`,
		"})()",
	].join("\n");
}

/**
 * A Python script that stores the JSON-encoded return value in the global
 * `_cr_out`, which the Pyodide runner reads back.
 */
export function buildPyHarness(program: string, entry: string, argsJson: string): string {
	return [
		"import json as _cr_json",
		program,
		`_cr_args = _cr_json.loads(${JSON.stringify(argsJson)})`,
		`_cr_out = _cr_json.dumps((${entry})(*_cr_args))`,
	].join("\n");
}
