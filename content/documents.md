---
title: Which document do you want to keep true?
description: Eight kinds of Markdown document, what goes wrong in each, the spec-family tool that holds it, and the rules and commands that do.
order: 2
---

# Which document do you want to keep true?

Find the kind of document you keep, and what goes wrong with it. The tool
links to its card, and each rule or command to its page in the reference of
the release this site pins.

| Document | What goes wrong | Tool | Rule or command |
| --- | --- | --- | --- |
| ADR | The code stops keeping a rule the ADR states; a rule is written so that it can never fail; a code comment cites a decision that was superseded or never written; a superseded ADR still reads as current | [spec-guard](/tools/#spec-guard), [spec-graph](/tools/#spec-graph) | [`@assert-*` directives]({{ref:spec-guard}}/directives.md) under the sentence, run by `spec-guard`; [`spec-guard prove`]({{ref:spec-guard}}/prove.md); [`spec-guard cites`]({{ref:spec-guard}}/cites.md); [`live-supersession`]({{ref:spec-graph}}/rules.md) |
| Specification | The code stops keeping a rule the specification states; a citation names a document or anchor that is not there; a document rests on a decision since retired; open work is handed to a document that can no longer take it; a claim says `Implemented` and no test stands behind it | [spec-graph](/tools/#spec-graph), [spec-guard](/tools/#spec-guard) | [`broken-reference`, `stale-premise`, `ghost-handover`]({{ref:spec-graph}}/rules.md); [`@assert-*` directives]({{ref:spec-guard}}/directives.md) under the sentence; [`spec-guard claims`]({{ref:spec-guard}}/claims.md) |
| Checklist or roadmap | A box is ticked with nothing behind it, cites a claim still open, or names a commit git does not have | [spec-graph](/tools/#spec-graph) | [`unevidenced-completion`, `premature-completion`, `unknown-commit`]({{ref:spec-graph}}/claims-and-evidence.md#checklists-and-ledgers-held-to-what-they-cite) |
| Ledger or status page | A row says done while the claim it cites still leaves work open | [spec-graph](/tools/#spec-graph) | [`premature-completion`, `unknown-commit`]({{ref:spec-graph}}/claims-and-evidence.md#checklists-and-ledgers-held-to-what-they-cite) |
| Register | A row's status is a word the register does not know; a row lacks the resolution, citation or commit its status asks for; two rows share a key | [spec-graph](/tools/#spec-graph) | [`unknown-register-status`, `incomplete-register-row`, `duplicate-key`]({{ref:spec-graph}}/registers.md) |
| Measurement protocol, and the figures that rest on it | A protocol has no method or no dated result; a claim that asks for a measurement cites no protocol; a figure names no record | [spec-graph](/tools/#spec-graph) | [`incomplete-protocol`, `undated-result`, `target-without-protocol`, `unrecorded-figure`]({{ref:spec-graph}}/claims-and-evidence.md#figures-resting-on-a-record) |
| Orientation document: `CLAUDE.md`, `AGENTS.md`, a README | It names a path, a script, a make target or a commit that is not there; the code stops keeping a rule it states | [spec-graph](/tools/#spec-graph), [spec-guard](/tools/#spec-guard) | [`missing-path`, `missing-command`]({{ref:spec-graph}}/orientation.md), [`unknown-commit`]({{ref:spec-graph}}/claims-and-evidence.md#commits-looked-for-in-git); [`@assert-*` directives]({{ref:spec-guard}}/directives.md) under the sentence |
| Brief | Its contract is incomplete; two rounds meant to run side by side could write the same file; an agent writes a file the brief protects; the round closes with a protected file changed, a box open, or a claim it raises still open | [spec-brief](/tools/#spec-brief), [spec-harness](/tools/#spec-harness) | [`spec-brief lint`, `matrix`, `schedule`, `archive`]({{ref:spec-brief}}/commands.md); [`spec-harness guard`]({{ref:spec-harness}}/guard.md), [`audit`]({{ref:spec-harness}}/audit.md) |

## What each tool reads

spec-graph reads specifications, ADRs and the references between them with
no configuration, including the layouts Spec Kit, OpenSpec and Kiro write
([layouts]({{ref:spec-graph}}/sdd-layouts.md)). Its rules for claims,
checklists, ledgers, registers, protocols and orientation documents start
once its configuration names the files that hold them, as `spec-guard claims`
and `spec-guard cites` do; a file no configuration names is not held to them.
The words in the table - claim, label, ledger, register, protocol,
orientation document - are defined in the family's
[concepts]({{core}}/docs/concepts.md).

One tool is a useful install on its own: spec-guard alone holds code to what
its Markdown says, and spec-graph alone holds documents to each other and to
the record they cite. [Adopting]({{core}}/docs/adopting.md) goes from one
tool to the whole loop, and the overview's
[problem-by-problem table]({{overview}}#which-problem-which-tool) names the
command for each problem.
