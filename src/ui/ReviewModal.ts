import { Component, MarkdownRenderer, Modal, Notice } from "obsidian";
import { gradeAnswers } from "../grader";
import { codeFenceBlock } from "../highlight";
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

		contentEl.createEl("h2", { text: card.name ?? `Card ${this.index + 1}` });
		const meta = contentEl.createEl("div", { cls: "cr-meta" });
		meta.createEl("span", { cls: "cr-badge", text: card.lang });
		meta.createEl("span", { text: `${this.index + 1} / ${this.queue.length}` });

		if (!isSupportedLang(card.lang)) {
			contentEl.createEl("p", {
				cls: "cr-warn",
				text: `"${card.lang}" can't be auto-run yet — reveal the answer and self-grade.`,
			});
		}

		contentEl.createEl("p", { cls: "cr-label", text: "Fill in the hidden part(s):" });
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

		const isPython = ["python", "py"].includes(card.lang.toLowerCase());
		const checkBtn = controls.createEl("button", { text: "Run & check", cls: "mod-cta" });
		checkBtn.addEventListener("click", () => {
			void (async () => {
				checkBtn.disabled = true;
				checkBtn.setText("Running…");
				if (isPython && !isPyodideReady()) {
					new Notice("CodeRecall: loading Python runtime — first run downloads Pyodide (~10 MB).", 6000);
				}
				try {
					const runner = getRunner(card.lang, this.plugin.runnerOptions());
					this.outcome = await gradeAnswers(card, this.answers, runner, this.plugin.execTimeoutMs);
					this.renderResults(results, controls);
				} catch (e) {
					new Notice(`CodeRecall: run failed — ${String(e)}`);
				} finally {
					checkBtn.disabled = false;
					checkBtn.setText("Run & check");
				}
			})();
		});

		const revealBtn = controls.createEl("button", { text: "Reveal answer" });
		revealBtn.addEventListener("click", () => {
			results.empty();
			results.createEl("p", { cls: "cr-label", text: "Reference solution:" });
			const box = results.createEl("div", { cls: "cr-code" });
			void this.renderCode(box, card.solution, card.lang);
			this.renderGradeButtons(controls, null);
		});
	}

	private renderResults(container: HTMLElement, controls: HTMLElement): void {
		container.empty();
		const outcome = this.outcome;
		if (!outcome) return;

		if (outcome.entry === null && outcome.results.every((r) => r.error)) {
			container.createEl("p", { cls: "cr-warn", text: outcome.results[0]?.error ?? "Could not run." });
		}

		for (const r of outcome.results) {
			const row = container.createEl("div", { cls: `cr-test ${r.pass ? "cr-pass" : "cr-fail"}` });
			const head = row.createEl("div", { cls: "cr-test-head" });
			head.createEl("span", { cls: "cr-mark", text: r.pass ? "✓" : "✗" });
			head.createEl("code", { text: `in: ${r.input}` });
			if (r.error) {
				row.createEl("div", { cls: "cr-err", text: r.error });
			} else {
				row.createEl("div", { cls: "cr-kv", text: `expected: ${r.expected}` });
				row.createEl("div", { cls: "cr-kv", text: `got:      ${r.actual}` });
			}
		}

		if (outcome.results.length === 0) {
			container.createEl("p", { cls: "cr-label", text: "No tests on this card — self-grade below." });
			this.renderGradeButtons(controls, null);
			return;
		}

		const passed = outcome.results.filter((r) => r.pass).length;
		container.createEl("p", { cls: "cr-summary", text: `${passed}/${outcome.results.length} tests passed` });
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

		if (autoQuality === null) {
			btn("Again", 1);
			btn("Hard", 3);
			btn("Good", 4, true);
			btn("Easy", 5);
			return;
		}

		const verdict = autoQuality >= 5 ? "all passed" : autoQuality >= 3 ? "partial" : "failed";
		controls.createEl("span", { cls: "cr-verdict", text: `Auto: ${verdict}` });
		btn(`Continue (${verdict})`, autoQuality, true);
		btn("Override: Again", 1);
		btn("Override: Good", 4);
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
		contentEl.createEl("h2", { text: "Review complete" });
		contentEl.createEl("p", { text: `Reviewed ${this.reviewed} card(s).` });
		const close = contentEl.createEl("button", { text: "Close", cls: "mod-cta" });
		close.addEventListener("click", () => this.close());
	}
}
