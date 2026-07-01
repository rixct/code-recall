import { execSync } from "child_process";
import { describe, expect, it } from "vitest";
import { buildProgram, compareOutputs, defaultMode, gradeAnswers, resultToQuality } from "./grader";
import { cppRunner } from "./runner/cpp";
import { makeNativeCppRunner } from "./runner/cppNative";
import { localJsRunner } from "./runner/localJs";
import type { Card } from "./types";

/** Detect a C++ compiler so the native test can be skipped where absent. */
const HAS_CPP = (() => {
	for (const c of ["g++", "clang++"]) {
		try {
			execSync(`${c} --version`, { stdio: "ignore" });
			return true;
		} catch {
			/* not available */
		}
	}
	return false;
})();

function jsCard(solution: string, clozeContent: string, tests: Card["tests"]): Card {
	const start = solution.indexOf(clozeContent);
	if (start < 0) throw new Error("cloze content not in solution");
	return {
		id: "t",
		filePath: "",
		lang: "javascript",
		code: solution,
		solution,
		template: solution.replace(clozeContent, "{{c1}}"),
		clozes: [{ group: 1, content: clozeContent, start, end: start + clozeContent.length }],
		groups: [1],
		tests,
		lineStart: 0,
		blockStart: 0,
		blockEnd: 0,
	};
}

describe("buildProgram", () => {
	it("substitutes the answer back into the cloze position", () => {
		const card = jsCard("function f() { return 1 + 1; }", "1 + 1", []);
		expect(buildProgram(card, ["2 + 3"])).toBe("function f() { return 2 + 3; }");
	});
});

describe("compareOutputs", () => {
	it("matches structurally regardless of whitespace/key order", () => {
		expect(compareOutputs("[0,1]", "[0, 1]")).toBe(true);
		expect(compareOutputs('{"a":1,"b":2}', '{"b": 2, "a": 1}')).toBe(true);
	});
	it("fails on different values", () => {
		expect(compareOutputs("[1,0]", "[0, 1]")).toBe(false);
	});
	it("falls back to trimmed string compare for non-JSON", () => {
		expect(compareOutputs("hello ", "hello")).toBe(true);
	});
});

describe("resultToQuality", () => {
	const r = (pass: boolean) => ({ input: "", expected: "", pass });
	it("maps all/partial/none pass to 5/3/1", () => {
		expect(resultToQuality([r(true), r(true)])).toBe(5);
		expect(resultToQuality([r(true), r(false)])).toBe(3);
		expect(resultToQuality([r(false), r(false)])).toBe(1);
	});
});

describe("gradeAnswers (end-to-end via local JS eval)", () => {
	const twoSum = jsCard(
		`function two_sum(nums, target) {
  const seen = {};
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (need in seen) return [seen[need], i];
    seen[nums[i]] = i;
  }
}`,
		`const seen = {};
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (need in seen) return [seen[need], i];
    seen[nums[i]] = i;
  }`,
		[
			{ input: "[[2,7,11,15], 9]", expected: "[0, 1]" },
			{ input: "[[3,2,4], 6]", expected: "[1, 2]" },
		],
	);

	it("passes all tests for a correct answer → quality 5", async () => {
		const answers = [twoSum.clozes[0].content];
		const out = await gradeAnswers(twoSum, answers, localJsRunner);
		expect(out.entry).toBe("two_sum");
		expect(out.results.every((r) => r.pass)).toBe(true);
		expect(out.quality).toBe(5);
	});

	it("fails for a wrong answer → quality 1", async () => {
		const out = await gradeAnswers(twoSum, ["return [0, 0];"], localJsRunner);
		expect(out.results.some((r) => r.pass)).toBe(false);
		expect(out.quality).toBe(1);
	});

	it("reports a runtime error as a failing test", async () => {
		const out = await gradeAnswers(twoSum, ["return nope.bad;"], localJsRunner);
		expect(out.results[0].pass).toBe(false);
		expect(out.results[0].error).toBeTruthy();
	});
});

describe("defaultMode", () => {
	it("uses stdio for C/C++ and call otherwise", () => {
		expect(defaultMode("c++")).toBe("stdio");
		expect(defaultMode("cpp")).toBe("stdio");
		expect(defaultMode("python")).toBe("call");
		expect(defaultMode("javascript")).toBe("call");
	});
});

describe("gradeAnswers — C++ via JSCPP (stdio mode)", () => {
	const solution = `#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    long sum = 0;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        sum += x;
    }
    cout << sum << endl;
    return 0;
}`;
	const clozeContent = "sum += x;";
	const start = solution.indexOf(clozeContent);
	const cppCard: Card = {
		id: "cpp",
		filePath: "",
		lang: "c++",
		mode: "stdio",
		code: solution,
		solution,
		template: solution.replace(clozeContent, "{{c1}}"),
		clozes: [{ group: 1, content: clozeContent, start, end: start + clozeContent.length }],
		groups: [1],
		tests: [
			{ input: "3\n1 2 3", expected: "6" },
			{ input: "4\n10 20 30 40", expected: "100" },
		],
		lineStart: 0,
		blockStart: 0,
		blockEnd: 0,
	};

	it("passes for the correct answer → quality 5", async () => {
		const out = await gradeAnswers(cppCard, [clozeContent], cppRunner);
		expect(out.results.map((r) => r.pass)).toEqual([true, true]);
		expect(out.quality).toBe(5);
	});

	it("fails for a wrong answer → quality 1", async () => {
		const out = await gradeAnswers(cppCard, ["sum -= x;"], cppRunner);
		expect(out.results.every((r) => r.pass)).toBe(false);
		expect(out.quality).toBe(1);
	});
});

describe("gradeAnswers — native C++ with full STL", () => {
	const solution = `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;
int main() {
    int n; cin >> n;
    vector<int> v(n);
    for (auto& x : v) cin >> x;
    sort(v.begin(), v.end());
    for (int x : v) cout << x << " ";
    cout << endl;
    return 0;
}`;
	const clozeContent = "sort(v.begin(), v.end());";
	const start = solution.indexOf(clozeContent);
	const stlCard: Card = {
		id: "stl",
		filePath: "",
		lang: "c++",
		mode: "stdio",
		code: solution,
		solution,
		template: solution.replace(clozeContent, "{{c1}}"),
		clozes: [{ group: 1, content: clozeContent, start, end: start + clozeContent.length }],
		groups: [1],
		tests: [{ input: "5\n3 1 2 3 1", expected: "1 1 2 3 3" }],
		lineStart: 0,
		blockStart: 0,
		blockEnd: 0,
	};

	it.skipIf(!HAS_CPP)(
		"compiles STL (vector, algorithm) with a real compiler → pass",
		async () => {
			const runner = makeNativeCppRunner({ nativeExecution: true });
			const out = await gradeAnswers(stlCard, [clozeContent], runner);
			expect(out.results[0].error).toBeUndefined();
			expect(out.results[0].pass).toBe(true);
			expect(out.quality).toBe(5);
		},
		30000,
	);
});
