import type { Cloze } from "./types";

/**
 * Thrown when a card's code contains a malformed cloze deletion.
 * `offset` is the character index within the code where the problem was found.
 */
export class ClozeParseError extends Error {
	constructor(
		message: string,
		public readonly offset: number,
	) {
		super(message);
		this.name = "ClozeParseError";
	}
}

export interface ClozeParse {
	/** Full code with markers removed and escapes decoded — the reference answer. */
	solution: string;
	/** `solution` with each cloze region replaced by a `{{cN}}` blank. */
	template: string;
	/** All clozes found, in source order. Offsets index into {@link solution}. */
	clozes: Cloze[];
}

// Matches a cloze opener `{{cN::` anchored at a position (sticky).
const OPEN_RE = /\{\{c(\d+)::/y;

/**
 * Parse cloze deletions out of a block of code.
 *
 * Syntax:
 * - `{{cN::hidden}}` marks `hidden` as cloze group N (N is a positive integer).
 * - The first unescaped `}}` closes the current cloze.
 * - To include a literal `{{` or `}}` inside cloze content (e.g. an f-string or
 *   a dict literal that ends a hidden line), escape it as `\{{` or `\}}`.
 *   Any other backslash (e.g. `\n`, `\\`) is left untouched, so normal code is
 *   never corrupted.
 *
 * Nested, empty, or unclosed clozes — and code with no cloze at all — throw
 * {@link ClozeParseError}.
 */
export function parseClozes(code: string): ClozeParse {
	let solution = "";
	const clozes: Cloze[] = [];

	let inside = false;
	let curGroup = 0;
	let curStart = 0;

	let i = 0;
	const n = code.length;

	while (i < n) {
		const ch = code[i];

		// Escapes: only `\{{` and `\}}` are special. Everything else (including
		// `\n`, `\t`, `\\`) passes through verbatim so code isn't mangled.
		if (ch === "\\") {
			const pair = code.slice(i + 1, i + 3);
			if (pair === "{{" || pair === "}}") {
				solution += pair;
				i += 3;
				continue;
			}
			solution += ch;
			i += 1;
			continue;
		}

		// Cloze opener `{{cN::`?
		if (ch === "{") {
			OPEN_RE.lastIndex = i;
			const m = OPEN_RE.exec(code);
			if (m) {
				if (inside) {
					throw new ClozeParseError(
						`Nested cloze deletion is not allowed (found {{c${m[1]}:: inside another cloze)`,
						i,
					);
				}
				inside = true;
				curGroup = parseInt(m[1], 10);
				curStart = solution.length;
				i += m[0].length;
				continue;
			}
		}

		// Cloze closer `}}` (only meaningful while inside a cloze).
		if (inside && ch === "}" && code[i + 1] === "}") {
			const content = solution.slice(curStart);
			if (content.length === 0) {
				throw new ClozeParseError(
					`Empty cloze deletion {{c${curGroup}::}} — nothing to hide`,
					i,
				);
			}
			clozes.push({
				group: curGroup,
				content,
				start: curStart,
				end: solution.length,
			});
			inside = false;
			i += 2;
			continue;
		}

		// Ordinary character (single braces in code land here harmlessly).
		solution += ch;
		i += 1;
	}

	if (inside) {
		throw new ClozeParseError(
			`Unclosed cloze deletion {{c${curGroup}:: (missing }})`,
			curStart,
		);
	}
	if (clozes.length === 0) {
		throw new ClozeParseError(
			"No cloze deletions found (expected at least one {{cN::...}})",
			0,
		);
	}

	// Build the blanked template. Splice from the end so earlier offsets stay valid.
	let template = solution;
	for (const c of [...clozes].sort((a, b) => b.start - a.start)) {
		template = template.slice(0, c.start) + `{{c${c.group}}}` + template.slice(c.end);
	}

	return { solution, template, clozes };
}
