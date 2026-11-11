---
title: The four tools
description: spec-brief, spec-graph, spec-guard and spec-harness, each with one command run on the example repository and what the pinned release printed.
order: 6
---

# The four tools

Each card runs one command on the [example repository]({{example-repo}}) as
it stands on `main` at [`{{example-short}}`]({{example-commit}}), where every
check holds, with the release the card names. The block is what that release
printed; the [stories](/stories/) show the same tools finding something. The
description under each name is the one the release itself carries.

## spec-brief {#spec-brief .card}

{{description:spec-brief}}

<!-- run: spec-brief -->

[README]({{readme:spec-brief}}) · [Reference]({{ref:spec-brief}}/README.md) · [npm]({{npm:spec-brief}}) {.links}

## spec-graph {#spec-graph .card}

{{description:spec-graph}}

<!-- run: spec-graph -->

[README]({{readme:spec-graph}}) · [Reference]({{ref:spec-graph}}/README.md) · [npm]({{npm:spec-graph}}) {.links}

## spec-guard {#spec-guard .card}

{{description:spec-guard}}

<!-- run: spec-guard -->

[README]({{readme:spec-guard}}) · [Reference]({{ref:spec-guard}}/README.md) · [npm]({{npm:spec-guard}}) {.links}

## spec-harness {#spec-harness .card}

{{description:spec-harness}}

<!-- run: spec-harness -->

The packet is what an agent starts the round with: the brief in full, its
scope as the guard reads it, the rules in force, and the documents the brief
cites.

[README]({{readme:spec-harness}}) · [Reference]({{ref:spec-harness}}/README.md) · [npm]({{npm:spec-harness}}) {.links}

## Install

```sh
npm install --save-dev @spec-family/<tool>
npx --no-install @spec-family/<tool>
```

Every tool runs on Node {{node}} or later, calls no model and makes no
network request. The [overview]({{overview}}) says which tool to start with.
