---
title: Two stories
description: Two stories from the spec-family example repository, an agent's write refused and a claim with nothing behind it, with what the tools printed.
order: 3
---

# Two stories

The [example repository]({{example-repo}}) is a lending library small enough
to read in a few minutes, kept to its documents by the four tools. Two
stories show what they catch. Each is played by the example's own
`npm run demo`, in a throwaway copy of the repository, with the releases this
site pins; each is also a pull request in the example, left open and red in
CI for that story alone.

## A write refused

A brief protects the loan record. The agent's write there is refused before
it is made; its write through the shell is not, and the audit finds it at
the end of the round. [Read the story](/stories/write-refused/), or its
[pull request]({{pull:write-refused}}).

## A claim without evidence

A promise marked `Implemented` with no test behind it, a roadmap item ticked
for a commit that was never made, and agent instructions that name a file
that is not there. CI is red on each.
[Read the story](/stories/claim-without-evidence/), or its
[pull request]({{pull:claim-without-evidence}}).

## Play them yourself

```sh
git clone https://github.com/{{example-name}}.git
cd example
npm ci
npm run demo
```

It needs Node {{node}} or later and git. `npm run demo` changes nothing in
the checkout and takes a few seconds; the example's
[README]({{example-blob}}/README.md) tells both stories as they play there.
