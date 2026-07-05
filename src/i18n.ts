/**
 * Minimal i18n for CodeRecall.
 *
 * Obsidian stores the active UI language in localStorage under `language`
 * (e.g. "en", "ru", "ru-RU"). We mirror it so the plugin speaks whatever the
 * app speaks, and let the user force a language from the settings tab. Anything
 * we don't have a translation for falls back to English.
 */

/** Languages CodeRecall ships strings for. */
export type Lang = "en" | "ru";

/** Settings value: an explicit language, or `auto` (follow Obsidian). */
export type LangSetting = Lang | "auto";

/** All translatable strings, as plain values or interpolating functions. */
export interface Messages {
	// Commands & ribbon.
	ribbonReview: string;
	cmdReview: string;
	cmdScan: string;

	// Notices.
	noActiveNote: string;
	noCards: string;
	foundCards: (n: number) => string;
	nothingDue: string;
	parseFailed: (n: number, line: number, message: string) => string;
	runFailed: (err: string) => string;
	loadingPython: string;

	// In-note embed.
	embedParseError: (message: string) => string;
	embedMeta: (clozes: number, tests: number) => string;

	// Review modal.
	cardTitle: (n: number) => string;
	cantAutoRun: (lang: string) => string;
	fillHidden: string;
	check: string;
	runCheck: string;
	checking: string;
	running: string;
	reveal: string;
	referenceSolution: string;
	couldNotRun: string;
	inLabel: (input: string) => string;
	expectedLabel: (expected: string) => string;
	gotLabel: (actual: string) => string;
	youLabel: (actual: string) => string;
	nothingToCheck: string;
	summary: (passed: number, total: number, text: boolean) => string;
	verdictAllPassed: string;
	verdictPartial: string;
	verdictFailed: string;
	autoVerdict: (verdict: string) => string;
	continueVerdict: (verdict: string) => string;
	overrideAgain: string;
	overrideGood: string;
	again: string;
	hard: string;
	good: string;
	easy: string;
	reviewComplete: string;
	reviewedCount: (n: number) => string;
	close: string;

	// Settings tab.
	setLangName: string;
	setLangDesc: string;
	langAuto: string;
	setSyntaxName: string;
	setSyntaxDesc: string;
	setExecHeading: string;
	setNativeName: string;
	setNativeDesc: string;
	setCompilerName: string;
	setCompilerDesc: string;
	setCompilerPlaceholder: string;
}

const en: Messages = {
	ribbonReview: "CodeRecall: review current note",
	cmdReview: "Review current note",
	cmdScan: "Scan active note for cards",

	noActiveNote: "CodeRecall: no active note",
	noCards: "CodeRecall: no cards in this note",
	foundCards: (n) => `CodeRecall: found ${n} card(s) in this note`,
	nothingDue: "CodeRecall: nothing due — reviewing all cards",
	parseFailed: (n, line, message) => `CodeRecall: ${n} card(s) failed to parse.\nLine ${line}: ${message}`,
	runFailed: (err) => `CodeRecall: run failed — ${err}`,
	loadingPython: "CodeRecall: loading Python runtime — first run downloads Pyodide (~10 MB).",

	embedParseError: (message) => `CodeRecall — can't parse this card: ${message}`,
	embedMeta: (clozes, tests) => `${clozes} cloze · ${tests} test(s)`,

	cardTitle: (n) => `Card ${n}`,
	cantAutoRun: (lang) => `"${lang}" can't be auto-run yet — reveal the answer and self-grade.`,
	fillHidden: "Fill in the hidden part(s):",
	check: "Check",
	runCheck: "Run & check",
	checking: "Checking…",
	running: "Running…",
	reveal: "Reveal answer",
	referenceSolution: "Reference solution:",
	couldNotRun: "Could not run.",
	inLabel: (input) => `in: ${input}`,
	expectedLabel: (expected) => `expected: ${expected}`,
	gotLabel: (actual) => `got:      ${actual}`,
	youLabel: (actual) => `you:      ${actual}`,
	nothingToCheck: "Nothing to check on this card — self-grade below.",
	summary: (passed, total, text) => {
		const unit = text ? "blank" : "test";
		const verb = text ? "correct" : "passed";
		return `${passed}/${total} ${unit}${total === 1 ? "" : "s"} ${verb}`;
	},
	verdictAllPassed: "all passed",
	verdictPartial: "partial",
	verdictFailed: "failed",
	autoVerdict: (verdict) => `Auto: ${verdict}`,
	continueVerdict: (verdict) => `Continue (${verdict})`,
	overrideAgain: "Override: Again",
	overrideGood: "Override: Good",
	again: "Again",
	hard: "Hard",
	good: "Good",
	easy: "Easy",
	reviewComplete: "Review complete",
	reviewedCount: (n) => `Reviewed ${n} card(s).`,
	close: "Close",

	setLangName: "Language",
	setLangDesc: "Interface language for CodeRecall. “Auto” follows Obsidian's language.",
	langAuto: "Auto",
	setSyntaxName: "Syntax highlighting",
	setSyntaxDesc: "Highlight code (JavaScript, Python, C++, Java, …) in the review view and in-note cards.",
	setExecHeading: "Execution",
	setNativeName: "Native execution (C++ / Java)",
	setNativeDesc:
		"Compile and run C++ and Java with your local toolchains (g++/clang++, JDK 11+). " +
		"This runs real programs on your machine — only review notes you trust. " +
		"When off, C++ uses the bundled JSCPP interpreter (no STL) and Java is disabled.",
	setCompilerName: "C++ compiler",
	setCompilerDesc: "Command to use for C++. Leave empty to auto-detect (g++, then clang++).",
	setCompilerPlaceholder: "auto (g++ / clang++)",
};

const ru: Messages = {
	ribbonReview: "CodeRecall: повторить текущую заметку",
	cmdReview: "Повторить текущую заметку",
	cmdScan: "Найти карточки в текущей заметке",

	noActiveNote: "CodeRecall: нет активной заметки",
	noCards: "CodeRecall: в этой заметке нет карточек",
	foundCards: (n) => `CodeRecall: найдено карточек в этой заметке: ${n}`,
	nothingDue: "CodeRecall: нет карточек к повторению — показываю все",
	parseFailed: (n, line, message) => `CodeRecall: не удалось разобрать карточек: ${n}.\nСтрока ${line}: ${message}`,
	runFailed: (err) => `CodeRecall: ошибка запуска — ${err}`,
	loadingPython: "CodeRecall: загрузка среды Python — при первом запуске скачивается Pyodide (~10 МБ).",

	embedParseError: (message) => `CodeRecall — не удалось разобрать карточку: ${message}`,
	embedMeta: (clozes, tests) => `пропусков: ${clozes} · тестов: ${tests}`,

	cardTitle: (n) => `Карточка ${n}`,
	cantAutoRun: (lang) => `«${lang}» пока нельзя запустить автоматически — покажите ответ и оцените себя сами.`,
	fillHidden: "Заполните скрытые части:",
	check: "Проверить",
	runCheck: "Запустить и проверить",
	checking: "Проверка…",
	running: "Запуск…",
	reveal: "Показать ответ",
	referenceSolution: "Эталонное решение:",
	couldNotRun: "Не удалось запустить.",
	inLabel: (input) => `вход: ${input}`,
	expectedLabel: (expected) => `ожидалось: ${expected}`,
	gotLabel: (actual) => `получено:  ${actual}`,
	youLabel: (actual) => `вы:        ${actual}`,
	nothingToCheck: "На этой карточке нечего проверять — оцените себя ниже.",
	summary: (passed, total, text) =>
		text ? `${passed}/${total} пропусков верно` : `${passed}/${total} тестов пройдено`,
	verdictAllPassed: "всё верно",
	verdictPartial: "частично",
	verdictFailed: "неверно",
	autoVerdict: (verdict) => `Авто: ${verdict}`,
	continueVerdict: (verdict) => `Продолжить (${verdict})`,
	overrideAgain: "Изменить: Снова",
	overrideGood: "Изменить: Хорошо",
	again: "Снова",
	hard: "Трудно",
	good: "Хорошо",
	easy: "Легко",
	reviewComplete: "Повторение завершено",
	reviewedCount: (n) => `Повторено карточек: ${n}.`,
	close: "Закрыть",

	setLangName: "Язык",
	setLangDesc: "Язык интерфейса CodeRecall. «Авто» следует за языком Obsidian.",
	langAuto: "Авто",
	setSyntaxName: "Подсветка синтаксиса",
	setSyntaxDesc: "Подсвечивать код (JavaScript, Python, C++, Java, …) в режиме повторения и в карточках внутри заметок.",
	setExecHeading: "Выполнение",
	setNativeName: "Нативное выполнение (C++ / Java)",
	setNativeDesc:
		"Компилировать и запускать C++ и Java локальными инструментами (g++/clang++, JDK 11+). " +
		"Это запускает настоящие программы на вашем компьютере — повторяйте только те заметки, которым доверяете. " +
		"Когда выключено, C++ использует встроенный интерпретатор JSCPP (без STL), а Java недоступна.",
	setCompilerName: "Компилятор C++",
	setCompilerDesc: "Команда для компиляции C++. Оставьте пустым для автоопределения (g++, затем clang++).",
	setCompilerPlaceholder: "авто (g++ / clang++)",
};

const MESSAGES: Record<Lang, Messages> = { en, ru };

/** Map an Obsidian language code (or anything) to a supported {@link Lang}. */
export function resolveLang(code: string | null | undefined): Lang {
	return code && code.toLowerCase().startsWith("ru") ? "ru" : "en";
}

/** Read Obsidian's UI language from localStorage; null if unavailable. */
function readObsidianLang(): string | null {
	try {
		return window.localStorage.getItem("language");
	} catch {
		return null;
	}
}

/** The user's explicit override; `auto` (the default) follows Obsidian. */
let override: LangSetting = "auto";

/** Set the language override from settings (called on load and on change). */
export function setLangOverride(setting: LangSetting): void {
	override = setting;
}

/** The language currently in effect. */
export function activeLang(): Lang {
	return override === "auto" ? resolveLang(readObsidianLang()) : override;
}

/** The active message table. Call fresh each time so overrides take effect. */
export function t(): Messages {
	return MESSAGES[activeLang()];
}
