# CodeRecall

> Anki + LeetCode inside Obsidian. Active recall for code, with auto-grading.

**Русская версия → [README.ru.md](README.ru.md)**

---

## What it is

CodeRecall is a plugin for [Obsidian](https://obsidian.md) that turns code blocks
in your notes into spaced-repetition cards — but instead of the usual "reveal the
answer → grade yourself", it does **automatic grading**.

You hide part of the code (a cloze deletion), and during review:

1. you retype the hidden fragment from memory;
2. the plugin **actually executes** your version (same idea as Execute Code);
3. it checks the output against reference test cases;
4. based on pass/fail, an SM-2 scheduler picks the next review date.

This is auto-graded active recall: a card counts as recalled only if your code
truly works — not because you told yourself "I remember it".

## Why (the gap)

- The **Spaced Repetition** plugin only does text cards. No execution, no code
  grading. Honesty of self-assessment is on the user.
- The **Execute Code** plugin can run code inside a note, but it is not tied to
  memory or review at all.

Nobody has connected the two. CodeRecall fills that gap: **memory + execution +
auto-grading** in one place.

The audience is broader than sysadmins (Execute Code's niche) — it's everyone
learning algorithms, language syntax, APIs, patterns: students, juniors,
interview preppers, career switchers.

## What a card looks like

Example: a card with a hidden function body. `{{c1::...}}` is a cloze deletion
(the fragment that gets hidden).

    ```coderecall
    lang: python
    name: Two Sum
    code: |
      def two_sum(nums, target):
          seen = {}
          {{c1::for i, n in enumerate(nums):
              if target - n in seen:
                  return [seen[target - n], i]
              seen[n] = i}}
    tests:
      - in: "[[2, 7, 11, 15], 9]"
        out: "[0, 1]"
      - in: "[[3, 2, 4], 6]"
        out: "[1, 2]"

During review the hidden part becomes an input field. You write the code → hit
"Check" → the plugin runs the test cases in a sandbox → shows pass/fail and
updates the schedule.

### Card format

A card is a single fenced block with the `coderecall` info string. Its body is
YAML:

- **`lang`** (required) — language id, e.g. `python`, `javascript`.
- **`code`** (required) — a YAML block scalar (`code: |`) holding your code with
  one or more cloze deletions.
- **`tests`** (optional) — a list of `{ in, out }` pairs (used from Phase 4 on).
- **`name`** / **`id`** (optional) — a label and a stable id override.

- **`mode`** (optional) — `call` (default for JS/Python: invoke the entry
  function with JSON args, compare its return) or `stdio` (default for C++: pipe
  `in` to stdin, compare stdout). See the C++ card in the sample deck.

Languages: **JavaScript** (Web Worker, offline), **Python** (Pyodide/WASM,
downloads once), **C++** (JSCPP — a JS interpreter, offline; core C++ +
iostream/cstdio/cmath/cstring/cctype, **no STL** containers).

Cloze syntax: `{{cN::hidden}}` hides `hidden` as group *N*. The first unescaped
`}}` closes it. To put a literal `{{` or `}}` inside hidden content (an f-string,
a dict literal ending a line), escape it as `\{{` / `\}}`; every other backslash
(`\n`, `\\`) is left as-is. Nested, empty and unclosed clozes are reported as
errors.

## Status

🚀 **MVP works.** The full loop is implemented: parse cards → hide code → type
your answer → run it in a sandbox → auto-grade against tests → schedule with
SM-2. JavaScript runs offline; Python runs via Pyodide (downloads once). See the
[ROADMAP.md](ROADMAP.md) for what's next (syntax highlighting, vault-wide queue,
stats, more languages).

## Features

- [x] Parsing cloze deletions in code blocks (`{{c1::...}}`)
- [x] Safe execution sandbox (JS in a Web Worker with a hard timeout; Python via Pyodide/WASM)
- [x] Test-case system (input → expected output) with structural comparison
- [x] SM-2 scheduler with per-card state persisted in `data.json`
- [x] Review mode (modal with an input per cloze, "Run & check", auto-verdict)
- [x] Multi-language: JavaScript (offline), Python (Pyodide), C++ (JSCPP, offline)
- [ ] Stats and a vault-wide "due today" queue

## Language support (priority)

1. **Python** — the most common language for algorithms/interviews.
2. **JavaScript / TypeScript** — can run directly in the Obsidian runtime.
3. Later — Go, Rust, Java on demand.

## Security

Running code — yours or otherwise — is a risk. The sandbox approach is described
in [ROADMAP.md](ROADMAP.md#security--sandbox). In short: isolation is mandatory;
we will not run arbitrary code without a sandbox.

## Installation

Not published yet. After the MVP — via BRAT or Community Plugins.

## Development

```bash
npm install
npm run dev     # build in watch mode
npm test        # run the parser unit tests (vitest)
npm run build   # type-check + production bundle
```

Then symlink/copy `manifest.json`, `main.js` and `styles.css` into
`<vault>/.obsidian/plugins/coderecall/` and enable the plugin.

## Using it

1. Copy [examples/sample-deck.md](examples/sample-deck.md) into your vault and
   open it (or write your own `coderecall` block).
2. Run **"CodeRecall: Review current note"** — the brain icon in the left ribbon,
   or the Command palette.
3. For each card: type the hidden code into the box, click **Run & check**. You
   get per-test pass/fail with expected-vs-got, then pick a grade
   (or accept the auto verdict) — SM-2 sets the next due date.

Commands: **Review current note** and **Scan active note for cards** (a dry-run
that just reports how many cards parse). Review state lives in the plugin's
`data.json`. The first JavaScript card works with no internet; the Python card
downloads Pyodide on first run.

## License

MIT (see [LICENSE](LICENSE) — to be added).

## Credits / inspiration

- [obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition)
- [obsidian-execute-code](https://github.com/twibiral/obsidian-execute-code)
- The SM-2 algorithm (SuperMemo)
