import { Notice, Plugin } from "obsidian";
import { parseCards } from "./parser";
import { isDue } from "./scheduler";
import { ReviewStore } from "./store";
import { ReviewModal } from "./ui/ReviewModal";
import type { Card } from "./types";

/** Hard cap on how long a single test may run before it's killed. */
const EXEC_TIMEOUT_MS = 3000;

/**
 * CodeRecall — MVP.
 *
 * Parses ```coderecall cards, runs the hidden code in a sandbox, auto-grades it
 * against the card's tests, and schedules reviews with SM-2.
 */
export default class CodeRecallPlugin extends Plugin {
	private store!: ReviewStore;

	async onload(): Promise<void> {
		console.log("CodeRecall: loading plugin (build: sectioned-1, langs: js/python/c++)");
		this.store = new ReviewStore(this);
		await this.store.load();

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

		new ReviewModal(this.app, queue, this.store, EXEC_TIMEOUT_MS).open();
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
