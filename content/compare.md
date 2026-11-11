---
title: Comparison and limits
description: Where the spec family stands among spec-driven development, ADR enforcement, documentation checks, scoped agent work and import rules, and what its tools do not do.
order: 7
---

# Comparison and limits

The family's [overview]({{overview}}#neighbours) compares it with eleven
projects nearby. Each statement there about another project was read from
that project's own repository, documentation or registry entry on 2026-11-09,
and links to where it was read. Those projects change every week, so this
page does not repeat what the overview says of them: it names them, and says
what the spec family does in each area. Read the overview, and follow its
links, before relying on a comparison.

## Neighbours

| Area | Projects | What the spec family does there |
| --- | --- | --- |
| Spec-driven development | [Spec Kit](https://github.com/github/spec-kit), [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Keeps a specification true after it is written, deterministically, on every change. spec-graph reads the layouts Spec Kit, OpenSpec and Kiro write with no configuration ([layouts]({{ref:spec-graph}}/sdd-layouts.md)). |
| ADR enforcement | [Archgate](https://github.com/archgate/cli), [Mneme](https://github.com/MnemeHQ/mneme), [adrkit](https://github.com/mbeacom/adrkit) | A spec-guard rule is an HTML comment under the sentence it enforces, in the ADR itself, and is not run once the ADR is superseded ([document status]({{ref:spec-guard}}/document-status.md)); spec-graph holds the ADRs' lifecycle. An exception to a protected file counts only as a commit signed by a key the base branch's allowed signers list ([rulings]({{ref:spec-harness}}/rulings.md)). |
| Documentation checks | [DocGuard](https://github.com/raccioly/docguard), [ctxgrd](https://ctxgrd.aktagon.com/) | An `Implemented` claim needs a directive that counts a test by its name, which `spec-guard prove` shows can fail ([claims]({{ref:spec-guard}}/claims.md)); a ticked box needs a commit git holds ([checklists]({{ref:spec-graph}}/claims-and-evidence.md#checklists-and-ledgers-held-to-what-they-cite)). The code is held to the documents, as well as the documents to each other. |
| Scoped agent work | [Trailbun](https://github.com/Daniel-DDV/trailbun), [spec-gates](https://github.com/schwichtgit/spec-gates) | A round of agent work runs under a brief, a Markdown file a person approves; each brief protects its own files for its own round, and a protected path opens only by a ruling the person signs ([rounds]({{ref:spec-harness}}/rounds.md)). |
| Import rules | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [import-linter](https://github.com/seddonym/import-linter) | spec-guard's import rules are written in the ADR under the sentence they enforce, in JavaScript and TypeScript, Python, Go, Rust and C#, and stop being enforced when the ADR is superseded ([imports]({{ref:spec-guard}}/imports.md)). The two kinds of tool run side by side. |

## What the tools do not do

The overview's [full list]({{overview}}#what-the-tools-do-not-do) gives the
reason for each and where it is decided.

- **The guard before a write works under one agent.** spec-harness refuses a
  write to a protected file through Claude Code's `PreToolUse` hook, in
  Claude Code 2.1.139 or later ([requirements]({{readme:spec-harness}}#requirements)).
  No other agent's hooks have been tested with it. Every agent, or none,
  still meets git's pre-commit hook where it is installed, the audit, the
  archive and CI.
- **A write through a shell passes the guard.** The hook sees the agent's
  file tools, not a shell command. The audit and spec-brief's archive measure
  everything the round changed, whatever wrote it, so they find it, as the
  [first story](/stories/write-refused/) shows.
- **A ruling proves the agent did not sign it, not that two people
  reviewed.** One person may write the brief, run the round and sign its
  rulings; nothing checks that the signer is someone other than the brief's
  author. A forge that squashes or rebases on merge drops the signature.
- **They do not run your tests.** `spec-guard claims` asks an `Implemented`
  claim for a directive that counts a test by its name, and `spec-guard
  prove` shows the directive can fail; whether the test passes is your test
  runner's to say, in the same CI run.
- **They do not decide whether the code is correct, or whether a document
  asks for the right thing.** That is the tests' job, and the person's.
- **They read only what is marked.** A sentence with no directive under it,
  a number nothing marks, a file no configuration names: none is checked. No
  model reads the prose.
- **They do not protect their own rule files.** An agent that can edit the
  ADR, the configuration or the CI workflow can loosen the rule it is
  breaking; protected branches and code owners close that gap.
- **Status words are read in English.** A document may be written in any
  language and gives its status in English.
- **The output is not frozen yet.** The tools are before 1.0. This site
  shows what the releases it pins print, and is played again for each new
  pin.
