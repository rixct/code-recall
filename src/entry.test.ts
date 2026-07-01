import { describe, expect, it } from "vitest";
import { detectEntry } from "./entry";

describe("detectEntry", () => {
	it("finds a python def", () => {
		expect(detectEntry("python", "def two_sum(nums, target):\n    return []")).toBe("two_sum");
	});

	it("finds a js function declaration", () => {
		expect(detectEntry("javascript", "function reverse(s) { return s; }")).toBe("reverse");
	});

	it("finds a js arrow assigned to a const", () => {
		expect(detectEntry("js", "const add = (a, b) => a + b;")).toBe("add");
	});

	it("returns null for unknown languages", () => {
		expect(detectEntry("ruby", "def foo; end")).toBeNull();
	});
});
