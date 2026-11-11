# spec-family.github.io

The source of <https://spec-family.github.io>, the website of the
[spec-family](https://github.com/spec-family) tools: plain HTML and CSS
written by a Node script, searchable with Pagefind, served by GitHub Pages.

Every command's output on the site is printed by the tools themselves, at the
releases `package.json` pins, on the [example repository](https://github.com/spec-family/example)
at the commit `site.json` pins. CI plays every output again and fails where a
page no longer shows what the pinned releases print, so a page cannot go stale
quietly.

## The pages

| Page | Source | What it shows |
| --- | --- | --- |
| `/` | `content/index.md` | The problem, the family's sentence, the install commands, and one figure: the runtime dependencies of the pinned releases, with the registry manifests that reproduce it |
| `/documents/` | `content/documents.md` | Which document do you want to keep true? Eight kinds of document, each with its tool and the reference pages of the pinned release |
| `/stories/` | `content/stories/index.md` | The example's two stories, and how to play them |
| `/stories/write-refused/` | `content/stories/write-refused.md` | A write refused: the guard's answer, the hook's answer and exit code, the shell write, the audit that finds it |
| `/stories/claim-without-evidence/` | `content/stories/claim-without-evidence.md` | A claim without evidence: `spec-guard claims` and `spec-graph check` red on an `Implemented` with no test, a tick with no commit and an instruction naming a missing path |
| `/tools/` | `content/tools.md` | One card per tool: a command on the example and what the pinned release printed, with links to that release's README and reference |
| `/compare/` | `content/compare.md` | The neighbours by area and what the family does there, and what the tools do not do; the claims about other projects stay in the overview it links |
| `/search/` | written by `scripts/build.mjs` | Pagefind's search, over the index the build writes |
| `/llms.txt` | written by `scripts/build.mjs` | The [llms.txt v2](https://llmstxt.org/) file: every page's Markdown version, each release's reference and README |

Each page is also Markdown at `<page>/index.md`, which the HTML names with
`<link rel="alternate" type="text/markdown">` and points to in its footer;
every page names `/llms.txt` with `<link rel="describedby">`.

## Commands

It needs Node 22 or later and git.

```bash
npm ci                        # the four tools and Pagefind, at the pinned versions
npm test                      # unit tests: the Markdown reader, the demo's output read back
npm run capture               # play every output again and write outputs/
npm run capture -- --check    # play them again and fail where outputs/ differs
npm run build                 # write _site/ from content/ and outputs/, and index it
npm run check                 # check _site/ against outputs/, the pins and the rules below
npm run serve                 # serve _site/ at http://localhost:4173
npm run latest                # whether a bump is due (needs the network)
```

## How an output reaches a page

1. `npm run capture` clones the example repository into a temporary
   directory, sets its `main` to the commit `site.json` pins, and links this
   checkout's `node_modules` into it, so that
   `npx --no-install @spec-family/<tool>` there runs the pinned release.
   - Each entry of `runs` in `site.json` is one command on that checkout. It
     must exit as `site.json` says and leave the checkout as it found it.
   - The stories are what the example's own `npm run demo` prints, played by
     its `scripts/demo.mjs` in a throwaway copy of that checkout, and read
     back into paragraphs, commands, output and exit codes
     (`parsePlay` in `scripts/lib/site.mjs`).
   - `outputs/example.json` lists the files of the pinned commit, for the
     link check.

   The commands run in a terminal's environment, not CI's: no colour, and no
   `CI`, `GITHUB_*` or `RUNNER_*` variable that could name a branch or a brief.
2. `outputs/` is committed, so a review sees every change in what a tool
   prints. A commit id and a duration differ from run to run, so
   `--check` compares each as a kind, as the example's own README check does,
   and `npm run capture` leaves a file alone when only those differ.
3. `npm run build` reads each page in `content/` and fills it:
   - `{{name}}` and `{{name:arg}}` in the text, from `site.json`,
     `package.json` and the installed releases (their versions, descriptions,
     Node requirement and dependencies); an unknown name stops the build;
   - a one-line comment `<!-- story: <id> -->`, `<!-- played: <id> -->`,
     `<!-- run: <id> -->` or `<!-- figure: dependencies -->`, with blocks
     written from `outputs/` or the installed manifests. Any other comment is
     a note and is dropped.

   Nothing in the build runs a tool: what a tool printed comes from
   `outputs/` only. The build then writes `llms.txt`, `sitemap.xml`,
   `robots.txt`, the search page and `404.html`, and runs Pagefind's Node API
   over `_site/`.
4. `npm run check` fails where:
   - an output was printed by a release other than the pinned one, by another
     command, with another exit code or on another commit, or is not on any
     page; or a page does not show an output line for line, in its HTML and
     its Markdown, with its exit code and release;
   - a page names a tool's version other than the pinned one;
   - a link into a tool's repository names a tag other than the pinned
     release, or a file or heading that release does not ship (checked
     against the copy in `node_modules`, since each release ships its
     `docs/reference/`); a link whose text names rules or commands in code
     reaches a page that does not name them; a link into the example names
     another commit or a file the pinned commit does not hold; a link within
     the site reaches no page or no id on it;
   - an `npx` on a page runs a name without `--no-install` and the
     `@spec-family` scope;
   - a page loads anything from another site, lacks a language, a skip link
     or a single `h1`, skips a heading level, has an image without alt text
     or a scrolling block the keyboard cannot reach, or puts another
     company's product name in a heading or title; or a pair of the
     stylesheet's colours falls under WCAG AA contrast in either theme;
   - `llms.txt` is not an H1, a blockquote, text, and H2 lists of
     `- [name](url): notes`, or leaves out a page; or Pagefind indexed a
     different number of pages.

## CI and deployment

[`.github/workflows/site.yml`](.github/workflows/site.yml), on
`ubuntu-24.04`, with every action pinned by commit:

| Job | When | What |
| --- | --- | --- |
| `build` | every pull request and push, the schedule, by hand | `npm ci`, `npm test`, `npm run capture -- --check`, `npm run build`, `npm run check`; on `main`, hands `_site/` to Pages |
| `deploy` | a push to `main`, or by hand on `main` | deploys what `build` handed over; the only job with `pages: write` and `id-token: write` |
| `latest` | Mondays, or by hand | `npm run latest`: red when a pinned package is no longer npm's latest, the example's `main` has moved, or a story's pull request is closed, or red in another job than its page says |

The workflow reads the repository only (`contents: read`). Pages deploys
with a short-lived OIDC token; no secret is stored.

## Bumping the pinned versions

The versions live in one place each: the tools and Pagefind in
`package.json` (exact versions, and `package-lock.json`), the example's
commit in `site.json`.

1. Pin the new release:

   ```bash
   npm install --save-dev --save-exact @spec-family/spec-guard@<version>
   ```

   For a new example commit, set `example.commit` in `site.json` to its full
   id, and check that `stories` still names each story's branch, pull request
   and red job.
2. Play everything again, and read what changed:

   ```bash
   npm run capture
   git diff outputs/
   ```

3. Read the prose next to each changed output: a story's paragraphs come from
   the example, but the introductions, the harness card's last paragraph, the
   documents table and the comparison are this repository's. `npm run check`
   holds versions, links and rule names, not meaning.
4. `npm run build && npm run check`, look at it with `npm run serve`, and
   commit `package.json`, `package-lock.json`, `site.json` and `outputs/`
   together. CI plays every output again on Linux.

## Conventions

- No dependencies beyond the four tools and Pagefind, all pinned exactly; no
  framework, no web fonts, no scripts but Pagefind's own files and the
  search page's few lines, all served from the site; no cookies or
  tracking.
- Every `npx` gives the scope and `--no-install`. The unscoped names on npm
  are not these packages.
- The scripts hold no backslash: a character that would need an escape is
  built from its code (`String.fromCharCode`), as in the example repository,
  so that a script reads the same through any tool that unescapes text.
- English, LF line endings.
- To clone the example from somewhere other than GitHub (a local mirror,
  offline), set `SPEC_FAMILY_EXAMPLE` to its path or address; the pinned
  commit must be in it.

## License

MIT; the text is in `LICENSE`.
