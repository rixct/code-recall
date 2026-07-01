import { describe, expect, it } from "vitest";
import { ClozeParseError, parseClozes } from "./cloze";

describe("parseClozes — happy path", () => {
	it("parses a single cloze and derives solution + template", () => {
		const { solution, template, clozes } = parseClozes("def f():\n    {{c1::return 42}}");
		expect(solution).toBe("def f():\n    return 42");
		expect(template).toBe("def f():\n    {{c1}}");
		expect(clozes).toHaveLength(1);
		expect(clozes[0].group).toBe(1);
		expect(clozes[0].content).toBe("return 42");
	});

	it("keeps cloze offsets consistent with solution slices", () => {
		const { solution, clozes } = parseClozes("a {{c1::B}} c {{c2::D}} e");
		for (const c of clozes) {
			expect(solution.slice(c.start, c.end)).toBe(c.content);
		}
		expect(solution).toBe("a B c D e");
	});

	it("supports multiple clozes, including a repeated group", () => {
		const { solution, template, clozes } = parseClozes("{{c1::a}}{{c2::b}}{{c1::c}}");
		expect(solution).toBe("abc");
		expect(template).toBe("{{c1}}{{c2}}{{c1}}");
		expect(clozes.map((c) => c.group)).toEqual([1, 2, 1]);
	});

	it("leaves single braces in code (e.g. an empty dict) untouched", () => {
		const { solution, clozes } = parseClozes("seen = {}\n{{c1::return seen[x]}}");
		expect(solution).toBe("seen = {}\nreturn seen[x]");
		expect(clozes[0].content).toBe("return seen[x]");
	});

	it("treats a trailing dict literal inside content correctly (first }} wins)", () => {
		// Content is `d = {1: 2` and the following `}}` closes the cloze — the
		// author must escape a literal }} (see the escape test below).
		const { solution } = parseClozes("x = {{c1::d = {1: 2}} + 1");
		expect(solution).toBe("x = d = {1: 2 + 1");
	});
});

describe("parseClozes — escaping", () => {
	it("decodes \\{{ and \\}} to literal braces without closing the cloze", () => {
		const { solution, clozes } = parseClozes('v = {{c1::f"pre \\{{ mid \\}} post"}}');
		expect(clozes).toHaveLength(1);
		expect(clozes[0].content).toBe('f"pre {{ mid }} post"');
		expect(solution).toBe('v = f"pre {{ mid }} post"');
	});

	it("leaves ordinary backslash escapes (\\n, \\\\) alone", () => {
		const { solution } = parseClozes('{{c1::print("a\\nb\\\\c")}}');
		expect(solution).toBe('print("a\\nb\\\\c")');
	});
});

describe("parseClozes — evil cases", () => {
	it("rejects nested clozes", () => {
		expect(() => parseClozes("{{c1::a {{c2::b}} c}}")).toThrow(ClozeParseError);
		expect(() => parseClozes("{{c1::a {{c2::b}} c}}")).toThrow(/[Nn]ested/);
	});

	it("rejects an empty cloze", () => {
		expect(() => parseClozes("x{{c1::}}y")).toThrow(/[Ee]mpty/);
	});

	it("rejects an unclosed cloze", () => {
		expect(() => parseClozes("def f():\n    {{c1::return 1")).toThrow(/[Uu]nclosed/);
	});

	it("rejects code with no cloze at all", () => {
		expect(() => parseClozes("def f():\n    return 1")).toThrow(/No cloze/);
	});

	it("carries the offending offset on the error", () => {
		try {
			parseClozes("ok {{c1::}}");
			throw new Error("expected to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(ClozeParseError);
			expect((e as ClozeParseError).offset).toBeGreaterThan(0);
		}
	});
});
