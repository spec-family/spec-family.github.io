import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fenceFor, inline, inlineHtml, inlineMarkdown, links, NL, outsideFences, parse, rewriteLinks, slug, slugger, toHtml, toMarkdown } from '../scripts/lib/markdown.mjs';

const lines = (...text) => text.join(NL);
const BT = String.fromCharCode(96);
const code = (text) => BT + text + BT;

test('a link whose text is code keeps both', () => {
  const tokens = inline(`With [${code('.claude/settings.json')}](.claude/settings.json), it asks`);
  assert.equal(inlineHtml(tokens), 'With <a href=".claude/settings.json"><code>.claude/settings.json</code></a>, it asks');
  assert.equal(inlineMarkdown(tokens), `With [${code('.claude/settings.json')}](.claude/settings.json), it asks`);
});

test('a glob in code is not emphasis, and text is escaped', () => {
  assert.equal(inlineHtml(inline(`${code('docs/**')} and <b> & **bold**`)), '<code>docs/**</code> and &lt;b&gt; &amp; <strong>bold</strong>');
});

test('a code span may hold a backtick when its fence is longer', () => {
  const tokens = inline(`${BT}${BT} a ${BT} b ${BT}${BT}`);
  assert.deepEqual(tokens, [{ t: 'code', v: `a ${BT} b` }]);
  assert.equal(inlineMarkdown(tokens), `${BT}${BT}a ${BT} b${BT}${BT}`);
});

test('links lists every href, nested ones included', () => {
  assert.deepEqual(links(`[a](/x/) and **[b](https://y)**`), ['/x/', 'https://y']);
});

test('slug gives the ids GitHub gives headings', () => {
  assert.equal(slug('Checklists and ledgers, held to what they cite'), 'checklists-and-ledgers-held-to-what-they-cite');
  assert.equal(slug(`${code('guard <path...>')} and the hooks`), 'guard-path-and-the-hooks');
  assert.equal(slug('Which document do you want to keep true?'), 'which-document-do-you-want-to-keep-true');
  const next = slugger();
  assert.deepEqual([next('Usage'), next('Usage'), next('Usage')], ['usage', 'usage-1', 'usage-2']);
});

test('parse reads front matter, headings with attributes, tables, lists and directives', () => {
  const { meta, blocks } = parse(
    lines(
      '---',
      'title: A page',
      'order: 2',
      '---',
      '',
      '# A page {.home-title}',
      '',
      'Some text',
      'over two lines. {.claim}',
      '',
      '| One | Two |',
      '| --- | --- |',
      `| a | ${code('b|c')} |`,
      '',
      '- first',
      '  continued',
      '- second',
      '',
      '<!-- run: spec-guard -->',
      '<!-- a note, dropped -->',
      '',
      '## Two {#two .card}',
    ),
  );
  assert.deepEqual(meta, { title: 'A page', order: '2' });
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['heading', 'paragraph', 'table', 'list', 'directive', 'heading'],
  );
  assert.deepEqual(blocks[0].classes, ['home-title']);
  assert.equal(blocks[1].text, lines('Some text', 'over two lines.'));
  assert.deepEqual(blocks[1].classes, ['claim']);
  assert.deepEqual(blocks[2].rows, [['a', code('b|c')]]);
  assert.deepEqual(blocks[3].items, [lines('first', 'continued'), 'second']);
  assert.deepEqual([blocks[4].name, blocks[4].arg], ['run', 'spec-guard']);
  assert.deepEqual([blocks[5].id, blocks[5].classes], ['two', ['card']]);
});

test('a code block is read to its own fence, however long', () => {
  const fence = BT.repeat(5);
  const { blocks } = parse(lines(`${fence}console`, BT.repeat(4) + 'markdown', 'inside', BT.repeat(4), fence, 'after'));
  assert.equal(blocks[0].type, 'code');
  assert.equal(blocks[0].lines.length, 3);
  assert.equal(blocks[1].text, 'after');
});

test('toHtml opens a section at each h2, labels tables and makes code scrollable from the keyboard', () => {
  const { blocks } = parse(lines('# T', '', '## A {.card}', '', '| x |', '| --- |', '| y |', '', BT.repeat(3) + 'console', '$ npx --no-install @spec-family/spec-guard', 'ok', BT.repeat(3)));
  const html = toHtml(blocks);
  assert.match(html, /<section aria-labelledby="a" class="card">/);
  assert.match(html, /<div class="table" role="region" aria-label="A" tabindex="0">/);
  assert.match(html, /<td data-label="x">y<[/]td>/);
  assert.match(html, /<pre tabindex="0" aria-label="Terminal">/);
  assert.match(html, /<span class="prompt" aria-hidden="true">[$] <[/]span>npx/);
  assert.match(html, /<[/]section>$/);
});

test('toMarkdown writes each block from its source, without attributes, links rewritten', () => {
  const { blocks } = parse(lines('# T {.x}', '', 'See [the tools](/tools/). {.y}'));
  assert.equal(toMarkdown(blocks, { link: (href) => `https://site${href}` }), lines('# T', '', 'See [the tools](https://site/tools/).', ''));
});

test('rewriteLinks changes hrefs and keeps the lines', () => {
  assert.equal(rewriteLinks(lines('[a](x.md) and', '[b](#c)'), (href) => href.toUpperCase()), lines('[a](X.MD) and', '[b](#C)'));
});

test('outsideFences and fenceFor keep fences inside fences apart', () => {
  const text = [BT.repeat(4), BT.repeat(3) + 'inner', BT.repeat(3), BT.repeat(4), 'out'];
  assert.deepEqual(outsideFences(text), [false, false, false, false, true]);
  assert.equal(fenceFor(['$ x', BT.repeat(4) + 'markdown']), BT.repeat(5));
  assert.equal(fenceFor(['plain']), BT.repeat(3));
});
