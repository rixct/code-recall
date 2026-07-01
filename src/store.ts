import { initialState } from "./scheduler";
import type { ReviewState } from "./types";

/**
 * Holds per-card SM-2 state, keyed by the content-stable card id. Persistence
 * is delegated to a callback so the plugin can write states and settings into
 * a single data.json object without either clobbering the other.
 */
export class ReviewStore {
	private states: Record<string, ReviewState> = {};

	constructor(private readonly persist: () => Promise<void>) {}

	/** Seed from loaded data. */
	loadStates(states: Record<string, ReviewState> | undefined | null): void {
		this.states = states ?? {};
	}

	/** The raw state map, for serialization by the plugin. */
	serialize(): Record<string, ReviewState> {
		return this.states;
	}

	async save(): Promise<void> {
		await this.persist();
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
