import { type MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer, Notice, Plugin } from "obsidian";
import { codeFenceBlock } from "./highlight";
import { parseCards, parseSingleCard } from "./parser";
import { isDue } from "./scheduler";
import { type CodeRecallSettings, DEFAULT_SETTINGS } from "./settings";
import { ReviewStore } from "./store";
import { CodeRecallSettingTab } from "./ui/SettingsTab";
import { ReviewModal } from "./ui/ReviewModal";
import type { Card, ReviewState, RunnerOptions } from "./types";

/** Hard cap on how long a single test may run before it's killed. */
const EXEC_TIMEOUT_MS = 3000;

/** Shape of the plugin's data.json. */
interface PersistShape {
	version: number;
	settings: CodeRecallSettings;
	states: Record<string, ReviewState>;
}

/**
 * CodeRecall — MVP.
 *
 * Parses ```coderecall cards, runs the hidden code in a sandbox, auto-grades it
 * against the card's tests, and schedules reviews with SM-2.
 */
export default class CodeRecallPlugin extends Plugin {
	settings: CodeRecallSettings = { ...DEFAULT_SETTINGS };
	store!: ReviewStore;
	readonly execTimeoutMs = EXEC_TIMEOUT_MS;

	async onload(): Promise<void> {
		console.log("CodeRecall: loading plugin (build: 1.0.3, langs: js/python/c++/java)");

		this.store = new ReviewStore(() => this.saveData(this.serialize()));
		const data = (await this.loadData()) as Partial<PersistShape> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) };
		this.store.loadStates(data?.states);

		this.addSettingTab(new CodeRecallSettingTab(this.app, this));

		// Render ```coderecall blocks in notes: show the code section highlighted.
		this.registerMarkdownCodeBlockProcessor("coderecall", (source, el, ctx) => {
			this.renderCardEmbed(source, el, ctx);
		});

		this.addRibbonIcon("brain-circuit", "CodeRecall: review current note", () => {
			void this.reviewActiveNote();
		});

		this.addCommand({
			id: "review-current-note",
			name: "Review current note",
			callback: () => void this.reviewActiveNote(),
		});

		this.addCommand({
			id: "scan-active-note",
			name: "Scan active note for cards",
			callback: () => void this.scanActiveNote(),
		});
	}

	onunload(): void {
		console.log("CodeRecall: unloading plugin");
	}

	/** Persist settings + review state together. */
	async saveSettings(): Promise<void> {
		await this.saveData(this.serialize());
	}

	/** Execution options passed to native runners. */
	runnerOptions(): RunnerOptions {
		return { nativeExecution: this.settings.nativeExecution, cppCompiler: this.settings.cppCompiler };
	}

	/** Render one ```coderecall block in a note as a highlighted code card. */
	private renderCardEmbed(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		el.addClass("coderecall-embed");
		const { card, error } = parseSingleCard(source, ctx.sourcePath);
		if (error || !card) {
			el.createEl("div", {
				cls: "coderecall-embed-error",
				text: `CodeRecall — can't parse this card: ${error?.message ?? "invalid"}`,
			});
			return;
		}

		const head = el.createEl("div", { cls: "cr-embed-head" });
		head.createEl("span", { cls: "cr-badge", text: card.lang });
		if (card.name) head.createEl("span", { cls: "cr-embed-name", text: card.name });
		head.createEl("span", {
			cls: "cr-embed-meta",
			text: `${card.clozes.length} cloze · ${card.tests.length} test(s)`,
		});

		// The code the user wrote (with {{cN::…}} markers), syntax-highlighted.
		const codeBox = el.createEl("div", { cls: "cr-code" });
		if (this.settings.syntaxHighlight) {
			// Tie rendered children to this element's lifecycle (not the plugin's).
			const child = new MarkdownRenderChild(el);
			ctx.addChild(child);
			void MarkdownRenderer.render(this.app, codeFenceBlock(card.lang, card.code), codeBox, ctx.sourcePath, child);
		} else {
			codeBox.createEl("pre").createEl("code", { text: card.code });
		}
	}

	private serialize(): PersistShape {
		return { version: 1, settings: this.settings, states: this.store.serialize() };
	}

	/** Parse the active note and report how many cards / errors it has. */
	private async scanActiveNote(): Promise<void> {
		const cards = await this.cardsInActiveNote();
		if (cards === null) return;
		new Notice(`CodeRecall: found ${cards.length} card(s) in this note`);
	}

	/** Open a review session for the due cards in the active note. */
	private async reviewActiveNote(): Promise<void> {
		const cards = await this.cardsInActiveNote();
		if (cards === null) return;
		if (cards.length === 0) {
			new Notice("CodeRecall: no cards in this note");
			return;
		}

		const now = Date.now();
		let queue = cards.filter((c) => isDue(this.store.get(c.id, now), now));
		if (queue.length === 0) {
			new Notice("CodeRecall: nothing due — reviewing all cards");
			queue = cards;
		}

		new ReviewModal(this, queue).open();
	}

	/** Parse cards from the active note, surfacing parse errors as notices. */
	private async cardsInActiveNote(): Promise<Card[] | null> {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("CodeRecall: no active note");
			return null;
		}
		const content = await this.app.vault.read(file);
		const { cards, errors } = parseCards(content, file.path);
		if (errors.length > 0) {
			console.warn("CodeRecall: parse errors", errors);
			const first = errors[0];
			new Notice(
				`CodeRecall: ${errors.length} card(s) failed to parse.\n` +
					`Line ${first.lineStart + 1}: ${first.message}`,
				10000,
			);
		}
		return cards;
	}
}
