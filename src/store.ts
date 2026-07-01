import type { Plugin } from "obsidian";
import { initialState } from "./scheduler";
import type { ReviewState } from "./types";

interface PersistShape {
	version: number;
	states: Record<string, ReviewState>;
}

/**
 * Persists per-card SM-2 state in the plugin's data.json
 * (via Obsidian's loadData/saveData). Keyed by the content-stable card id.
 */
export class ReviewStore {
	private states: Record<string, ReviewState> = {};

	constructor(private readonly plugin: Plugin) {}

	async load(): Promise<void> {
		const data = (await this.plugin.loadData()) as PersistShape | null;
		this.states = data?.states ?? {};
	}

	async save(): Promise<void> {
		await this.plugin.saveData({ version: 1, states: this.states } satisfies PersistShape);
	}

	/** Current state for a card, or a fresh (due-now) state if never reviewed. */
	get(id: string, now: number): ReviewState {
		return this.states[id] ?? initialState(now);
	}

	has(id: string): boolean {
		return id in this.states;
	}

	set(id: string, state: ReviewState): void {
		this.states[id] = state;
	}
}
