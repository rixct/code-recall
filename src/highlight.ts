/**
 * Map a card's `lang` to the language id used by Obsidian's built-in Prism
 * highlighter (as in reading-mode fenced code blocks). Highlighting is purely
 * cosmetic, so languages we can't execute yet (e.g. Java) are still supported.
 */
export function highlightLang(lang: string): string {
	switch (lang.toLowerCase()) {
		case "js":
		case "javascript":
			return "javascript";
		case "ts":
		case "typescript":
			return "typescript";
		case "py":
		case "python":
			return "python";
		case "c++":
		case "cpp":
			return "cpp";
		case "c":
			return "c";
		case "java":
			return "java";
		default:
			return lang.toLowerCase();
	}
}

/**
 * Build a fenced markdown code block for `code` in `lang`, using a backtick
 * fence longer than any backtick run inside the code so a stray ``` line can't
 * break out of the block.
 */
export function codeFenceBlock(lang: string, code: string): string {
	let max = 0;
	let run = 0;
	for (let i = 0; i < code.length; i++) {
		if (code[i] === "`") {
			run += 1;
			if (run > max) max = run;
		} else {
			run = 0;
		}
	}
	const fence = "`".repeat(Math.max(3, max + 1));
	return `${fence}${highlightLang(lang)}\n${code}\n${fence}`;
}
