---
title: A claim without evidence
description: A specification marked Implemented with no test, a roadmap item ticked for a commit never made, and agent instructions naming a missing file: spec-guard and spec-graph turn CI red on each.
order: 5
---

# A claim without evidence

In the [example repository]({{example-repo}}), no brief is under way. An
agent reports work as done in three Markdown documents, and nothing in the
code backs it. Below, every block is what the command printed.

<!-- played: claim-without-evidence -->

<!-- story: claim-without-evidence -->

## In CI

The example's CI runs both checks in its `{{red:claim-without-evidence}}` job.
Pull request
[#{{pull-number:claim-without-evidence}}]({{pull:claim-without-evidence}})
holds this story's branch and is left open: that job is red, for these three
findings and nothing else, and no other job is.

## Further

- [`spec-guard claims`]({{ref:spec-guard}}/claims.md), and spec-graph's
  [claims and their evidence]({{ref:spec-graph}}/claims-and-evidence.md) and
  [orientation documents]({{ref:spec-graph}}/orientation.md), in the
  references.
- [The other story](/stories/write-refused/): a write refused.
