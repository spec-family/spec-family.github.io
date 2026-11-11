/**
 * Builds the site into _site/ from content/ and outputs/.
 *
 *   npm run build
 *
 * Each page in content/ is Markdown with two kinds of placeholder: `{{name}}`
 * or `{{name:arg}}` in the text, filled from site.json, package.json and the
 * installed releases; and a one-line comment `<!-- name: arg -->`, a block
 * the build writes from outputs/, which `npm run capture` filled from the
 * tools themselves. A page is written twice, as HTML at `<path>/index.html`
 * and as Markdown at `<path>/index.md`, for the agents llms.txt points to.
 * Pagefind then indexes the HTML.
 *
 * Nothing here runs a tool: what a tool printed comes from outputs/ only, and
 * `npm run capture -- --check` is what holds outputs/ to the tools.
 *
 * No backslash in this file: see the README's conventions.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { escapeHtml, fenceFor, inline, inlineHtml, NL, parse, rewriteLinks, toHtml, toMarkdown } from './lib/markdown.mjs';
const BT = String.fromCharCode(96);
import {
  checkInstalled,
  config,
  exampleBlob,
  exampleCommit,
  installed,
  loadOutput,
  manifestUrl,
  peers,
  nodeMajor,
  npmPage,
  pages,
  pins,
  pull,
  releaseBlob,
  releaseRaw,
  ROOT,
  runtimeDependencies,
  short,
  story,
  toolOf,
  TOOLS,
  versionList,
} from './lib/site.mjs';

export const SITE = path.join(ROOT, '_site');
const CORE = 'https://github.com/spec-family/spec-core/blob/main';
const CORE_RAW = 'https://raw.githubusercontent.com/spec-family/spec-core/main';
const SOURCE = 'https://github.com/spec-family/spec-family.github.io';

const NAV = [
  { url: '/documents/', label: 'Documents' },
  { url: '/stories/', label: 'Stories' },
  { url: '/tools/', label: 'Tools' },
  { url: '/compare/', label: 'Compare' },
  { url: '/search/', label: 'Search' },
];

// ---------------------------------------------------------------------------
// Placeholders

function tool(arg, name) {
  if (!TOOLS.includes(arg)) throw new Error(`{{${name}:${arg}}} names no tool; the tools are ${TOOLS.join(', ')}`);
  return arg;
}

const PLACEHOLDERS = {
  overview: () => config.overview,
  github: () => config.github,
  core: () => CORE,
  node: () => nodeMajor(),
  versions: () => versionList(),
  'example-repo': () => `https://github.com/${config.example.repository}`,
  'example-name': () => config.example.repository,
  'example-blob': () => `https://github.com/${config.example.repository}/blob/${config.example.commit}`,
  'example-short': () => short(config.example.commit),
  'example-commit': () => exampleCommit(),
  version: (arg) => pins()[tool(arg, 'version')],
  ref: (arg) => releaseBlob(tool(arg, 'ref'), 'docs/reference'),
  readme: (arg) => releaseBlob(tool(arg, 'readme'), 'README.md'),
  npm: (arg) => npmPage(tool(arg, 'npm')),
  description: (arg) => installed(tool(arg, 'description')).description,
  pull: (arg) => pull(arg),
  'pull-number': (arg) => String(story(arg).pull),
  red: (arg) => story(arg).red,
};

export function fill(text, where) {
  return text.replace(/[{][{]([a-z-]+)(?::([a-z0-9-]+))?[}][}]/g, (whole, name, arg) => {
    const make = PLACEHOLDERS[name];
    if (make === undefined) throw new Error(`${where}: ${whole} is no placeholder the build knows`);
    if ((arg === undefined) !== (make.length === 0)) throw new Error(`${where}: ${whole} ${arg === undefined ? 'needs' : 'takes no'} an argument`);
    return make(arg);
  });
}

// ---------------------------------------------------------------------------
// Blocks the build writes

/** A link in the example's own text, made absolute at the pinned commit. */
function exampleLink(href) {
  return /^[a-z]+:|^#|^[/]/.test(href) ? href : exampleBlob(href);
}

/** A story as outputs/ holds it: each paragraph, then its commands grouped up to each tool's exit, as the example's README groups them. */
function storyBlocks(id) {
  const played = loadOutput('stories', id);
  const blocks = [];
  let group = null;
  const close = () => {
    if (group !== null) blocks.push(group);
    group = null;
  };
  for (const step of played.steps) {
    if (step.say !== undefined) {
      close();
      const text = rewriteLinks(step.say, exampleLink);
      blocks.push({ type: 'paragraph', text, classes: [], source: [text] });
      continue;
    }
    group ??= { type: 'run', commands: [] };
    group.commands.push({ line: step.run, output: step.output });
    if (step.exit !== undefined) {
      const name = toolOf(step.run);
      Object.assign(group, { exit: step.exit, tool: name, version: name ? played.versions[name] : undefined });
      close();
    }
  }
  close();
  return blocks;
}

function runBlock(id) {
  const run = loadOutput('runs', id);
  return { type: 'run', commands: [{ line: run.command, output: run.output }], exit: run.exit, tool: run.id, version: run.version };
}

/** The line saying who played a story, and where. */
function playedBlock(id) {
  const played = loadOutput('stories', id);
  const tools = Object.entries(played.versions).map(([name, version]) => `${name} ${version}`);
  const text =
    `Played by the example's [${BT}${played.played}${BT}](${exampleBlob(played.played)}) at ` +
    `[${BT}${short(config.example.commit)}${BT}](${exampleCommit()}), with ${tools.join(' and ')}, in this site's CI.`;
  return { type: 'paragraph', text, classes: ['provenance'], source: [text] };
}

/** The home page's one figure: the runtime dependencies of the pinned releases, and where to see it. */
function dependenciesBlock() {
  const count = TOOLS.reduce((sum, name) => sum + runtimeDependencies(name).length, 0);
  const manifests = TOOLS.map((name) => `[${name} ${pins()[name]}](${manifestUrl(name)})`).join(', ');
  const words = (list) => (list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
  const bare = (name) => name.replace(/^@spec-family[/]/, '');
  const asking = TOOLS.filter((name) => peers(name).required.length + peers(name).optional.length > 0).map((name) => {
    const { required, optional } = peers(name);
    const parts = [];
    if (required.length > 0) parts.push(`${words(required.map(bare))} beside it`);
    if (optional.length > 0) parts.push(`${words(optional.map(bare))} where they are installed`);
    return `${name} asks for ${parts.join(', and ')}, as peers`;
  });
  const outside = [...new Set(TOOLS.flatMap((name) => [...runtimeDependencies(name), ...peers(name).required, ...peers(name).optional]))].filter((name) => !name.startsWith('@spec-family/'));
  const listed = count === 0 ? `lists no ${BT}dependencies${BT}` : `lists ${BT}dependencies${BT} ${count} times in all`;
  const family = outside.length === 0 ? 'No release names a package from outside the family.' : `The releases name ${outside.length} package(s) from outside the family: ${words(outside)}.`;
  return {
    type: 'stat',
    number: String(count),
    label: count === 1 ? 'runtime dependency' : 'runtime dependencies',
    text: `in the four tools, at the releases this site pins: each release's manifest on the npm registry ${listed}. ${asking.map((sentence) => `${sentence}.`).join(' ')} ${family} Reproduce it from the manifests: ${manifests}.`.replace(/[ ]+/g, ' '),
  };
}

function expand(blocks, where) {
  return blocks.flatMap((block) => {
    if (block.type !== 'directive') return [block];
    switch (block.name) {
      case 'story':
        return storyBlocks(block.arg);
      case 'played':
        return [playedBlock(block.arg)];
      case 'run':
        return [runBlock(block.arg)];
      case 'figure':
        if (block.arg !== 'dependencies') throw new Error(`${where}: no figure is called ${block.arg}`);
        return [dependenciesBlock()];
      default:
        throw new Error(`${where}: <!-- ${block.name} --> is no directive the build knows`);
    }
  });
}

function caption(block) {
  return block.version === undefined ? `Exit ${block.exit}` : `Exit ${block.exit} · ${block.tool} ${block.version}`;
}

function renderHtml(block, { link }) {
  if (block.type === 'run') {
    const lines = block.commands.flatMap(({ line, output }) => [
      `<span class="cmd"><span class="prompt" aria-hidden="true">$ </span>${escapeHtml(line)}</span>`,
      ...output.map(escapeHtml),
    ]);
    const label = block.tool ? `What ${block.tool} printed` : 'Commands';
    const figcaption = block.exit === undefined ? '' : `<figcaption>Exit <code>${block.exit}</code>${block.version === undefined ? '' : ` · ${escapeHtml(block.tool)} ${escapeHtml(block.version)}`}</figcaption>`;
    return `<figure class="run"><pre tabindex="0" aria-label="${escapeHtml(label)}"><code>${lines.join(NL)}</code></pre>${figcaption}</figure>`;
  }
  if (block.type === 'stat') {
    return `<figure class="stat"><p class="stat-number">${escapeHtml(block.number)} <span>${escapeHtml(block.label)}</span></p><figcaption>${inlineHtml(inline(block.text), link)}</figcaption></figure>`;
  }
  return undefined;
}

function renderMarkdown(block, { link }) {
  if (block.type === 'run') {
    const body = block.commands.flatMap(({ line, output }) => [`$ ${line}`, ...output]);
    const fence = fenceFor(body);
    const text = [`${fence}console`, ...body, fence].join(NL);
    return block.exit === undefined ? text : `${text}${NL}${NL}${caption(block).replace(/^Exit ([0-9]+)/, 'Exit `$1`')}.`;
  }
  if (block.type === 'stat') return rewriteLinks(`**${block.number} ${block.label}** ${block.text}`, link ?? ((href) => href));
  return undefined;
}

// ---------------------------------------------------------------------------
// Pages

/** Every page read and expanded, in the order content/ holds them. */
export function readPages() {
  return pages().map((page) => {
    const where = `content/${page.relative}`;
    const { meta, blocks } = parse(fill(readFileSync(page.source, 'utf8'), where));
    for (const key of ['title', 'description']) if (!meta[key]) throw new Error(`${where} has no ${key} in its front matter`);
    if (!/^[0-9]+$/.test(meta.order ?? "")) throw new Error(`${where} has no order in its front matter`);
    return { ...page, meta, blocks: expand(blocks, where) };
  }).sort((a, b) => Number(a.meta.order) - Number(b.meta.order));
}

const htmlLink = (href) => href;

/** A link as the Markdown version gives it: a page of this site as its Markdown, at its full address. */
function markdownLink(href) {
  if (!href.startsWith('/')) return href;
  const [pathPart, anchor] = href.split('#');
  const target = pathPart.endsWith('/') ? `${pathPart}index.md` : pathPart;
  return `${config.url}${target}${anchor === undefined ? '' : `#${anchor}`}`;
}

function navigation(current) {
  return NAV.map(({ url, label }) => {
    const state = current === url ? ' aria-current="page"' : current.startsWith(url) ? ' aria-current="true"' : '';
    return `<li><a href="${url}"${state}>${label}</a></li>`;
  }).join('');
}

function footer(markdownUrl) {
  return [
    '<footer class="site-footer">',
    `<p>Every command's output on this site is printed in its CI by ${escapeHtml(versionList())}, on <a href="${exampleCommit()}">${escapeHtml(config.example.repository)}@${short(config.example.commit)}</a>.</p>`,
    `<p class="agents">For agents: <a href="/llms.txt">/llms.txt</a> lists every page${markdownUrl ? `, and this page is also <a href="${markdownUrl}">Markdown</a>` : ''}.</p>`,
    `<p>MIT licensed · <a href="${SOURCE}">This site's source</a> · No cookies, no tracking.</p>`,
    '</footer>',
  ].join(NL);
}

/** The page around a body: head, header, main, footer. */
export function layout({ title, description, url, markdown, body, head = '', scripts = '', index = true }) {
  const fullTitle = title === config.name ? config.name : `${title} · ${config.name}`;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(fullTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    '<meta name="color-scheme" content="light dark">',
    index ? `<link rel="canonical" href="${config.url}${url}">` : '<meta name="robots" content="noindex">',
    markdown ? `<link rel="alternate" type="text/markdown" href="${markdown}">` : '',
    '<link rel="describedby" href="/llms.txt">',
    '<link rel="stylesheet" href="/assets/site.css">',
    '<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">',
    head,
    '</head>',
    '<body>',
    '<a class="skip" href="#main">Skip to content</a>',
    '<header class="site-header">',
    `<a class="brand" href="/"${url === '/' ? ' aria-current="page"' : ''}><img src="/assets/icon.svg" alt="" width="24" height="24"> ${escapeHtml(config.name)}</a>`,
    `<nav aria-label="Site"><ul>${navigation(url)}</ul></nav>`,
    '</header>',
    `<main id="main"${index ? ' data-pagefind-body' : ''}>`,
    body,
    '</main>',
    footer(markdown),
    scripts,
    '</body>',
    '</html>',
    '',
  ]
    .filter((line) => line !== '')
    .join(NL);
}

function markdownPage(page) {
  const body = toMarkdown(page.blocks, { link: markdownLink, render: renderMarkdown });
  const trailer = `This is the Markdown version of ${config.url}${page.url}. Every command's output in it is printed by ${versionList()} in the site's CI; [llms.txt](${config.url}/llms.txt) lists every page.`;
  return `${body}${NL}---${NL}${NL}${trailer}${NL}`;
}

function write(file, text) {
  const at = path.join(SITE, file);
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, text);
}

// ---------------------------------------------------------------------------
// For agents and crawlers

function llmsTxt(all) {
  const describe = (page) => `- [${page.meta.title}](${config.url}${page.markdown}): ${page.meta.description}`;
  const reference = TOOLS.map((name) => `- [${name} ${pins()[name]} reference](${releaseRaw(name, 'docs/reference/README.md')}): every command, rule, option and key of the release this site pins.`);
  const readmes = TOOLS.map((name) => `- [${name} ${pins()[name]} README](${releaseRaw(name, 'README.md')}): ${installed(name).description}`);
  return [
    `# ${config.name}`,
    '',
    "> Four deterministic command-line tools, each one npm package with no runtime dependencies, that hold a repository's code, and the coding agents that write it, to what its Markdown says: specifications, ADRs, checklists, registers, agent instructions and the briefs agents work under.",
    '',
    `The tools are spec-brief, spec-graph, spec-guard and spec-harness, published on npm under the ${BT}@spec-family${BT} scope; the unscoped names are not these packages. Install one with ${BT}npm install --save-dev @spec-family/<tool>${BT} and run it with ${BT}npx --no-install @spec-family/<tool>${BT}. They need Node ${nodeMajor()} or later, call no model and make no network request. Exit codes: ${BT}0${BT} clean, ${BT}1${BT} found something, ${BT}2${BT} the result cannot be trusted.`,
    '',
    `Each page below is the Markdown version of a page of this site. Every command's output on them is printed by ${versionList()} in the site's CI, on the example repository at commit ${short(config.example.commit)}.`,
    '',
    '## Pages',
    '',
    ...all.map(describe),
    '',
    '## Reference',
    '',
    ...reference,
    `- [Overview](${CORE_RAW}/docs/overview.md): the family's positioning, the eight kinds of document, its neighbours and what the tools do not do.`,
    `- [Example repository README](https://raw.githubusercontent.com/${config.example.repository}/${config.example.commit}/README.md): the two stories as the example tells them.`,
    '',
    '## Optional',
    '',
    ...readmes,
    `- [Concepts](${CORE_RAW}/docs/concepts.md): every word the tools share, in a sentence or two.`,
    `- [Adopting](${CORE_RAW}/docs/adopting.md): from one tool to the whole loop, CI, and the forge settings for a repository where agents write most of the code.`,
    `- [Tutorial](${CORE_RAW}/docs/tutorial.md): one round of agent work from the brief to the archive.`,
    '',
  ].join(NL);
}

function sitemap(all) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...all.map((page) => `<url><loc>${config.url}${page.url}</loc></url>`),
    '</urlset>',
    '',
  ].join(NL);
}

function searchPage() {
  const body = [
    '<h1>Search</h1>',
    '<p>Search every page of this site.</p>',
    '<div id="search" class="search"></div>',
    '<noscript><p>Search needs JavaScript. Every page is in the navigation above, and listed in <a href="/llms.txt">/llms.txt</a>.</p></noscript>',
  ].join(NL);
  return layout({
    title: 'Search',
    description: 'Search the spec family site.',
    url: '/search/',
    body,
    index: false,
    head: '<link rel="stylesheet" href="/pagefind/pagefind-ui.css">',
    scripts: '<script src="/pagefind/pagefind-ui.js"></script>' + NL + '<script src="/assets/search.js"></script>',
  });
}

function notFoundPage() {
  const body = ['<h1>Not found</h1>', '<p>No page is at this address. Try the <a href="/">home page</a> or <a href="/search/">search</a>.</p>'].join(NL);
  return layout({ title: 'Not found', description: 'No page is at this address.', url: '/404.html', body, index: false });
}

// ---------------------------------------------------------------------------

async function main() {
  checkInstalled();
  const all = readPages();
  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(SITE, { recursive: true });
  cpSync(path.join(ROOT, 'assets'), path.join(SITE, 'assets'), { recursive: true });
  for (const page of all) {
    const body = toHtml(page.blocks, { link: htmlLink, render: renderHtml });
    write(page.html, layout({ title: page.meta.title, description: page.meta.description, url: page.url, markdown: page.markdown, body }));
    write(page.markdown, markdownPage(page));
  }
  write('search/index.html', searchPage());
  write('404.html', notFoundPage());
  write('llms.txt', llmsTxt(all));
  write('sitemap.xml', sitemap(all));
  write('robots.txt', `User-agent: *${NL}Allow: /${NL}Sitemap: ${config.url}/sitemap.xml${NL}`);

  const pagefind = await import('pagefind');
  const { index, errors } = await pagefind.createIndex({});
  if (errors.length > 0) throw new Error(`pagefind: ${errors.join('; ')}`);
  const added = await index.addDirectory({ path: SITE });
  if (added.errors.length > 0) throw new Error(`pagefind: ${added.errors.join('; ')}`);
  const written = await index.writeFiles({ outputPath: path.join(SITE, 'pagefind') });
  if (written.errors.length > 0) throw new Error(`pagefind: ${written.errors.join('; ')}`);
  await pagefind.close();
  if (!existsSync(path.join(SITE, 'pagefind', 'pagefind-ui.js'))) throw new Error('pagefind wrote no pagefind-ui.js');
  const entry = JSON.parse(readFileSync(path.join(SITE, 'pagefind', 'pagefind-entry.json'), 'utf8'));
  const indexed = Object.values(entry.languages).reduce((sum, language) => sum + language.page_count, 0);
  process.stdout.write(`built ${all.length} pages into _site/; Pagefind ${entry.version} indexed ${indexed}${NL}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'scripts', 'build.mjs')) {
  main().catch((error) => {
    process.stderr.write(`build: ${error.message}${NL}`);
    process.exitCode = 1;
  });
}
