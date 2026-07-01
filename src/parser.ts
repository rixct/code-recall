import { parse as parseYaml } from "yaml";
import { ClozeParseError, parseClozes } from "./cloze";
import { cyrb53 } from "./hash";
import type { Card, CardParseError, ParseResult, TestCase } from "./types";

/** A raw ```coderecall block located in a markdown document. */
interface RawBlock {
	/** The YAML body between the fences. */
	body: string;
	/** 0-based line of the opening fence. */
	lineStart: number;
	/** Char offset of the opening fence within the normalized markdown. */
	offset: number;
	/** Char offset just past the closing fence (or end of doc if unterminated). */
	endOffset: number;
}

// Opening fence: up to 3 spaces, >=3 backticks or tildes, info string `coderecall`.
const OPEN_FENCE_RE = /^(\s{0,3})(`{3,}|~{3,})\s*coderecall\s*$/;

/** Find every ```coderecall fenced block in a markdown document. */
export function extractBlocks(markdown: string): RawBlock[] {
	const src = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const lines = src.split("\n");

	// Char offset of each line's first character.
	const lineOffsets: number[] = [];
	let acc = 0;
	for (const line of lines) {
		lineOffsets.push(acc);
		acc += line.length + 1; // + newline
	}

	const blocks: RawBlock[] = [];
	let i = 0;
	while (i < lines.length) {
		const open = OPEN_FENCE_RE.exec(lines[i]);
		if (!open) {
			i++;
			continue;
		}
		const fence = open[2];
		const fenceChar = fence[0];
		const closeRe = new RegExp(`^\\s{0,3}\\${fenceChar}{${fence.length},}\\s*$`);

		const bodyLines: string[] = [];
		let j = i + 1;
		let closed = false;
		while (j < lines.length) {
			if (closeRe.test(lines[j])) {
				closed = true;
				break;
			}
			bodyLines.push(lines[j]);
			j++;
		}

		blocks.push({
			body: bodyLines.join("\n"),
			lineStart: i,
			offset: lineOffsets[i],
			endOffset: closed ? lineOffsets[j] + lines[j].length : src.length,
		});
		i = closed ? j + 1 : j;
	}
	return blocks;
}

/** Coerce a YAML scalar (string/number/bool) to the raw string we store. */
function stringifyScalar(v: unknown): string {
	return typeof v === "string" ? v : JSON.stringify(v);
}

/**
 * YAML forbids tabs in indentation, but Obsidian's editor inserts a tab when
 * you press Tab — so hand-written cards very often fail to parse. Expand
 * leading tabs to spaces (each tab → 2 spaces) so those cards still work.
 * Only leading whitespace is touched; tabs inside strings/code are left alone.
 */
function expandLeadingTabs(body: string, tabWidth = 2): string {
	return body
		.split("\n")
		.map((line) => {
			const lead = /^[\t ]*/.exec(line)?.[0] ?? "";
			if (!lead.includes("\t")) return line;
			return lead.replace(/\t/g, " ".repeat(tabWidth)) + line.slice(lead.length);
		})
		.join("\n");
}

/** A line that is exactly `---` — separates header / code / tests sections. */
const SEP_RE = /^---\s*$/;

/** Drop leading and trailing blank lines without touching inner indentation. */
function stripBlankEdges(s: string): string {
	return s.replace(/^\n+/, "").replace(/\n+$/, "");
}

/** Normalize a parsed `tests` value into TestCase[] (or an error message). */
function normalizeTests(raw: unknown): { tests?: TestCase[]; error?: string } {
	if (raw === undefined || raw === null) return { tests: [] };
	if (!Array.isArray(raw)) return { error: "'tests' must be a list" };
	const tests: TestCase[] = [];
	for (let k = 0; k < raw.length; k++) {
		const t = raw[k];
		if (t === null || typeof t !== "object" || Array.isArray(t)) {
			return { error: `Test #${k + 1} must be a mapping with 'in' and 'out'` };
		}
		const tc = t as Record<string, unknown>;
		if (tc.in === undefined || tc.out === undefined) {
			return { error: `Test #${k + 1} is missing 'in' or 'out'` };
		}
		tests.push({ input: stringifyScalar(tc.in), expected: stringifyScalar(tc.out) });
	}
	return { tests };
}

/**
 * Parse one raw block into a Card, or return a structured error.
 *
 * Two authoring formats are accepted:
 * - **Sectioned** (recommended, robust): `header --- code --- tests`, where the
 *   code between the `---` lines is taken *verbatim* (any indentation, tabs and
 *   all — YAML never touches it).
 * - **Inline YAML**: a single YAML mapping with a `code: |` block scalar.
 */
export function parseCardBlock(
	block: RawBlock,
	filePath: string,
): { card?: Card; error?: CardParseError } {
	const fail = (message: string): { error: CardParseError } => ({
		error: { filePath, lineStart: block.lineStart, message },
	});

	const lines = block.body.split("\n");
	const seps: number[] = [];
	for (let i = 0; i < lines.length; i++) if (SEP_RE.test(lines[i])) seps.push(i);
	const sectioned = seps.length > 0;

	// Split into header / code / tests text depending on the format.
	let headerText: string;
	let code: string | null = null;
	let testsText: string | null = null;
	if (sectioned) {
		headerText = lines.slice(0, seps[0]).join("\n");
		if (seps.length >= 2) {
			code = stripBlankEdges(lines.slice(seps[0] + 1, seps[1]).join("\n"));
			testsText = lines.slice(seps[1] + 1).join("\n");
		} else {
			code = stripBlankEdges(lines.slice(seps[0] + 1).join("\n"));
		}
	} else {
		headerText = block.body;
	}

	// Header YAML (tabs expanded so tab-indented headers still parse).
	let header: Record<string, unknown>;
	try {
		const parsed = parseYaml(expandLeadingTabs(headerText));
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			return fail("coderecall block header is empty or not a YAML mapping");
		}
		header = parsed as Record<string, unknown>;
	} catch (e) {
		return fail(`Invalid YAML in coderecall header: ${(e as Error).message}`);
	}

	// Code: verbatim section, or the YAML `code:` scalar.
	if (sectioned) {
		if (!code || code.trim() === "") {
			return fail("The code section (between --- separators) is empty");
		}
	} else {
		const rawCode = header.code;
		if (typeof rawCode !== "string" || rawCode.trim() === "") {
			return fail(
				"Missing 'code' — indent it under `code: |`, or use --- separators for verbatim code (see the README).",
			);
		}
		// A YAML literal block scalar always appends one trailing newline; drop it.
		code = rawCode.endsWith("\n") ? rawCode.slice(0, -1) : rawCode;
	}

	const lang = header.lang;
	if (typeof lang !== "string" || lang.trim() === "") {
		return fail("Missing or invalid 'lang' (expected a non-empty string)");
	}

	let cloze;
	try {
		cloze = parseClozes(code);
	} catch (e) {
		if (e instanceof ClozeParseError) return fail(e.message);
		throw e;
	}

	// Tests: from the sectioned tests block, or the YAML `tests:` key.
	let testsRaw: unknown = header.tests;
	if (sectioned) {
		testsRaw = undefined;
		if (testsText !== null && testsText.trim() !== "") {
			try {
				const parsed = parseYaml(expandLeadingTabs(testsText));
				testsRaw = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>)?.tests;
			} catch (e) {
				return fail(`Invalid YAML in tests section: ${(e as Error).message}`);
			}
		}
	}
	const { tests, error: testErr } = normalizeTests(testsRaw);
	if (testErr) return fail(testErr);

	const name = typeof header.name === "string" ? header.name : undefined;
	const entry = typeof header.entry === "string" && header.entry.trim() !== "" ? header.entry.trim() : undefined;
	if (header.mode !== undefined && header.mode !== "call" && header.mode !== "stdio") {
		return fail("'mode' must be either 'call' or 'stdio'");
	}
	const mode = header.mode as "call" | "stdio" | undefined;
	const idOverride = typeof header.id === "string" && header.id.trim() !== "" ? header.id.trim() : null;
	const id = idOverride ?? `cr_${cyrb53(`${filePath}::${lang}::${cloze.solution}`)}`;

	const card: Card = {
		id,
		filePath,
		lang: lang.trim(),
		name,
		entry,
		mode,
		code,
		template: cloze.template,
		solution: cloze.solution,
		clozes: cloze.clozes,
		groups: [...new Set(cloze.clozes.map((c) => c.group))].sort((a, b) => a - b),
		tests: tests ?? [],
		lineStart: block.lineStart,
		blockStart: block.offset,
		blockEnd: block.endOffset,
	};
	return { card };
}

/**
 * Parse all CodeRecall cards out of a markdown document.
 * Malformed blocks are collected in `errors` rather than aborting the whole doc.
 */
export function parseCards(markdown: string, filePath = ""): ParseResult {
	const cards: Card[] = [];
	const errors: CardParseError[] = [];
	const idCounts = new Map<string, number>();

	for (const block of extractBlocks(markdown)) {
		const { card, error } = parseCardBlock(block, filePath);
		if (error) {
			errors.push(error);
			continue;
		}
		if (!card) continue;

		// Disambiguate duplicate ids within the same document.
		const seen = idCounts.get(card.id) ?? 0;
		idCounts.set(card.id, seen + 1);
		if (seen > 0) card.id = `${card.id}#${seen + 1}`;
		cards.push(card);
	}

	return { cards, errors };
}
