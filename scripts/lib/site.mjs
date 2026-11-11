/**
 * What the capture, the build and the check share: the configuration, the
 * versions package.json pins, the outputs the tools printed, and the pages.
 *
 * No backslash in this file: see markdown.mjs.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NL } from './markdown.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TOOLS = ['spec-brief', 'spec-graph', 'spec-guard', 'spec-harness'];
export const OUTPUTS = path.join(ROOT, 'outputs');
export const CONTENT = path.join(ROOT, 'content');

export const config = readJson(path.join(ROOT, 'site.json'));

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** The version package.json pins for each tool, which must be exact. */
export function pins() {
  const manifest = readJson(path.join(ROOT, 'package.json'));
  const out = {};
  for (const name of [...TOOLS, 'pagefind']) {
    const key = name === 'pagefind' ? name : `@spec-family/${name}`;
    const version = manifest.devDependencies?.[key];
    if (!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(version ?? '')) throw new Error(`package.json pins ${key} as "${version}": pin one exact version`);
    out[name] = version;
  }
  return out;
}

/** The manifest of a tool as npm installed it. */
export function installed(name) {
  const file = path.join(ROOT, 'node_modules', ...(name === 'pagefind' ? [name] : ['@spec-family', name]), 'package.json');
  if (!existsSync(file)) throw new Error(`${name} is not installed: run npm ci`);
  return readJson(file);
}

/** Fails unless every installed tool is the release package.json pins. */
export function checkInstalled() {
  const pinned = pins();
  for (const [name, version] of Object.entries(pinned)) {
    const found = installed(name).version;
    if (found !== version) throw new Error(`${name} ${found} is installed where package.json pins ${version}: run npm ci`);
  }
  return pinned;
}

/** The Node release the tools ask for, as one number: every tool must ask for the same `>=N`. */
export function nodeMajor() {
  const asked = new Set(TOOLS.map((tool) => installed(tool).engines?.node));
  const [only] = asked;
  const match = /^>=[ ]*([0-9]+)$/.exec(only ?? '');
  if (asked.size !== 1 || match === null) throw new Error(`the tools ask for Node as ${[...asked].join(', ')}; the pages say one release`);
  return match[1];
}

/** A tool's runtime dependencies, as its installed manifest lists them: what npm installs with it, peers aside. */
export function runtimeDependencies(tool) {
  const manifest = installed(tool);
  return Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies });
}

/** A tool's peer dependencies, the ones it needs and the ones it uses where they are installed. */
export function peers(tool) {
  const manifest = installed(tool);
  const names = Object.keys(manifest.peerDependencies ?? {});
  const optional = (name) => manifest.peerDependenciesMeta?.[name]?.optional === true;
  return { required: names.filter((name) => !optional(name)), optional: names.filter(optional) };
}

// ---------------------------------------------------------------------------
// Links

export const short = (commit) => commit.slice(0, 7);
export const releaseTag = (tool) => `v${pins()[tool]}`;
export const releaseBlob = (tool, file) => `https://github.com/spec-family/${tool}/blob/${releaseTag(tool)}/${file}`;
export const releaseRaw = (tool, file) => `https://raw.githubusercontent.com/spec-family/${tool}/${releaseTag(tool)}/${file}`;
export const exampleBlob = (file) => `https://github.com/${config.example.repository}/blob/${config.example.commit}/${file}`;
export const exampleCommit = () => `https://github.com/${config.example.repository}/commit/${config.example.commit}`;
export const pull = (id) => `https://github.com/${config.example.repository}/pull/${story(id).pull}`;
export const manifestUrl = (tool) => `https://registry.npmjs.org/@spec-family%2f${tool}/${pins()[tool]}`;
export const npmPage = (tool) => `https://www.npmjs.com/package/@spec-family/${tool}/v/${pins()[tool]}`;

export function story(id) {
  const found = config.stories.find((s) => s.id === id);
  if (found === undefined) throw new Error(`site.json has no story "${id}"`);
  return found;
}

/** The tool a command runs, if it runs one of the four. */
export function toolOf(command) {
  return /@spec-family[/](spec-[a-z]+)/.exec(command)?.[1];
}

/** "spec-brief 0.13.1, spec-graph 0.24.1, spec-guard 0.33.2 and spec-harness 0.24.2" */
export function versionList(tools = TOOLS) {
  const named = tools.map((tool) => `${tool} ${pins()[tool]}`);
  return named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
}

// ---------------------------------------------------------------------------
// What the tools printed

/**
 * A line as the check compares it: a commit id and a duration differ from
 * run to run, so each is compared as a kind. The example repository's own
 * README check compares the same way.
 */
export function normalize(line) {
  return line
    .replace(/(?<![0-9A-Za-z_])[0-9a-f]{7,40}(?![0-9A-Za-z_])/g, '<commit>')
    .replace(/(?<![0-9A-Za-z_.])[0-9]+(?:[.][0-9]+)?m?s(?![0-9A-Za-z_])/g, '<time>');
}

export function outputFile(kind, id) {
  return path.join(OUTPUTS, kind, `${id}.json`);
}

export function loadOutput(kind, id) {
  const file = outputFile(kind, id);
  if (!existsSync(file)) throw new Error(`outputs/${kind}/${id}.json is missing: run npm run capture`);
  return readJson(file);
}

export function loadExample() {
  return readJson(path.join(OUTPUTS, 'example.json'));
}

/**
 * What the example repository's `npm run demo` prints, read back into its
 * stories. The demo prints a story as `== <branch>`, then each paragraph on a
 * line of its own between blank lines, each command after `$ `, what the
 * command printed indented by two spaces, and `(exit N)`, indented the same,
 * after a tool's command.
 */
export function parsePlay(text) {
  const stories = [];
  let current = null;
  let step = null;
  const lines = text.replaceAll(String.fromCharCode(13), '').split(NL);
  lines.forEach((line, index) => {
    const where = `demo output line ${index + 1}`;
    if (line.startsWith('== ')) {
      current = { branch: line.slice(3), steps: [] };
      stories.push(current);
      step = null;
    } else if (line === '') {
      step = null;
    } else if (current === null) {
      throw new Error(`${where} comes before any story: ${line}`);
    } else if (line.startsWith('$ ')) {
      step = { run: line.slice(2), output: [] };
      current.steps.push(step);
    } else if (line.startsWith('  ')) {
      if (step === null) throw new Error(`${where} is indented as a command's output, and follows no command: ${line}`);
      const exit = /^ {2}[(]exit ([0-9]+)[)]$/.exec(line);
      if (exit !== null) {
        step.exit = Number(exit[1]);
        step = null;
      } else {
        step.output.push(line.slice(2));
      }
    } else {
      current.steps.push({ say: line });
      step = null;
    }
  });
  return stories;
}

// ---------------------------------------------------------------------------
// Pages

/** Every page of the site, from content/: its source, its URL, and the files it is written to. */
export function pages() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.md')) {
        const relative = path.relative(CONTENT, file).split(path.sep).join('/');
        const stem = relative.slice(0, -3);
        const dirUrl = stem === 'index' ? '/' : stem.endsWith('/index') ? `/${stem.slice(0, -5)}` : `/${stem}/`;
        out.push({ source: file, relative, url: dirUrl, html: `${dirUrl}index.html`, markdown: `${dirUrl}index.md` });
      }
    }
  };
  walk(CONTENT);
  return out;
}
