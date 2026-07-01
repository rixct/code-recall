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
- **`tests`** (optional) — a list of `{ in, out }` pairs.
- **`name`** / **`entry`** / **`id`** (optional) — label, entry-function override,
  stable id override.
- **`mode`** (optional) — `call` (default for JS/Python: invoke the entry
  function with JSON args, compare its return) or `stdio` (default for C++/Java:
  pipe `in` to stdin, compare stdout).

The recommended layout separates **header / code / tests** with `---` lines so
the code is taken verbatim (indentation and tabs preserved); an inline
`code: |` block scalar also works.

Languages:

- **JavaScript** — Web Worker, offline (`call` mode).
- **Python** — Pyodide/WASM, downloads once (`call` mode).
- **C++** — compiled with your local **g++/clang++** for full STL (`stdio` mode).
  Without a compiler it falls back to the bundled JSCPP interpreter (no STL).
- **Java** — runs via your local **JDK 11+** single-file mode (`stdio` mode).

C++/Java use native toolchains via Node, so the plugin is **desktop-only**, and
running them executes real programs on your machine — toggle **Native execution**
in settings and only review notes you trust.

Cloze syntax: `{{cN::hidden}}` hides `hidden` as group *N*. The first unescaped
`}}` closes it. To put a literal `{{` or `}}` inside hidden content (an f-string,
a dict literal ending a line), escape it as `\{{` / `\}}`; every other backslash
(`\n`, `\\`) is left as-is. Nested, empty and unclosed clozes are reported as
errors.

In reading and Live-Preview mode, a `coderecall` block renders as a compact card
with the code section syntax-highlighted (per the card's `lang`). Highlighting
can be toggled in **Settings → CodeRecall**.

## Status

**MVP.** The full loop works: parse cards → hide code → type your answer → run it
in a sandbox → auto-grade against tests → schedule with SM-2. See
[ROADMAP.md](ROADMAP.md) for what's next (vault-wide "due today" queue, stats).

## Features

- [x] Parsing cloze deletions in code blocks (`{{c1::...}}`)
- [x] Safe execution sandbox (JS in a Web Worker with a hard timeout; Python via Pyodide/WASM)
- [x] Test-case system (input → expected output) with structural comparison
- [x] SM-2 scheduler with per-card state persisted in `data.json`
- [x] Review mode (modal with an input per cloze, "Run & check", auto-verdict)
- [x] Multi-language: JavaScript (offline), Python (Pyodide), C++ & Java (native compilers)
- [x] Syntax highlighting for code (js/python/c++/java/…), toggleable in settings
- [ ] Stats and a vault-wide "due today" queue

## Supported languages

| Language | Runner | Notes |
|---|---|---|
| JavaScript | Web Worker | offline, `call` mode |
| Python | Pyodide (WASM) | downloads once on first run, `call` mode |
| C++ | local g++/clang++ | full STL, `stdio` mode; JSCPP fallback (no STL) if no compiler |
| Java | local JDK 11+ | `stdio` mode, single-file launcher |

Syntax highlighting works for these plus any language Obsidian knows (TypeScript,
Go, Rust, …), even if it can't be executed yet.

## Review and grading

Run **Review current note** (ribbon icon or command). Each due card shows the
code with the hidden part blanked and a text box per cloze.

- **Run & check** — substitutes your answer, runs every test in the sandbox, and
  shows per-test pass/fail (expected vs got). This only *checks* — it does not
  change the schedule.
- **Reveal answer** — shows the reference solution and switches to manual grading.
- After a run an auto-verdict appears: **Continue (all passed / partial / failed)**
  applies quality 5 / 3 / 1; **Override: Again** (1) or **Override: Good** (4)
  overrule it.
- After Reveal, or when a card has no tests, you self-grade: **Again / Hard /
  Good / Easy**.

What each grade does to the SM-2 schedule (stored in `data.json`):

| Button | Quality | Effect |
|---|---|---|
| Again | 1 | Lapse: streak resets, due again in **1 day**, lapse count +1 |
| Hard | 3 | Pass, but **ease −0.14** → future intervals grow slower |
| Good | 4 | Pass, ease unchanged |
| Easy | 5 | Pass, **ease +0.10** → future intervals grow faster |

A passing streak schedules the next review at **1 day → 6 days → previous ×
ease** (ease starts at 2.5, floored at 1.3). "Continue" simply applies the
auto-verdict's quality, so you usually never touch the schedule by hand.

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
