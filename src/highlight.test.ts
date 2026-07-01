import { describe, expect, it } from "vitest";
import { codeFenceBlock, highlightLang } from "./highlight";

describe("highlightLang", () => {
	it("maps aliases to Prism language ids", () => {
		expect(highlightLang("js")).toBe("javascript");
		expect(highlightLang("javascript")).toBe("javascript");
		expect(highlightLang("py")).toBe("python");
		expect(highlightLang("c++")).toBe("cpp");
		expect(highlightLang("Java")).toBe("java");
	});

	it("passes unknown languages through, lowercased", () => {
		expect(highlightLang("Rust")).toBe("rust");
	});
});

describe("codeFenceBlock", () => {
	it("uses a 3-backtick fence for ordinary code", () => {
		expect(codeFenceBlock("js", "const x = 1;")).toBe("```javascript\nconst x = 1;\n```");
	});

	it("grows the fence past any backtick run in the code", () => {
		const code = 'printf("```");';
		const block = codeFenceBlock("c", code);
		expect(block.startsWith("````c\n")).toBe(true); // 4 backticks > the ``` inside
		expect(block.endsWith("\n````")).toBe(true);
	});
});
