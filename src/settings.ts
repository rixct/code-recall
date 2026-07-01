/** User-configurable plugin settings (persisted in data.json). */
export interface CodeRecallSettings {
	/** Syntax-highlight code in the review view and in-note cards. */
	syntaxHighlight: boolean;
	/** Run C++/Java via locally-installed compilers (desktop only). */
	nativeExecution: boolean;
	/** C++ compiler command; empty = auto-detect (g++ then clang++). */
	cppCompiler: string;
}

export const DEFAULT_SETTINGS: CodeRecallSettings = {
	syntaxHighlight: true,
	nativeExecution: true,
	cppCompiler: "",
};
