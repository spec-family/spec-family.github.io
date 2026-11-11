/**
 * Checks the built site in _site/ against what it says it shows.
 *
 *   npm run check
 *
 * - outputs/ is what the releases package.json pins printed, on the commit
 *   site.json pins (`npm run capture -- --check` proves the printing; this
 *   proves the labels), and every output is on a page, in its HTML and its
 *   Markdown, line for line.
 * - Every version the pages name is the pinned one; every link into a tool's
 *   release names the pinned tag and a file and heading that release ships;
 *   every link into the example names the pinned commit and a file it holds;
 *   every link within the site reaches a page and an id on it; and a link
 *   whose text names rules or commands in code reaches a page that names them.
 * - No `npx` runs a name without `--no-install` and the scope.
 * - The pages load nothing from another site, and each has a language, one
 *   h1, headings in order, alt text, keyboard-reachable scrolling regions and
 *   colours that meet WCAG AA in both themes.
 * - llms.txt has the shape llmstxt.org v2 gives it and lists every page.
 *
 * No backslash in this file: see the README's conventions.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { readPages, SITE } from './build.mjs';
import { escapeHtml, inline, NL, outsideFences, parse, plainText, slugger } from './lib/markdown.mjs';
import { checkInstalled, config, loadExample, loadOutput, OUTPUTS, pins, ROOT, TOOLS } from './lib/site.mjs';

const BT = String.fromCharCode(96);
const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

const decode = (html) => html.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
const stripTags = (html) => decode(html.replace(/<[^>]*>/g, ''));

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(file));
    else out.push(file);
  }
  return out;
}

const siteFile = (file) => path.relative(SITE, file).split(path.sep).join('/');

// ---------------------------------------------------------------------------
// outputs/

function checkOutputs(pinned) {
  const expected = new Set(['example.json']);
  for (const run of config.runs) {
    expected.add(`runs/${run.id}.json`);
    const output = loadOutput('runs', run.id);
    const command = ['npx', '--no-install', `@spec-family/${run.id}`, ...run.args].join(' ');
    if (output.version !== pinned[run.id]) fail(`outputs/runs/${run.id}.json`, `printed by ${run.id} ${output.version}, where package.json pins ${pinned[run.id]}: run npm run capture`);
    if (output.command !== command) fail(`outputs/runs/${run.id}.json`, `holds ${BT}${output.command}${BT}, where site.json runs ${BT}${command}${BT}`);
    if (output.exit !== run.exit) fail(`outputs/runs/${run.id}.json`, `exited ${output.exit}, where site.json expects ${run.exit}`);
    if (output.where !== `${config.example.repository}@${config.example.commit}`) fail(`outputs/runs/${run.id}.json`, `was played on ${output.where}, not the pinned commit`);
  }
  for (const story of config.stories) {
    expected.add(`stories/${story.id}.json`);
    const played = loadOutput('stories', story.id);
    for (const [name, version] of Object.entries(played.versions)) {
      if (version !== pinned[name]) fail(`outputs/stories/${story.id}.json`, `played with ${name} ${version}, where package.json pins ${pinned[name]}: run npm run capture`);
    }
    if (played.where !== `${config.example.repository}@${config.example.commit}`) fail(`outputs/stories/${story.id}.json`, `was played on ${played.where}, not the pinned commit`);
    if (played.branch !== story.branch) fail(`outputs/stories/${story.id}.json`, `is the story of ${played.branch}, where site.json says ${story.branch}`);
  }
  const example = loadExample();
  if (example.commit !== config.example.commit) fail('outputs/example.json', `lists the files of ${example.commit}, not the pinned ${config.example.commit}`);
  for (const file of filesUnder(OUTPUTS)) {
    const name = path.relative(OUTPUTS, file).split(path.sep).join('/');
    if (!expected.has(name)) fail(`outputs/${name}`, 'is no output site.json asks for: remove it');
  }
}

// ---------------------------------------------------------------------------
// The pages against outputs/

function runText(block) {
  return block.commands.flatMap(({ line, output }) => [`$ ${line}`, ...output]);
}

function checkPagesShowOutputs(all) {
  const used = new Set();
  for (const page of all) {
    const html = readFileSync(path.join(SITE, page.html), 'utf8');
    const markdown = readFileSync(path.join(SITE, page.markdown), 'utf8');
    for (const block of page.blocks.filter((b) => b.type === 'run')) {
      const lines = runText(block);
      const missing = block.commands.find(({ line, output }) => !html.includes([`${escapeHtml(line)}</span>`, ...output.map(escapeHtml)].join(NL)));
      if (missing !== undefined) fail(page.html.slice(1), `does not show, line for line, what ${BT}${missing.line}${BT} printed`);
      if (!markdown.includes(lines.join(NL))) fail(page.markdown.slice(1), `does not hold, line for line, what ${BT}${block.commands.at(-1).line}${BT} printed`);
      if (block.exit !== undefined) {
        const label = block.version === undefined ? `Exit <code>${block.exit}</code>` : `Exit <code>${block.exit}</code> · ${block.tool} ${block.version}`;
        if (!html.includes(label)) fail(page.html.slice(1), `does not say ${BT}${block.commands.at(-1).line}${BT} exited ${block.exit}`);
      }
    }
    for (const block of parse(readFileSync(page.source, 'utf8')).blocks.filter((b) => b.type === 'directive')) used.add(`${block.name}:${block.arg}`);
  }
  for (const run of config.runs) if (!used.has(`run:${run.id}`)) fail('content/', `no page shows the run ${run.id} of site.json`);
  for (const story of config.stories) if (!used.has(`story:${story.id}`)) fail('content/', `no page tells the story ${story.id} of site.json`);
}

// ---------------------------------------------------------------------------
// Links

const headingIds = new Map();

/** The ids GitHub gives the headings of a Markdown file. */
function markdownIds(file) {
  if (!headingIds.has(file)) {
    const ids = new Set();
    const next = slugger();
    const lines = readFileSync(file, 'utf8').split(NL);
    const outside = outsideFences(lines);
    for (const [k, line] of lines.entries()) {
      const heading = outside[k] && /^#{1,6}[ ]+(.*)$/.exec(line);
      if (heading) ids.add(next(plainText(inline(heading[1].trim()))));
    }
    headingIds.set(file, ids);
  }
  return headingIds.get(file);
}

/** Where a link into a pinned release, a pinned commit or the registry leads, or a problem with it. */
function checkExternal(where, href, linkText, pinned) {
  const [address, anchor] = href.split('#');
  let match = /^https:[/][/]github[.]com[/]spec-family[/](spec-[a-z]+)[/](?:blob|tree)[/]([^/]+)[/](.*)$/.exec(address) ?? /^https:[/][/]raw[.]githubusercontent[.]com[/]spec-family[/](spec-[a-z]+)[/]([^/]+)[/](.*)$/.exec(address);
  if (match !== null && TOOLS.includes(match[1])) {
    const [, name, ref, file] = match;
    if (ref !== `v${pinned[name]}`) return fail(where, `${href} is ${name} at ${ref}, not the pinned v${pinned[name]}`);
    const local = path.join(ROOT, 'node_modules', '@spec-family', name, ...file.split('/'));
    if (!existsSync(local)) return fail(where, `${href}: ${name} ${pinned[name]} ships no ${file}`);
    if (anchor !== undefined && !markdownIds(local).has(anchor)) return fail(where, `${href}: ${file} in ${name} ${pinned[name]} has no heading #${anchor}`);
    if (statSync(local).isFile()) {
      const text = readFileSync(local, 'utf8');
      for (const code of linkText.codes) {
        const named = code.replace(/[*]$/, '');
        if (!text.includes(named) && !text.includes(named.replace(/^spec-[a-z]+ /, ''))) fail(where, `the link to ${file} names ${BT}${code}${BT}, which ${name} ${pinned[name]}'s ${file} does not`);
      }
    }
    return undefined;
  }
  match = /^https:[/][/](?:github[.]com[/]spec-family[/]example[/](?:blob|commit)|raw[.]githubusercontent[.]com[/]spec-family[/]example)[/]([0-9a-f]+)(?:[/](.*))?$/.exec(address);
  if (match !== null) {
    if (match[1] !== config.example.commit) return fail(where, `${href} is the example at ${match[1]}, not the pinned commit`);
    if (match[2] !== undefined && !loadExample().files.includes(match[2])) return fail(where, `${href}: the example at the pinned commit holds no ${match[2]}`);
    return undefined;
  }
  match = /^https:[/][/]github[.]com[/]spec-family[/]example[/]pull[/]([0-9]+)$/.exec(address);
  if (match !== null) {
    if (!config.stories.some((s) => String(s.pull) === match[1])) fail(where, `${href} is a pull request no story in site.json names`);
    return undefined;
  }
  match = /^https:[/][/](?:registry[.]npmjs[.]org[/]@spec-family%2f|www[.]npmjs[.]com[/]package[/]@spec-family[/])(spec-[a-z]+)[/](?:v[/])?([^/]+)$/.exec(address);
  if (match !== null) {
    if (match[2] !== pinned[match[1]]) fail(where, `${href} is ${match[1]} ${match[2]}, not the pinned ${pinned[match[1]]}`);
    return undefined;
  }
  if (!address.startsWith('https://')) fail(where, `${href} is not an https address`);
  return undefined;
}

function idsOf(html) {
  return new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
}

function resolveSitePath(pathname) {
  const file = path.join(SITE, ...pathname.split('/').filter(Boolean), ...(pathname.endsWith('/') ? ['index.html'] : []));
  return existsSync(file) && statSync(file).isFile() ? file : undefined;
}

function checkLinks(htmlFiles, pinned) {
  for (const file of htmlFiles) {
    const where = siteFile(file);
    const html = readFileSync(file, 'utf8');
    const own = idsOf(html);
    for (const anchor of html.matchAll(/<a href="([^"]*)"[^>]*>(.*?)<[/]a>/gs)) {
      const href = decode(anchor[1]);
      const inner = anchor[2];
      if (stripTags(inner).trim() === '' && !/<img [^>]*alt="[^"]+"/.test(inner)) fail(where, `the link to ${href} has no text`);
      const codes = [...inner.matchAll(/<code>(.*?)<[/]code>/g)].map((m) => decode(m[1]));
      if (href.startsWith('#')) {
        if (!own.has(href.slice(1))) fail(where, `${href} names no id on this page`);
      } else if (href.startsWith('/')) {
        const [pathname, id] = href.split('#');
        const target = resolveSitePath(pathname);
        if (target === undefined) fail(where, `${href} reaches no file of the site`);
        else if (id !== undefined && !idsOf(readFileSync(target, 'utf8')).has(id)) fail(where, `${href}: ${pathname} has no id ${id}`);
      } else {
        checkExternal(where, href, { codes }, pinned);
      }
    }
    for (const tag of html.matchAll(/<(script|link|img)[^>]*>/g)) {
      const attribute = /(?:src|href)="([^"]*)"/.exec(tag[0]);
      if (attribute === null) continue;
      const isResource = tag[1] !== 'link' || /rel="(?:stylesheet|icon|preload)"/.test(tag[0]);
      if (isResource && !attribute[1].startsWith('/')) fail(where, `loads ${attribute[1]} from outside the site`);
      if (isResource && resolveSitePath(attribute[1]) === undefined) fail(where, `loads ${attribute[1]}, which the site does not have`);
    }
  }
}

// ---------------------------------------------------------------------------
// Text

/** Markdown without its fenced blocks: what a tool printed may hold anything. */
function withoutFences(markdown) {
  const lines = markdown.split(NL);
  const outside = outsideFences(lines);
  return lines.filter((line, k) => outside[k]).join(NL);
}

function checkText(textFiles, pinned) {
  for (const file of textFiles) {
    const where = siteFile(file);
    const raw = readFileSync(file, 'utf8');
    const text = file.endsWith('.html') ? decode(raw) : raw;
    for (const m of text.matchAll(/(?<![A-Za-z0-9/-])(spec-(?:brief|graph|guard|harness))(?:@| v?)([0-9]+[.][0-9]+[.][0-9]+)/g)) {
      if (m[2] !== pinned[m[1]]) fail(where, `names ${m[1]} ${m[2]}, where package.json pins ${pinned[m[1]]}`);
    }
    for (const line of (file.endsWith('.html') ? stripTags(raw) : raw).split(NL)) {
      for (const m of line.matchAll(/(?<![A-Za-z-])npx[ ]+([^ ]+)(?:[ ]+([^ ]+))?/g)) {
        const scoped = /^@spec-family[/](?:spec-(?:brief|graph|guard|harness)|<tool>)$/.test((m[2] ?? '').replace(/[`.,;:)]+$/, ''));
        if (m[1] !== '--no-install' || !scoped) fail(where, `runs ${BT}${m[0]}${BT}: every npx here takes --no-install and a scoped name`);
      }
    }
    if (/(?<![A-Za-z])Mente(?![a-z])/.test(text)) fail(where, 'names Mente');
    if (file.endsWith('.md') && /<!--|[{][{]|[ ][{][.#][A-Za-z]/.test(withoutFences(raw))) fail(where, 'holds a comment, a placeholder or an attribute the build should have taken out');
  }
}

// ---------------------------------------------------------------------------
// Accessibility

function checkAccessibility(htmlFiles) {
  for (const file of htmlFiles) {
    const where = siteFile(file);
    const html = readFileSync(file, 'utf8');
    if (!html.startsWith('<!doctype html>')) fail(where, 'does not start with <!doctype html>');
    if (!/<html lang="en">/.test(html)) fail(where, 'has no lang="en"');
    if (!/<title>[^<]+<[/]title>/.test(html)) fail(where, 'has no title');
    if (!html.includes('<a class="skip" href="#main">') || !html.includes('<main id="main"')) fail(where, 'has no skip link to its main');
    const headings = [...html.matchAll(/<h([1-6])[^>]*>(.*?)<[/]h[1-6]>/g)].map((m) => ({ level: Number(m[1]), text: stripTags(m[2]) }));
    if (headings.filter((h) => h.level === 1).length !== 1) fail(where, `has ${headings.filter((h) => h.level === 1).length} h1, not one`);
    headings.forEach((h, k) => {
      if (k > 0 && h.level > headings[k - 1].level + 1) fail(where, `"${h.text}" is an h${h.level} under an h${headings[k - 1].level}`);
    });
    const title = /<title>([^<]*)<[/]title>/.exec(html)?.[1] ?? '';
    for (const name of [title, ...headings.map((h) => h.text)]) {
      if (/Claude|Anthropic/.test(name)) fail(where, `"${name}" puts another company's product name in a heading or title`);
    }
    for (const img of html.matchAll(/<img [^>]*>/g)) if (!/ alt="[^"]*"/.test(img[0])) fail(where, `${img[0]} has no alt`);
    for (const pre of html.matchAll(/<pre[^>]*>/g)) if (!pre[0].includes('tabindex="0"')) fail(where, 'a <pre> cannot be scrolled from the keyboard');
    for (const region of html.matchAll(/<div class="table"[^>]*>/g)) if (!/aria-label="[^"]+"/.test(region[0]) || !region[0].includes('tabindex="0"')) fail(where, 'a table region has no label or cannot be reached from the keyboard');
  }
}

/** WCAG's contrast ratio of two #rrggbb colours. */
function contrast(a, b) {
  const luminance = (hex) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function checkContrast() {
  const css = readFileSync(path.join(ROOT, 'assets', 'site.css'), 'utf8');
  const blocks = [...css.matchAll(/:root[ ]*[{]([^}]*)[}]/g)].map((m) => Object.fromEntries([...m[1].matchAll(/--([a-z-]+):[ ]*(#[0-9a-f]{6})/g)].map((v) => [v[1], v[2]])));
  if (blocks.length !== 2) return fail('assets/site.css', `has ${blocks.length} :root colour blocks, not a light and a dark one`);
  const [light, darkOnly] = blocks;
  const themes = { light, dark: { ...light, ...darkOnly } };
  const text = [['fg', 'bg'], ['muted', 'bg'], ['accent', 'bg'], ['claim', 'bg'], ['fg', 'surface'], ['muted', 'surface'], ['accent', 'surface'], ['accent-fg', 'accent'], ['term-fg', 'term-bg'], ['term-muted', 'term-bg']];
  for (const [theme, colours] of Object.entries(themes)) {
    for (const [fore, back] of text) {
      const ratio = contrast(colours[fore], colours[back]);
      if (ratio < 4.5) fail('assets/site.css', `${theme}: --${fore} on --${back} has contrast ${ratio.toFixed(2)}, under 4.5`);
    }
    for (const back of ['bg', 'surface', 'term-bg']) {
      const ratio = contrast(colours.focus, colours[back]);
      if (ratio < 3) fail('assets/site.css', `${theme}: the focus ring on --${back} has contrast ${ratio.toFixed(2)}, under 3`);
    }
  }
  if (/@import|url[(][ ]*['"]?https?:/.test(css)) fail('assets/site.css', 'loads something from another site');
}

// ---------------------------------------------------------------------------
// For agents

function checkForAgents(all) {
  const file = path.join(SITE, 'llms.txt');
  if (!existsSync(file)) return fail('llms.txt', 'is missing');
  const lines = readFileSync(file, 'utf8').split(NL);
  if (lines[0] !== `# ${config.name}`) fail('llms.txt', `starts "${lines[0]}", not with the site's name as its one H1`);
  const firstText = lines.slice(1).find((line) => line.trim() !== '');
  if (!firstText?.startsWith('> ')) fail('llms.txt', 'has no blockquote summary after its H1');
  let inLists = false;
  const listed = new Set();
  lines.forEach((line, k) => {
    if (line.startsWith('## ')) inLists = true;
    else if (/^#/.test(line) && k > 0) fail(`llms.txt:${k + 1}`, 'is a heading other than the H1 and the H2 file lists');
    else if (inLists && line.trim() !== '') {
      const middle = line.indexOf('](');
      const end = middle < 0 ? -1 : line.indexOf(')', middle);
      const rest = end < 0 ? '' : line.slice(end + 1);
      const isItem = line.startsWith('- [') && middle > 3 && end > middle + 2 && (rest === '' || rest.startsWith(': '));
      if (!isItem) fail(`llms.txt:${k + 1}`, 'is not a list item "- [name](url): notes" under an H2');
      else listed.add(line.slice(middle + 2, end));
    }
  });
  for (const page of all) {
    const address = `${config.url}${page.markdown}`;
    if (!listed.has(address)) fail('llms.txt', `does not list ${address}`);
    const html = readFileSync(path.join(SITE, page.html), 'utf8');
    if (!html.includes(`<link rel="alternate" type="text/markdown" href="${page.markdown}">`)) fail(page.html.slice(1), 'does not point to its Markdown version');
    if (!html.includes('<link rel="describedby" href="/llms.txt">')) fail(page.html.slice(1), 'does not point to /llms.txt');
    if (!/For agents: <a href="[/]llms[.]txt">/.test(html)) fail(page.html.slice(1), 'has no visible line pointing agents to /llms.txt');
  }
  for (const address of listed) {
    if (address.startsWith(config.url) && resolveSitePath(address.slice(config.url.length)) === undefined) fail('llms.txt', `lists ${address}, which the site does not have`);
    else if (!address.startsWith(config.url)) checkExternal('llms.txt', address, { codes: [] }, pins());
  }
  const sitemap = readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
  for (const page of all) if (!sitemap.includes(`<loc>${config.url}${page.url}</loc>`)) fail('sitemap.xml', `does not list ${page.url}`);
}

function checkSearch(all, pinned) {
  const entry = path.join(SITE, 'pagefind', 'pagefind-entry.json');
  if (!existsSync(entry)) return fail('pagefind/', 'has no index: the build runs Pagefind');
  const index = JSON.parse(readFileSync(entry, 'utf8'));
  if (index.version !== pinned.pagefind) fail('pagefind/pagefind-entry.json', `was written by Pagefind ${index.version}, not the pinned ${pinned.pagefind}`);
  const count = Object.values(index.languages).reduce((sum, language) => sum + language.page_count, 0);
  if (count !== all.length) fail('pagefind/pagefind-entry.json', `indexes ${count} pages, where the site has ${all.length}`);
}

// ---------------------------------------------------------------------------

function main() {
  const pinned = checkInstalled();
  if (!existsSync(SITE)) throw new Error('_site/ is missing: run npm run build');
  checkOutputs(pinned);
  const all = readPages();
  const htmlFiles = filesUnder(SITE).filter((file) => file.endsWith('.html') && !siteFile(file).startsWith('pagefind/'));
  const textFiles = filesUnder(SITE).filter((file) => /[.](html|md|txt)$/.test(file) && !siteFile(file).startsWith('pagefind/'));
  for (const page of all) {
    for (const file of [page.html, page.markdown]) if (!existsSync(path.join(SITE, file))) fail(file.slice(1), 'was not built');
  }
  checkPagesShowOutputs(all);
  checkLinks(htmlFiles, pinned);
  checkText(textFiles, pinned);
  checkAccessibility(htmlFiles);
  checkContrast();
  checkForAgents(all);
  checkSearch(all, pinned);
  if (problems.length > 0) {
    process.stdout.write(problems.join(NL) + NL + `${problems.length} problem(s) in _site/${NL}`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`_site/ holds ${all.length} pages, each showing what ${TOOLS.map((name) => `${name} ${pinned[name]}`).join(', ')} printed, and checks out${NL}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`check: ${error.message}${NL}`);
  process.exitCode = 1;
}
