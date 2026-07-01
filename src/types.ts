/**
 * Core data model for CodeRecall (Phase 1).
 *
 * A "card" is one ```coderecall block in a note. It carries the code with its
 * cloze deletions, the derived solution/template strings, and the test cases
 * used later (Phase 4) to auto-grade a recall attempt.
 */

/** A single cloze deletion `{{cN::hidden code}}` inside a card's code. */
export interface Cloze {
	/** The group number N from `cN` (e.g. 1 for `c1`). Clozes may share a group. */
	group: number;
	/** The hidden code, with delimiter escapes (`\{{`, `\}}`) already decoded. */
	content: string;
	/** Start offset of this cloze within {@link Card.solution}. */
	start: number;
	/** End offset (exclusive) of this cloze within {@link Card.solution}. */
	end: number;
}

/** One input → expected-output pair. Values are kept as raw strings in Phase 1. */
export interface TestCase {
	/** Raw input as authored (interpreted by the runner in Phase 4). */
	input: string;
	/** Raw expected output as authored. */
	expected: string;
}

/** A parsed CodeRecall card. */
export interface Card {
	/** Stable id derived from content (survives line shifts), or an author override. */
	id: string;
	/** Source note path (empty when parsing a bare string). */
	filePath: string;
	/** Language identifier, e.g. `python`, `javascript`. */
	lang: string;
	/** Optional human-friendly name. */
	name?: string;
	/** Optional entry function name to call in tests; inferred from code if absent. */
	entry?: string;
	/** Execution mode. Defaults by language: `stdio` for C/C++, `call` otherwise. */
	mode?: RunMode;
	/** The code exactly as authored, including cloze markers. */
	code: string;
	/** Code with each cloze replaced by a `{{cN}}` blank — shown to the user. */
	template: string;
	/** Full correct code with cloze markers stripped — the reference answer. */
	solution: string;
	/** All cloze deletions found in the code, in source order. */
	clozes: Cloze[];
	/** Distinct cloze group numbers, ascending. */
	groups: number[];
	/** Test cases (may be empty). */
	tests: TestCase[];
	/** 0-based line of the opening ```coderecall fence. */
	lineStart: number;
	/** Char offset of the opening fence within the (normalized) markdown. */
	blockStart: number;
	/** Char offset just past the closing fence. */
	blockEnd: number;
}

/** A card that failed to parse, with a human-readable reason. */
export interface CardParseError {
	filePath: string;
	/** 0-based line of the offending block's opening fence. */
	lineStart: number;
	message: string;
}

/** Result of parsing a whole markdown document. */
export interface ParseResult {
	cards: Card[];
	errors: CardParseError[];
}

// ── Execution & grading (Phases 3–4) ───────────────────────────────────────

/** Low-level result of executing one harnessed test in a runner. */
export interface RawRun {
	/** True if the code ran and produced a return value. */
	ok: boolean;
	/** JSON string of the function's return value (present when ok). */
	output?: string;
	/** Error message (present when !ok). */
	error?: string;
	/** True if execution was aborted by the timeout. */
	timedOut?: boolean;
}

/**
 * How a test drives the program:
 * - `call`: invoke the entry function with JSON args, compare its JSON return.
 * - `stdio`: run the whole program feeding `stdin`, compare captured stdout.
 */
export type RunMode = "call" | "stdio";

/** One execution request handed to a runner. */
export interface RunRequest {
	program: string;
	mode: RunMode;
	timeoutMs: number;
	/** call mode: function to invoke. */
	entry?: string;
	/** call mode: JSON array of positional arguments. */
	argsJson?: string;
	/** stdio mode: text piped to the program's stdin. */
	stdin?: string;
}

/** Executes a user program against one test, in some sandbox. */
export interface CodeRunner {
	run(req: RunRequest): Promise<RawRun>;
}

/** Options that configure how native (compiler-backed) runners behave. */
export interface RunnerOptions {
	/** Allow running C++/Java via locally-installed toolchains. */
	nativeExecution: boolean;
	/** C++ compiler command (`""`/`auto` → detect g++ then clang++). */
	cppCompiler?: string;
	/** Java launcher command (default `java`). */
	javaPath?: string;
}

/** Outcome of one test case after comparison. */
export interface TestResult {
	input: string;
	expected: string;
	/** JSON string actually produced (absent on error). */
	actual?: string;
	pass: boolean;
	/** Populated when the test could not run or errored. */
	error?: string;
}

/** Aggregate result of grading a recall attempt. */
export interface GradeOutcome {
	/** The full program assembled from the template + the user's answers. */
	program: string;
	/** Entry function used (null if it could not be determined). */
	entry: string | null;
	results: TestResult[];
	/** SM-2 quality 0–5 derived from the results. */
	quality: number;
}

// ── Spaced repetition (Phase 2) ─────────────────────────────────────────────

/** Per-card SM-2 review state, persisted in data.json. */
export interface ReviewState {
	/** SM-2 ease factor (>= 1.3). */
	ease: number;
	/** Current interval in days. */
	intervalDays: number;
	/** Consecutive successful repetitions. */
	reps: number;
	/** Epoch ms when the card is next due. */
	due: number;
	/** Epoch ms of the last review (0 if never). */
	last: number;
	/** Count of times the card lapsed (failed after being learned). */
	lapses: number;
}
