# CodeRecall

> Anki + LeetCode inside Obsidian — spaced repetition for code, with automatic grading.

**Русская версия → [README.ru.md](README.ru.md)**

---

## What it is

CodeRecall turns code blocks in your [Obsidian](https://obsidian.md) notes into
spaced-repetition cards. You hide part of the code, and during review you retype
it from memory. Instead of "reveal → grade yourself", the plugin **runs your
code** against test cases and grades you automatically — a card counts as
recalled only if your code actually works.

Cards without tests (or without a language) are checked by **comparing your text
to the hidden answer**, so it works for plain snippets and prose too.

## A card

`{{c1::…}}` is a cloze deletion — the fragment that gets hidden during review.

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
    ```

During review the hidden part becomes an input box. You type your answer, hit
**Run & check**, and the plugin runs the tests in a sandbox and shows pass/fail.

## Card format

A card is one fenced block with the `coderecall` info string; the body is YAML:

| Field | Required | Meaning |
|---|---|---|
| `code` | yes | Your code, with one or more `{{cN::…}}` cloze deletions. |
| `lang` | no | Language id (`python`, `javascript`, `c++`, `java`). **Omit it** for a plain text/prose card that's graded by comparison, not execution. |
| `tests` | no | List of `{ in, out }` pairs. **No tests → the card is graded by comparing your answer to the hidden text.** |
| `name` | no | A label shown in the review view. |
| `entry` | no | Entry function to call in tests (inferred if absent). |
| `mode` | no | `call` (invoke the entry function, compare its return) or `stdio` (pipe `in` to stdin, compare stdout). Defaults: `call` for JS/Python, `stdio` for C++/Java. |
| `id` | no | Stable id override (defaults to a content hash). |

Instead of an inline `code: |` block, you can separate **header / code / tests**
with `---` lines — then the code is taken verbatim, indentation and tabs and all:

    ```coderecall
    name: Capital of France
    ---
    The capital of France is {{c1::Paris}}.
    ```

That card has no `lang` and no `tests`, so it's graded by text: your answer is
compared to the hidden content, **ignoring whitespace** (`print(x + y)` and
`print(x+y)` both match a hidden `print(x + y)`).

**Cloze syntax:** `{{cN::hidden}}` hides `hidden` as group *N*; the first
unescaped `}}` closes it. To use a literal `{{` or `}}` inside hidden content,
escape it as `\{{` / `\}}` — every other backslash (`\n`, `\\`) is left as-is.

## Languages

| Language | Runner | Notes |
|---|---|---|
| JavaScript | Web Worker | offline, `call` mode |
| Python | Pyodide (WASM) | downloads once on first run, `call` mode |
| C++ | local g++/clang++ | full STL, `stdio` mode; JSCPP fallback (no STL) if no compiler |
| Java | local JDK 11+ | `stdio` mode, single-file launcher |

C++/Java run real programs on your machine via local toolchains, so the plugin
is **desktop-only** — toggle **Native execution** in settings and only review
notes you trust. Syntax highlighting works for these plus any language Obsidian
knows (TypeScript, Go, Rust, …), even if it can't be executed.

## Review and grading

Run **Review current note** (ribbon brain icon or command). For each card:

- **Run & check / Check** — grades your answer (runs the tests, or compares text
  for tests-less cards) and shows the result. This doesn't change the schedule.
- **Reveal answer** — shows the reference solution and switches to manual grading.
- After a run you get an auto-verdict — **Continue (all passed / partial /
  failed)** applies quality 5 / 3 / 1, with **Override** buttons to overrule it.
  When you reveal or self-grade, pick **Again / Hard / Good / Easy**.

Each grade drives the SM-2 schedule stored in `data.json`:

| Button | Quality | Effect |
|---|---|---|
| Again | 1 | Lapse: streak resets, due again in 1 day |
| Hard | 3 | Pass, ease −0.14 (intervals grow slower) |
| Good | 4 | Pass, ease unchanged |
| Easy | 5 | Pass, ease +0.10 (intervals grow faster) |

A passing streak schedules the next review at **1 day → 6 days → previous ×
ease** (ease starts at 2.5, floored at 1.3).

## Language / localization

CodeRecall's interface is available in **English** and **Russian**. It follows
Obsidian's UI language automatically; you can force a language under
**Settings → CodeRecall → Language** (Auto / English / Русский).

## Install

Not in Community Plugins yet. To run it manually, build (below) and copy
`manifest.json`, `main.js` and `styles.css` into
`<vault>/.obsidian/plugins/coderecall/`, then enable the plugin. A ready-made
deck to try lives in [examples/sample-deck.md](examples/sample-deck.md).

## Development

```bash
npm install
npm run dev     # build in watch mode
npm test        # unit tests (vitest)
npm run build   # type-check + production bundle
```

## License

MIT — see [LICENSE](LICENSE).

## Credits

- [obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition)
- [obsidian-execute-code](https://github.com/twibiral/obsidian-execute-code)
- The SM-2 algorithm (SuperMemo)
