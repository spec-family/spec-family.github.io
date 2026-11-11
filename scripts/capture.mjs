/**
 * Plays every output this site shows, with the tools at the versions
 * package.json pins, on the example repository at the commit site.json pins.
 *
 *   npm run capture              write what they print to outputs/
 *   npm run capture -- --check   fail where outputs/ no longer reads as they print
 *
 * The example repository is cloned into a temporary directory, its `main`
 * set to the pinned commit, and this checkout's node_modules linked in, so
 * `npx --no-install @spec-family/<tool>` there runs the pinned release:
 *
 * - each run in site.json is one command on that checkout, which must exit
 *   as site.json says and leave the checkout as it found it;
 * - the stories are what the example's own `scripts/demo.mjs` prints, played
 *   in its throwaway copy of that checkout, read back by parsePlay.
 *
 * A commit id and a duration are compared as kinds (normalize in site.mjs),
 * and a capture that reads as the last one apart from them leaves the file
 * as it was, so a recapture changes only what changed.
 *
 * No backslash in this file: see the README's conventions.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NL } from './lib/markdown.mjs';
const BT = String.fromCharCode(96);
import { checkInstalled, config, normalize, outputFile, OUTPUTS, parsePlay, ROOT, toolOf } from './lib/site.mjs';

const CR = String.fromCharCode(13);

/**
 * The environment a reader's terminal would give the tools: no colour, and
 * nothing of CI's that names a branch or a brief. The tools draw their marks
 * in ASCII on Windows unless a terminal that draws them says it is there; the
 * pages show them as every other platform prints them.
 */
function environment() {
  const env = { ...process.env, NO_COLOR: '1' };
  for (const name of Object.keys(env)) {
    if (name === 'CI' || name.startsWith('GITHUB_') || name.startsWith('RUNNER_') || name.startsWith('CI_')) delete env[name];
  }
  for (const name of ['FORCE_COLOR', 'SPEC_BRIEF', 'CLAUDE_PROJECT_DIR', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[name];
  if (process.platform === 'win32' && !env.WT_SESSION && !env.TERM_PROGRAM) env.TERM_PROGRAM = 'spec-family-site';
  return env;
}

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function lines(text) {
  const out = text
    .split(NL)
    .map((line) => (line.endsWith(CR) ? line.slice(0, -1) : line))
    .filter((line) => !/^npm (?:notice|warn)/.test(line));
  while (out.length > 0 && out.at(-1) === '') out.pop();
  return out;
}

/** A clone of the example repository with `main` at the pinned commit and this checkout's tools linked in. */
function cloneExample() {
  const home = mkdtempSync(path.join(tmpdir(), 'spec-family-site-'));
  const repo = path.join(home, 'example');
  const { repository, commit } = config.example;
  const source = process.env.SPEC_FAMILY_EXAMPLE ?? `https://github.com/${repository}.git`;
  git(home, 'clone', '--quiet', '--no-checkout', source, repo);
  git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'checkout', '--quiet', '-B', 'main', commit);
  const head = git(repo, 'rev-parse', 'HEAD').trim();
  if (head !== commit) throw new Error(`the example's main is ${head}, not the pinned ${commit}`);
  symlinkSync(path.join(ROOT, 'node_modules'), path.join(repo, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // The example ignores `node_modules/`, a directory; on Linux the link is a
  // file to git, so it is excluded as itself, or git would list it as new.
  appendFileSync(path.join(repo, '.git', 'info', 'exclude'), `/node_modules${NL}`);
  return { home, repo };
}

function removeExample({ home, repo }) {
  // The link first, on its own, so that nothing it leads to is removed.
  if (existsSync(path.join(repo, 'node_modules'))) unlinkSync(path.join(repo, 'node_modules'));
  rmSync(home, { recursive: true, force: true });
}

/** One run of site.json: the command as a reader would type it, in their shell. */
function capture(repo, env, run, pinned) {
  const command = ['npx', '--no-install', `@spec-family/${run.id}`, ...run.args].join(' ');
  const result = spawnSync(command, { cwd: repo, env, shell: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  const output = lines(result.stdout + result.stderr);
  if (result.status !== run.exit) throw new Error(`${BT}${command}${BT} exited ${result.status}, where site.json expects ${run.exit}:${NL}${output.join(NL)}`);
  const changed = git(repo, 'status', '--porcelain');
  if (changed !== '') throw new Error(`${BT}${command}${BT} changed the example's checkout:${NL}${changed}`);
  return { id: run.id, package: `@spec-family/${run.id}`, version: pinned[run.id], where: `${config.example.repository}@${config.example.commit}`, command, exit: result.status, output };
}

/** The example's stories, as its `npm run demo` prints them with the pinned tools. */
function stories(repo, env, pinned) {
  const result = spawnSync(process.execPath, ['scripts/demo.mjs'], { cwd: repo, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`the example's demo exited ${result.status}:${NL}${result.stderr}${result.stdout}`);
  const played = parsePlay(result.stdout);
  const out = [];
  for (const { id, branch } of config.stories) {
    const found = played.find((s) => s.branch === branch);
    if (found === undefined) throw new Error(`the example's demo played no story on ${branch}; it played ${played.map((s) => s.branch).join(', ')}`);
    const tools = [...new Set(found.steps.map((step) => toolOf(step.run ?? '')).filter(Boolean))].sort();
    out.push({ id, branch, where: `${config.example.repository}@${config.example.commit}`, played: 'scripts/demo.mjs', versions: Object.fromEntries(tools.map((tool) => [tool, pinned[tool]])), steps: found.steps });
  }
  const extra = played.filter((s) => !config.stories.some((c) => c.branch === s.branch));
  if (extra.length > 0) throw new Error(`the example's demo plays ${extra.map((s) => s.branch).join(', ')}, which site.json does not show`);
  return out;
}

const pretty = (value) => JSON.stringify(value, null, 2) + NL;

/** The text as the check compares it: what a command printed, commit ids and durations as kinds. */
function comparable(value) {
  const copy = structuredClone(value);
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (key === 'output' && Array.isArray(child)) node[key] = child.map(normalize);
        else walk(child);
      }
    }
  };
  walk(copy);
  return pretty(copy);
}

function main(args) {
  const check = args.includes('--check');
  const pinned = checkInstalled();
  const env = environment();
  const example = cloneExample();
  const files = new Map();
  try {
    for (const run of config.runs) files.set(outputFile('runs', run.id), capture(example.repo, env, run, pinned));
    for (const played of stories(example.repo, env, pinned)) files.set(outputFile('stories', played.id), played);
    const tracked = git(example.repo, 'ls-files', '-z').split(String.fromCharCode(0)).filter(Boolean).sort();
    files.set(path.join(OUTPUTS, 'example.json'), { repository: config.example.repository, commit: config.example.commit, files: tracked });
  } finally {
    removeExample(example);
  }

  let drift = 0;
  let written = 0;
  for (const [file, value] of files) {
    const name = path.relative(ROOT, file).split(path.sep).join('/');
    const before = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    const same = before !== undefined && comparable(JSON.parse(before)) === comparable(value);
    if (check) {
      if (same) continue;
      drift++;
      if (before === undefined) {
        process.stdout.write(`${name} is missing${NL}`);
        continue;
      }
      const want = comparable(value).split(NL);
      const have = comparable(JSON.parse(before)).split(NL);
      const at = want.findIndex((line, k) => line !== have[k]);
      process.stdout.write(`${name}:${at + 1} no longer reads as the tools print${NL}  outputs/ has:   ${(have[at] ?? '(the end)').trim()}${NL}  the tools say:  ${(want[at] ?? '(the end)').trim()}${NL}`);
    } else if (!same) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, pretty(value));
      process.stdout.write(`wrote ${name}${NL}`);
      written++;
    }
  }
  if (check) {
    if (drift > 0) {
      process.stdout.write(`${drift} file(s) in outputs/ no longer read as the pinned tools print; run npm run capture, read the diff, and commit it${NL}`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`outputs/ reads as ${Object.entries(pinned).filter(([n]) => n !== 'pagefind').map(([n, v]) => `${n} ${v}`).join(', ')} print on ${config.example.repository}@${config.example.commit.slice(0, 7)}${NL}`);
    }
  } else if (written === 0) {
    process.stdout.write(`outputs/ already reads as the pinned tools print${NL}`);
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`capture: ${error.message}${NL}`);
  process.exitCode = 1;
}
