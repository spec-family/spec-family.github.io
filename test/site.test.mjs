import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fill } from '../scripts/build.mjs';
import { NL } from '../scripts/lib/markdown.mjs';
import { normalize, parsePlay, pins, toolOf, versionList } from '../scripts/lib/site.mjs';

const lines = (...text) => text.join(NL);

test('parsePlay reads the demo back into paragraphs, commands, output and exit codes', () => {
  const played = parsePlay(
    lines(
      '',
      '== story/one',
      '',
      'The agent works on a branch:',
      '',
      '$ git switch -c story/one',
      "  Switched to a new branch 'story/one'",
      '',
      'The guard answers:',
      '',
      '$ npx --no-install @spec-family/spec-harness guard src/a.js',
      '  refused  src/a.js',
      '  ',
      '           next line',
      '  (exit 1)',
      '$ git add -A',
      '',
      '== story/two',
      '',
      'Nothing.',
      '',
    ),
  );
  assert.equal(played.length, 2);
  assert.equal(played[0].branch, 'story/one');
  assert.deepEqual(played[0].steps, [
    { say: 'The agent works on a branch:' },
    { run: 'git switch -c story/one', output: ["Switched to a new branch 'story/one'"] },
    { say: 'The guard answers:' },
    { run: 'npx --no-install @spec-family/spec-harness guard src/a.js', output: ['refused  src/a.js', '', '         next line'], exit: 1 },
    { run: 'git add -A', output: [] },
  ]);
  assert.deepEqual(played[1].steps, [{ say: 'Nothing.' }]);
});

test('parsePlay refuses output that follows no command', () => {
  assert.throws(() => parsePlay(lines('== story/one', '', 'Said.', '  stray')), /follows no command/);
});

test('normalize compares commit ids and durations as kinds', () => {
  assert.equal(normalize('audit of brief 001 from main (ae2c55c7f98c)'), 'audit of brief 001 from main (<commit>)');
  assert.equal(normalize('2 errors · 167.47ms'), '2 errors · <time>');
  assert.equal(normalize('6 passed · 33ms'), '6 passed · <time>');
  assert.equal(normalize('spec-guard 0.33.2'), 'spec-guard 0.33.2');
});

test('toolOf names the tool a command runs', () => {
  assert.equal(toolOf("echo '{}' | npx --no-install @spec-family/spec-harness hook claude"), 'spec-harness');
  assert.equal(toolOf('git add -A'), undefined);
});

test('fill takes placeholders from the pins and refuses unknown ones', () => {
  assert.equal(fill('{{version:spec-guard}}', 'test'), pins()['spec-guard']);
  assert.equal(fill('{{versions}}', 'test'), versionList());
  assert.throws(() => fill('{{nothing}}', 'here'), /no placeholder the build knows/);
  assert.throws(() => fill('{{version:spec-other}}', 'here'), /names no tool/);
  assert.throws(() => fill('{{version}}', 'here'), /needs an argument/);
});
