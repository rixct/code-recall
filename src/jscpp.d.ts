declare module "JSCPP" {
	interface JSCPPConfig {
		stdio?: { write?: (s: string) => void; drain?: () => string };
		/** Abort execution after this many milliseconds (guards infinite loops). */
		maxTimeout?: number;
		unsigned_overflow?: "error" | "warn" | "ignore";
	}
	/** Interpret and run C/C++ `code`, piping `input` to stdin. Returns exit code. */
	export function run(code: string, input: string, config?: JSCPPConfig): number;
}
