# CoolSheet PVT thesis — handover brief

## What this is

Michael Lo Russo's UNSW Thesis C report: *Development and Evaluation of an Industry-Specific
Hourly Techno-Economic Decision-Support Tool for Photovoltaic-Thermal Systems*.

The report documents **this codebase** — the CoolSheet PVT Calculator. You have both the
repository and the report, so you can do something a chat with only one of them cannot:
check that the report describes what the software actually does.

## Files

| File | What it is |
|---|---|
| `main.tex` | The entire report. Single file — no `\input`, no `.bib`, all figures inline TikZ. |
| `main.pdf` | Current compiled output. |
| `CLAIMS-TO-VERIFY.md` | 64 checkable claims + 8 values to extract. Start here. |
| `media/media/image1.png` | Cover-page logo — the only real image. |

If a Mini Overleaf app is running locally, compile with
`POST http://localhost:4321/api/compile`, then poll `/api/state` and read `/api/log`.
Otherwise use pdflatex twice (needs two passes for refs/ToC).

---

## Three workstreams

### 1. Code ↔ report verification — highest value, do first

Work through `CLAIMS-TO-VERIFY.md`. **Correct the report, never the code.** If the code
disagrees with the report, the report is wrong.

Part 2 of that file lists values that were deliberately cut from the body and belong in
**Appendix A** (input register, model coefficients, solver config) and **Appendix C**
(LCOE/LCOH derivation, cost allocation, worked example) — both unwritten. Extracting those
from the code is a deliverable, not just a check.

### 2. Reference verification

**Already done (27 July 2026):** all 48 entries were checked against the published record —
author lists, titles, volumes, article numbers, DOIs, URLs. Four errors were found and fixed
(a missing first author on [15]; three titles that had drifted from the published wording).
There's a note recording this in the reference list — delete it before submission.

So **don't re-verify all 48 from scratch** unless you have reason to doubt something. What is
genuinely open:

- **[6]** Fu's thesis — exact title needs confirming with the author.
- **[37]** CoolSheet repo — version and commit hash to be added once case studies are final.
- Any reference **you add** must be verified before it goes in.

Standing rule for this document: **every reference must be real and personally verified.**
If you cannot confirm a source exists, do not cite it — say so instead. Reproduce published
titles **exactly**, including awkward grammar (ref [10]'s title is ungrammatical as published;
that is deliberate, do not "fix" it).

Gaps worth filling if you find good sources: III.G's remaining industries (brewery, hotel,
aquatic centre, commercial laundry) will each need Australian benchmark support comparable to
the dairy model's [47] and [48].

### 3. Writing and structure

Ordinary thesis-quality work: clarity, flow, hedging that's too strong or too weak, claims
that outrun the evidence, sections that repeat each other.

**The binding constraint is length.** See below — this is currently the project's main problem.

---

## Hard constraints

- **50-page limit on the body** (Introduction → Conclusions). Cover, abstract,
  acknowledgements, nomenclature, contents, lists of figures/tables, references and
  appendices are all **excluded**.
- **Current state: 39/50 used.**
- Remaining to write: **III.G.2–G.5** (brewery, hotel, aquatic centre, laundry) and
  **most of Chapter IV** (eight subsections including two full case studies).
- The dairy model (III.G.1) alone consumed **3 pages**. Four more industries at that length
  would exhaust the budget before Chapter IV starts. **They must be substantially shorter.**
- A purple page-budget table sits at the end of the Contents. It's a working aid —
  marked DELETE BEFORE SUBMISSION, along with the `\pagebudgettable` macro and its
  `\addtocontents` call.

Anything that adds body pages needs a corresponding cut. Appendices are free — push detail there.

---

## Document conventions — read before editing

These will look like mistakes if you don't know about them.

**Citations.** Custom macros, not BibTeX:
- In text: `\textsuperscript{\citenum{12}}`, or `\textsuperscript{\citenum{4},\citenum{7}}` for multiples.
- In the list: `\refentry{\textsuperscript{\refanchor{12}}Author, ...}`.
- `\citenum` and `\refanchor` must pair exactly — every N cited needs an entry and vice versa.
- Renumbering means a **single-pass regex over both macros** together. Doing them separately,
  or running two passes, silently double-shifts.
- Groups are introduced with `\referenceheading{Topic (cited in II.C)}` — update the section
  list in the heading if citation locations change.

**Tables are numbered by hand.** Each has `\renewcommand{\thetable}{N}`. This is deliberate:
the Nomenclature's three `longtable`s advance the counter invisibly, so automatic numbering
is wrong. Inserting a table means renumbering every later one. Currently 1–10 in reading order.

**Figures are auto-numbered** — don't hardcode these. Currently 1–7, all TikZ.

**Progress markers.** `\subsection[Title\done]{Title}` puts a green tick in the Contents to
mark a finished section. Unticked = not yet written. Keep this accurate; it drives the
progress panel in the local preview app.

**Placeholders.** `\placeholder{...}` renders grey-highlighted. Used for TODOs, figure specs
and notes to self. All must be gone before submission.

**Style:** Australian/British spelling (normalised, modelling, utilised — not -ize/-ized).
Past tense for what was done, present for what the software does. Sentence case in reference
titles. `\path{}` for filenames.

**LaTeX traps already hit in this project** — don't reintroduce:
- `%` inside `\url{}` (e.g. `%20`) starts a comment and causes a runaway-argument fatal error.
- Naming a TikZ style `out` collides with the built-in `out` key → pgfkeys error.
- TikZ key values containing `=` must be braced: `execute at begin node={\hyphenpenalty=10000}`.
- `amsmath` and `xurl` are both required (align environments; breaking long reference URLs).
- Long bracketed number lists in math mode can't line-break — set them as plain text.

---

## How to work

1. Read `CLAIMS-TO-VERIFY.md` and the relevant code before changing any prose.
2. Compile after every substantive edit — don't batch up unverified changes.
3. After any citation edit, re-run the pairing check (cited vs listed, gaps, duplicates).
4. After any table edit, re-check `\renewcommand{\thetable}` runs 1..N in reading order.
5. Check the compiled PDF for `??` and watch the log for overfull boxes over ~10pt.
6. Report the body page count after anything that adds length.

Flag disagreements rather than quietly resolving them. If the code and the report conflict,
say so explicitly and propose the corrected wording — don't just overwrite one to match
the other.
