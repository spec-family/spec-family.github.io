/**
 * Whether the site still shows the family as it is, for the scheduled run.
 *
 *   npm run latest
 *
 * - Each package package.json pins is the release npm calls latest.
 * - The example's main is the commit site.json pins.
 * - Each story's pull request is open, on its branch, and red in the job
 *   site.json names and in no other, as the story pages say.
 *
 * A failure here is not a broken site: it says a bump is due (see README).
 * It reads the npm registry, git and the GitHub API; with GITHUB_TOKEN set,
 * it sends the token to api.github.com only.
 *
 * No backslash in this file: see the README's conventions.
 */

import { spawnSync } from 'node:child_process';
import { NL } from './lib/markdown.mjs';
import { config, pins } from './lib/site.mjs';

const problems = [];
const notes = [];

async function json(url, headers = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'spec-family-site', ...headers } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

async function checkReleases() {
  for (const [name, pinned] of Object.entries(pins())) {
    const packageName = name === 'pagefind' ? name : `@spec-family/${name}`;
    const latest = (await json(`https://registry.npmjs.org/${packageName.replace('/', '%2f')}/latest`)).version;
    if (latest === pinned) notes.push(`${packageName} ${pinned} is latest`);
    else problems.push(`${packageName}: the site pins ${pinned}, and npm's latest is ${latest}`);
  }
}

function checkExample() {
  const url = `https://github.com/${config.example.repository}.git`;
  const result = spawnSync('git', ['ls-remote', url, 'refs/heads/main'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ls-remote ${url} failed: ${result.stderr}`);
  const main = result.stdout.split(String.fromCharCode(9))[0].trim();
  if (main === config.example.commit) notes.push(`${config.example.repository} main is ${main.slice(0, 7)}, as pinned`);
  else problems.push(`${config.example.repository}: main is ${main.slice(0, 7)}, and the site pins ${config.example.commit.slice(0, 7)}`);
}

async function checkPulls() {
  const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const api = `https://api.github.com/repos/${config.example.repository}`;
  for (const story of config.stories) {
    const pull = await json(`${api}/pulls/${story.pull}`, headers);
    const where = `${config.example.repository}#${story.pull}`;
    if (pull.state !== 'open') problems.push(`${where} is ${pull.state}; the story ${story.id} says it is left open`);
    if (pull.head.ref !== story.branch) problems.push(`${where} is on ${pull.head.ref}, not ${story.branch}`);
    const { check_runs: runs } = await json(`${api}/commits/${pull.head.sha}/check-runs?per_page=100`, headers);
    const red = runs.filter((run) => run.conclusion === 'failure').map((run) => run.name).sort();
    if (runs.some((run) => run.status !== 'completed')) notes.push(`${where}: some checks are still running`);
    else if (red.length !== 1 || red[0] !== story.red) problems.push(`${where}: red in ${red.join(', ') || 'nothing'}, where the story says ${story.red} and nothing else`);
    else notes.push(`${where} is open and red in ${story.red} alone`);
  }
}

try {
  await checkReleases();
  checkExample();
  await checkPulls();
  for (const note of notes) process.stdout.write(`ok  ${note}${NL}`);
  for (const problem of problems) process.stdout.write(`due ${problem}${NL}`);
  if (problems.length > 0) {
    process.stdout.write(`${problems.length} thing(s) the site no longer shows as they are: bump as the README says${NL}`);
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`latest: ${error.message}${NL}`);
  process.exitCode = 2;
}
