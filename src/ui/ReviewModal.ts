import { Component, MarkdownRenderer, Modal, Notice } from "obsidian";
import { gradeAnswers } from "../grader";
import { codeFenceBlock } from "../highlight";
import { t } from "../i18n";
import { getRunner, isSupportedLang } from "../runner";
import { isPyodideReady } from "../runner/pyodide";
import { review } from "../scheduler";
import type CodeRecallPlugin from "../main";
import type { Card, GradeOutcome } from "../types";

/**
 * The review session UI. Shows one card at a time: the code template with the
 * hidden regions blanked, a textarea per cloze, a "Run & check" button that
 * auto-grades against the card's tests, and grade buttons that advance the
 * SM-2 schedule.
 */
export class ReviewModal extends Modal {
	private index = 0;
	private reviewed = 0;
	private answers: string[] = [];
	private outcome: GradeOutcome | null = null;
	/** Owns markdown-render children so they unload when the modal closes. */
	private readonly renderScope = new Component();

	constructor(
		private readonly plugin: CodeRecallPlugin,
		private readonly queue: Card[],
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("coderecall-modal");
		this.renderScope.load();
		this.renderCard();
	}

	onClose(): void {
		this.renderScope.unload();
		this.contentEl.empty();
	}

	private get card(): Card | undefined {
		return this.queue[this.index];
	}

	/** Render `code` into `container`, syntax-highlighted if the setting is on. */
	private async renderCode(container: HTMLElement, code: string, lang: string): Promise<void> {
		container.empty();
		if (this.plugin.settings.syntaxHighlight) {
			const md = codeFenceBlock(lang, code);
			await MarkdownRenderer.render(this.plugin.app, md, container, "", this.renderScope);
		} else {
			container.createEl("pre").createEl("code", { text: code });
		}
	}

	private renderCard(): void {
		const { contentEl } = this;
		contentEl.empty();

		const card = this.card;
		if (!card) return this.renderDone();

		this.answers = card.clozes.map(() => "");
		this.outcome = null;

		contentEl.createEl("h2", { text: card.name ?? t().cardTitle(this.index + 1) });
		const meta = contentEl.createEl("div", { cls: "cr-meta" });
		if (card.lang) meta.createEl("span", { cls: "cr-badge", text: card.lang });
		meta.createEl("span", { text: `${this.index + 1} / ${this.queue.length}` });

		// Only warn about no runner when the card actually has tests to run;
		// tests-less (and language-less) cards are graded by text comparison.
		if (card.lang && card.tests.length > 0 && !isSupportedLang(card.lang)) {
			contentEl.createEl("p", { cls: "cr-warn", text: t().cantAutoRun(card.lang) });
		}

		contentEl.createEl("p", { cls: "cr-label", text: t().fillHidden });
		const codeBox = contentEl.createEl("div", { cls: "cr-code" });
		void this.renderCode(codeBox, card.template, card.lang);

		card.clozes.forEach((cloze, i) => {
			const wrap = contentEl.createEl("div", { cls: "cr-input" });
			wrap.createEl("label", { text: `{{c${cloze.group}}}` });
			const ta = wrap.createEl("textarea", { cls: "cr-answer" });
			ta.rows = Math.min(14, cloze.content.split("\n").length + 1);
			ta.addEventListener("input", () => {
				this.answers[i] = ta.value;
			});
			if (i === 0) window.setTimeout(() => ta.focus(), 0);
		});

		const results = contentEl.createEl("div", { cls: "cr-results" });
		const controls = contentEl.createEl("div", { cls: "cr-controls" });

		// No tests / no language → grade by comparing text, so we just "check".
		const textGraded = card.tests.length === 0 || !card.lang;
		const checkLabel = textGraded ? t().check : t().runCheck;
		const isPython = ["python", "py"].includes(card.lang.toLowerCase());
		const checkBtn = controls.createEl("button", { text: checkLabel, cls: "mod-cta" });
		checkBtn.addEventListener("click", () => {
			void (async () => {
				checkBtn.disabled = true;
				checkBtn.setText(textGraded ? t().checking : t().running);
				if (isPython && !textGraded && !isPyodideReady()) {
					new Notice(t().loadingPython, 6000);
				}
				try {
					const runner = getRunner(card.lang, this.plugin.runnerOptions());
					this.outcome = await gradeAnswers(card, this.answers, runner, this.plugin.execTimeoutMs);
					this.renderResults(results, controls);
				} catch (e) {
					new Notice(t().runFailed(String(e)));
				} finally {
					checkBtn.disabled = false;
					checkBtn.setText(checkLabel);
				}
			})();
		});

		const revealBtn = controls.createEl("button", { text: t().reveal });
		revealBtn.addEventListener("click", () => {
			results.empty();
			results.createEl("p", { cls: "cr-label", text: t().referenceSolution });
			const box = results.createEl("div", { cls: "cr-code" });
			void this.renderCode(box, card.solution, card.lang);
			this.renderGradeButtons(controls, null);
		});
	}

	private renderResults(container: HTMLElement, controls: HTMLElement): void {
		container.empty();
		const outcome = this.outcome;
		if (!outcome) return;

		const m = t();
		if (outcome.grading === "tests" && outcome.entry === null && outcome.results.every((r) => r.error)) {
			container.createEl("p", { cls: "cr-warn", text: outcome.results[0]?.error ?? m.couldNotRun });
		}

		const isText = outcome.grading === "text";
		for (const r of outcome.results) {
			const row = container.createEl("div", { cls: `cr-test ${r.pass ? "cr-pass" : "cr-fail"}` });
			const head = row.createEl("div", { cls: "cr-test-head" });
			head.createEl("span", { cls: "cr-mark", text: r.pass ? "✓" : "✗" });
			head.createEl("code", { text: isText ? r.input : m.inLabel(r.input) });
			if (r.error) {
				row.createEl("div", { cls: "cr-err", text: r.error });
			} else {
				row.createEl("div", { cls: "cr-kv", text: m.expectedLabel(r.expected) });
				row.createEl("div", { cls: "cr-kv", text: isText ? m.youLabel(r.actual ?? "") : m.gotLabel(r.actual ?? "") });
			}
		}

		if (outcome.results.length === 0) {
			container.createEl("p", { cls: "cr-label", text: m.nothingToCheck });
			this.renderGradeButtons(controls, null);
			return;
		}

		const passed = outcome.results.filter((r) => r.pass).length;
		container.createEl("p", { cls: "cr-summary", text: m.summary(passed, outcome.results.length, isText) });
		this.renderGradeButtons(controls, outcome.quality);
	}

	/** `autoQuality` null → manual self-grade; otherwise show the auto verdict + override. */
	private renderGradeButtons(controls: HTMLElement, autoQuality: number | null): void {
		controls.empty();
		const btn = (label: string, q: number, cta = false) => {
			const b = controls.createEl("button", { text: label, cls: cta ? "mod-cta" : "" });
			b.addEventListener("click", () => {
				void this.grade(q);
			});
		};

		const m = t();
		if (autoQuality === null) {
			btn(m.again, 1);
			btn(m.hard, 3);
			btn(m.good, 4, true);
			btn(m.easy, 5);
			return;
		}

		const verdict = autoQuality >= 5 ? m.verdictAllPassed : autoQuality >= 3 ? m.verdictPartial : m.verdictFailed;
		controls.createEl("span", { cls: "cr-verdict", text: m.autoVerdict(verdict) });
		btn(m.continueVerdict(verdict), autoQuality, true);
		btn(m.overrideAgain, 1);
		btn(m.overrideGood, 4);
	}

	private async grade(quality: number): Promise<void> {
		const card = this.card;
		if (!card) return;
		const now = Date.now();
		this.plugin.store.set(card.id, review(this.plugin.store.get(card.id, now), quality, now));
		await this.plugin.store.save();
		this.reviewed += 1;
		this.index += 1;
		this.renderCard();
	}

	private renderDone(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: t().reviewComplete });
		contentEl.createEl("p", { text: t().reviewedCount(this.reviewed) });
		const close = contentEl.createEl("button", { text: t().close, cls: "mod-cta" });
		close.addEventListener("click", () => this.close());
	}
}
