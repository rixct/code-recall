/**
 * Best-effort detection of the "entry" function a card's tests should call.
 * Cards can always override this with an explicit `entry:` field.
 */

const PYTHON_DEF = /^[ \t]*def[ \t]+([A-Za-z_]\w*)[ \t]*\(/m;
const JS_FUNCTION = /^[ \t]*(?:export[ \t]+)?(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/m;
const JS_ARROW = /^[ \t]*(?:export[ \t]+)?(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]*)?\(/m;

/** Return the first top-level function name, or null if none is found. */
export function detectEntry(lang: string, code: string): string | null {
	const l = lang.toLowerCase();
	if (l === "python" || l === "py") {
		return PYTHON_DEF.exec(code)?.[1] ?? null;
	}
	if (l === "javascript" || l === "js" || l === "typescript" || l === "ts") {
		return JS_FUNCTION.exec(code)?.[1] ?? JS_ARROW.exec(code)?.[1] ?? null;
	}
	return null;
}
