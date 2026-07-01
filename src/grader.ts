import { detectEntry } from "./entry";
import type { Card, CodeRunner, GradeOutcome, RunMode, TestResult } from "./types";

/** Default execution mode for a language when the card doesn't specify one. */
export function defaultMode(lang: string): RunMode {
	return ["c++", "cpp", "c"].includes(lang.toLowerCase()) ? "stdio" : "call";
}

/** Rebuild the full program by substituting the user's answers into the clozes. */
export function buildProgram(card: Card, answers: string[]): string {
	let out = card.solution;
	// Splice from the end so earlier offsets remain valid.
	const ordered = card.clozes
		.map((c, i) => ({ c, i }))
		.sort((a, b) => b.c.start - a.c.start);
	for (const { c, i } of ordered) {
		const ans = answers[i] ?? "";
		out = out.slice(0, c.start) + ans + out.slice(c.end);
	}
	return out;
}

/** Canonical, order-insensitive-for-object-keys serialization for comparison. */
function canonical(v: unknown): string {
	if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
	if (v && typeof v === "object") {
		const keys = Object.keys(v as Record<string, unknown>).sort();
		return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
	}
	return JSON.stringify(v);
}

/**
 * Compare an actual output (JSON string) with an expected value (raw authored
 * string). If both parse as JSON they are compared structurally (so `[0, 1]`
 * matches `[0,1]`); otherwise a trimmed string comparison is used.
 */
export function compareOutputs(actual: string, expected: string): boolean {
	let a: unknown;
	let e: unknown;
	let aOk = true;
	let eOk = true;
	try {
		a = JSON.parse(actual);
	} catch {
		aOk = false;
	}
	try {
		e = JSON.parse(expected);
	} catch {
		eOk = false;
	}
	if (aOk && eOk) return canonical(a) === canonical(e);
	return actual.trim() === expected.trim();
}

/** Map test results to an SM-2 quality score (0–5). */
export function resultToQuality(results: TestResult[]): number {
	if (results.length === 0) return 0;
	const passed = results.filter((r) => r.pass).length;
	if (passed === results.length) return 5;
	if (passed > 0) return 3;
	return 1;
}

/**
 * Grade a recall attempt: assemble the program, run every test through the
 * given runner, and compare outputs. Pure orchestration — the runner is
 * injected, so this is fully testable with a local eval-based runner.
 */
export async function gradeAnswers(
	card: Card,
	answers: string[],
	runner: CodeRunner,
	timeoutMs = 3000,
): Promise<GradeOutcome> {
	const program = buildProgram(card, answers);
	const mode = card.mode ?? defaultMode(card.lang);

	// `call` mode needs an entry function; `stdio` mode drives via stdin.
	let entry: string | null = null;
	if (mode === "call") {
		entry = card.entry ?? detectEntry(card.lang, program);
		if (!entry) {
			const results = card.tests.map((t) => ({
				input: t.input,
				expected: t.expected,
				pass: false,
				error: "Could not determine the entry function — add `entry:` to the card.",
			}));
			return { program, entry: null, results, quality: 1 };
		}
	}

	const results: TestResult[] = [];
	for (const t of card.tests) {
		const raw =
			mode === "call"
				? await runner.run({ program, mode, entry: entry ?? undefined, argsJson: t.input, timeoutMs })
				: await runner.run({ program, mode, stdin: t.input, timeoutMs });
		if (!raw.ok) {
			results.push({
				input: t.input,
				expected: t.expected,
				pass: false,
				error: raw.timedOut ? `Timed out after ${timeoutMs}ms` : (raw.error ?? "Execution error"),
			});
		} else {
			results.push({
				input: t.input,
				expected: t.expected,
				actual: raw.output,
				pass: compareOutputs(raw.output ?? "", t.expected),
			});
		}
	}

	return { program, entry, results, quality: resultToQuality(results) };
}
