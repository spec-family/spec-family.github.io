---
title: spec family
description: Four command-line tools that hold your code, and the agents that write it, to what your Markdown says: deterministic, with no runtime dependencies.
order: 1
---

# spec family {.home-title}

A specification marks a feature `Implemented`, and no test that could fail
stands behind it. An agent asked to fix one function also rewrites the
migration its task told it to leave alone. An ADR says the domain imports
nothing from the infrastructure, and the code stopped keeping that a month
ago. Each is a Markdown document saying something about the code that is not
true, and nothing in the build notices. {.problem}

**The spec family finds each of these, the same way every time: it holds your code, and the agents that write it, to what your Markdown says.** {.claim}

[Read the overview]({{overview}}) [The tools on GitHub]({{github}}) {.actions}

It is four command-line tools. They read the Markdown a repository already
keeps - specifications, ADRs, checklists, registers, agent instructions, the
brief a round of agent work runs under - and check what it says against the
code, the git history and the changes an agent actually made. They call no
model, need no account and make no network request. A tool's exit code means
one thing: `0` clean, `1` found something, `2` the result cannot be trusted.

## Install one

```sh
npm install --save-dev @spec-family/spec-guard
npx --no-install @spec-family/spec-guard
```

Each tool is one npm package under the `@spec-family` scope: spec-brief,
spec-graph, spec-guard and spec-harness; put the one you want in place of
spec-guard. `--no-install` runs the copy your project installed, and never
fetches a package of a similar name. The tools need Node {{node}} or later.

<!-- figure: dependencies -->

## Where to go next

- [Which document do you want to keep true?](/documents/) Eight kinds of
  document, the tool that holds each, and its rules.
- [Two stories](/stories/): an agent's write refused, and a claim with
  nothing behind it turned red in CI, each with what the tools printed.
- [The four tools](/tools/): one command each, and what the pinned release
  prints.
- [Comparison and limits](/compare/): the projects nearby, and what the tools
  do not do.

Every command's output on this site is printed by the tools themselves, at
the releases each page names ({{versions}}), in the site's CI; a release that
prints something else turns the site's build red until the page is played
again.
