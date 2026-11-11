---
title: A write refused
description: An agent's write to a file its brief protects is refused before it is made; its write through the shell is not, and spec-harness audit finds it.
order: 4
---

# A write refused

In the [example repository]({{example-repo}}), a person has approved a brief
for one round of agent work: charge a late fee. The brief says which files
the round may write and which it must not change. Below, the round runs on
the brief's branch, and every block is what the command printed.

<!-- played: write-refused -->

<!-- story: write-refused -->

## In CI

The example's CI runs the audit on a brief's branch. Pull request
[#{{pull-number:write-refused}}]({{pull:write-refused}}) holds this story's
branch and is left open: its `{{red:write-refused}}` job, where the audit
runs, is red, and no other job is.

With git's pre-commit hook installed (`spec-harness init --git-hook --write`),
the commit itself is refused, for any agent or none. The hook lives on one
machine and `git commit --no-verify` skips it, so the audit stays the gate.

## Further

- [The guard and its hooks]({{ref:spec-harness}}/guard.md), and
  [the audit]({{ref:spec-harness}}/audit.md), in the spec-harness reference.
- [The other story](/stories/claim-without-evidence/): a claim without
  evidence.
