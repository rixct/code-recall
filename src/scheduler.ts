import type { ReviewState } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Fresh state for a card that has never been reviewed — due immediately. */
export function initialState(now: number): ReviewState {
	return { ease: 2.5, intervalDays: 0, reps: 0, due: now, last: 0, lapses: 0 };
}

/** Is the card due for review at `now`? */
export function isDue(state: ReviewState, now: number): boolean {
	return state.due <= now;
}

/**
 * Apply one SM-2 review. `quality` is 0–5 (derived from auto-grading):
 * < 3 is a lapse — repetitions reset and the card comes back tomorrow.
 * See https://super-memory.com/english/ol/sm2.htm.
 */
export function review(state: ReviewState, quality: number, now: number): ReviewState {
	const q = Math.max(0, Math.min(5, Math.round(quality)));
	let { ease, intervalDays, reps, lapses } = state;

	if (q < 3) {
		reps = 0;
		intervalDays = 1;
		lapses += 1;
	} else {
		reps += 1;
		if (reps === 1) intervalDays = 1;
		else if (reps === 2) intervalDays = 6;
		else intervalDays = Math.round(intervalDays * ease);

		ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
		if (ease < 1.3) ease = 1.3;
	}

	return {
		ease,
		intervalDays,
		reps,
		due: now + intervalDays * DAY_MS,
		last: now,
		lapses,
	};
}
