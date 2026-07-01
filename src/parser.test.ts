import { describe, expect, it } from "vitest";
import { extractBlocks, parseCards } from "./parser";

/** Build a markdown doc from lines (avoids backtick-escaping headaches). */
const doc = (...lines: string[]) => lines.join("\n");

const TWO_SUM = doc(
	"# Deck",
	"",
	"```coderecall",
	"lang: python",
	"name: Two Sum",
	"code: |",
	"  def two_sum(nums, target):",
	"      seen = {}",
	"      {{c1::for i, n in enumerate(nums):",
	"          if target - n in seen:",
	"              return [seen[target - n], i]",
	"          seen[n] = i}}",
	"tests:",
	'  - in: "[[2, 7, 11, 15], 9]"',
	'    out: "[0, 1]"',
	'  - in: "[[3, 2, 4], 6]"',
	'    out: "[1, 2]"',
	"```",
);

describe("parseCards — full card", () => {
	const { cards, errors } = parseCards(TWO_SUM, "algos.md");

	it("produces exactly one card with no errors", () => {
		expect(errors).toEqual([]);
		expect(cards).toHaveLength(1);
	});

	it("captures metadata", () => {
		const c = cards[0];
		expect(c.lang).toBe("python");
		expect(c.name).toBe("Two Sum");
		expect(c.filePath).toBe("algos.md");
		expect(c.lineStart).toBe(2); // 0-based line of the opening fence
		expect(c.id.startsWith("cr_")).toBe(true);
	});

	it("derives solution, template and clozes", () => {
		const c = cards[0];
		expect(c.solution).toContain("def two_sum(nums, target):");
		expect(c.solution).toContain("seen = {}");
		expect(c.solution).toContain("for i, n in enumerate(nums):");
		expect(c.template).toContain("{{c1}}");
		expect(c.template).not.toContain("for i, n in enumerate");
		expect(c.groups).toEqual([1]);
		expect(c.clozes).toHaveLength(1);
		expect(c.solution.slice(c.clozes[0].start, c.clozes[0].end)).toBe(c.clozes[0].content);
	});

	it("parses test cases as raw strings", () => {
		const c = cards[0];
		expect(c.tests).toHaveLength(2);
		expect(c.tests[0]).toEqual({ input: "[[2, 7, 11, 15], 9]", expected: "[0, 1]" });
		expect(c.tests[1]).toEqual({ input: "[[3, 2, 4], 6]", expected: "[1, 2]" });
	});
});

describe("parseCards — multiple blocks", () => {
	const md = doc(
		"```coderecall",
		"lang: python",
		"code: |",
		"  def f():",
		"      {{c1::return 1}}",
		"```",
		"",
		"Some prose in between.",
		"",
		"```python",
		'print("this is a normal code block, not a card")',
		"```",
		"",
		"```coderecall",
		"lang: js",
		"code: |",
		"  function g() { return {{c1::2}}; }",
		"```",
	);

	it("parses each coderecall block and ignores plain code fences", () => {
		const { cards, errors } = parseCards(md, "mixed.md");
		expect(errors).toEqual([]);
		expect(cards.map((c) => c.lang)).toEqual(["python", "js"]);
		expect(cards[1].solution).toBe("function g() { return 2; }");
	});
});

describe("parseCards — id stability", () => {
	it("keeps the same id when the block shifts to a different line", () => {
		const block = [
			"```coderecall",
			"lang: python",
			"code: |",
			"  def f():",
			"      {{c1::return 1}}",
			"```",
		];
		const top = parseCards(doc(...block), "same.md");
		const shifted = parseCards(doc("# heading", "", "prose", "", ...block), "same.md");

		expect(top.cards[0].lineStart).not.toBe(shifted.cards[0].lineStart);
		expect(top.cards[0].id).toBe(shifted.cards[0].id);
	});

	it("disambiguates duplicate cards in the same file", () => {
		const block = [
			"```coderecall",
			"lang: python",
			"code: |",
			"  {{c1::x = 1}}",
			"```",
		];
		const { cards } = parseCards(doc(...block, "", ...block), "dup.md");
		expect(cards).toHaveLength(2);
		expect(cards[0].id).not.toBe(cards[1].id);
		expect(cards[1].id.endsWith("#2")).toBe(true);
	});
});

describe("parseCards — error handling", () => {
	const parseOne = (...body: string[]) =>
		parseCards(doc("```coderecall", ...body, "```"), "e.md");

	it("reports a missing lang", () => {
		const { cards, errors } = parseOne("code: |", "  {{c1::x}}");
		expect(cards).toHaveLength(0);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toMatch(/lang/);
	});

	it("reports a missing code", () => {
		const { errors } = parseOne("lang: python");
		expect(errors[0].message).toMatch(/code/);
	});

	it("reports tests that are not a list", () => {
		const { errors } = parseOne("lang: python", "code: |", "  {{c1::x}}", "tests: 5");
		expect(errors[0].message).toMatch(/tests/);
	});

	it("propagates a cloze error and skips the card", () => {
		const { cards, errors } = parseOne("lang: python", "code: |", "  x{{c1::}}y");
		expect(cards).toHaveLength(0);
		expect(errors[0].message).toMatch(/[Ee]mpty/);
	});

	it("coerces numeric test values to strings", () => {
		const { cards } = parseOne("lang: python", "code: |", "  {{c1::x}}", "tests:", "  - in: 5", "    out: 6");
		expect(cards[0].tests[0]).toEqual({ input: "5", expected: "6" });
	});
});

describe("parseCards — sectioned (---) format", () => {
	it("takes the code section verbatim, even at column 0 with tabs", () => {
		// Mirrors a common hand-edit: code not indented, tabs for nesting.
		const md = [
			"```coderecall",
			"lang: python",
			"name: Two Sum",
			"---",
			"def two_sum(nums, target):",
			"\tseen = {}",
			"\t{{c1::for i, n in enumerate(nums):",
			"\t\tseen[n] = i}}",
			"---",
			"tests:",
			'  - in: "[[2,7,11,15], 9]"',
			'    out: "[0, 1]"',
			"```",
		].join("\n");
		const { cards, errors } = parseCards(md, "s.md");
		expect(errors).toEqual([]);
		expect(cards).toHaveLength(1);
		expect(cards[0].name).toBe("Two Sum");
		// Verbatim: the leading tab on `seen = {}` is preserved.
		expect(cards[0].solution).toContain("\tseen = {}");
		expect(cards[0].tests).toHaveLength(1);
	});

	it("works without a tests section (header --- code)", () => {
		const md = ["```coderecall", "lang: javascript", "---", "const f = () => {{c1::42}};", "```"].join("\n");
		const { cards, errors } = parseCards(md);
		expect(errors).toEqual([]);
		expect(cards[0].solution).toBe("const f = () => 42;");
		expect(cards[0].tests).toEqual([]);
	});

	it("accepts a bare test list (no explicit `tests:` key)", () => {
		const md = [
			"```coderecall",
			"lang: javascript",
			"---",
			"function f() { return {{c1::1}}; }",
			"---",
			'- in: "[]"',
			'  out: "1"',
			"```",
		].join("\n");
		const { cards, errors } = parseCards(md);
		expect(errors).toEqual([]);
		expect(cards[0].tests).toEqual([{ input: "[]", expected: "1" }]);
	});
});

describe("extractBlocks", () => {
	it("supports tilde fences", () => {
		const md = doc("~~~coderecall", "lang: python", "code: |", "  {{c1::x}}", "~~~");
		const { cards, errors } = parseCards(md);
		expect(errors).toEqual([]);
		expect(cards).toHaveLength(1);
	});

	it("accepts tab-indented cards (Obsidian inserts tabs; YAML forbids them)", () => {
		const md = [
			"```coderecall",
			"lang: python",
			"code: |",
			"\tdef f():",
			"\t\t{{c1::return 1}}",
			"tests:",
			'\t- in: "[]"',
			'\t  out: "1"',
			"```",
		].join("\n");
		const { cards, errors } = parseCards(md, "tabs.md");
		expect(errors).toEqual([]);
		expect(cards).toHaveLength(1);
		expect(cards[0].solution).toBe("def f():\n  return 1");
		expect(cards[0].tests).toEqual([{ input: "[]", expected: "1" }]);
	});

	it("returns the raw body between fences", () => {
		const blocks = extractBlocks(doc("```coderecall", "lang: python", "```"));
		expect(blocks).toHaveLength(1);
		expect(blocks[0].body).toBe("lang: python");
		expect(blocks[0].lineStart).toBe(0);
	});
});
