import { describe, expect, it } from "vitest";
import { DAY_MS, initialState, isDue, review } from "./scheduler";

const NOW = 1_000_000_000_000;

describe("scheduler (SM-2)", () => {
	it("starts due immediately", () => {
		const s = initialState(NOW);
		expect(isDue(s, NOW)).toBe(true);
		expect(s.reps).toBe(0);
	});

	it("grows intervals on consecutive good grades: 1 → 6 → ~15 days", () => {
		let s = initialState(NOW);
		s = review(s, 5, NOW);
		expect(s.intervalDays).toBe(1);
		s = review(s, 5, NOW);
		expect(s.intervalDays).toBe(6);
		s = review(s, 5, NOW);
		expect(s.intervalDays).toBeGreaterThan(6); // 6 * ease
		expect(s.reps).toBe(3);
		expect(isDue(s, NOW)).toBe(false);
		expect(s.due).toBe(NOW + s.intervalDays * DAY_MS);
	});

	it("resets and counts a lapse on a failing grade", () => {
		let s = initialState(NOW);
		s = review(s, 5, NOW);
		s = review(s, 5, NOW); // interval 6, reps 2
		s = review(s, 1, NOW); // fail
		expect(s.reps).toBe(0);
		expect(s.intervalDays).toBe(1);
		expect(s.lapses).toBe(1);
	});

	it("never lets ease drop below 1.3", () => {
		let s = initialState(NOW);
		for (let i = 0; i < 10; i++) s = review(s, 3, NOW);
		expect(s.ease).toBeGreaterThanOrEqual(1.3);
	});
});
