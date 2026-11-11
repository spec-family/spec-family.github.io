/**
 * The Markdown this site is written in, read into blocks and written out as
 * HTML or as Markdown again. It reads what the pages use and nothing more:
 * ATX headings, paragraphs, lists one level deep, fenced code, pipe tables,
 * block quotes, and one-line HTML comments, which are either a directive the
 * build expands or a note that is dropped. Inline: code spans, links, strong
 * and emphasis. Anything else is text.
 *
 * A heading or paragraph may end with `{.class}` or `{#id}`; the HTML takes
 * them as attributes and the Markdown leaves them out.
 *
 * This file holds no backslash, as no script here does (see the README's
 * conventions): the few characters that need one are built from their codes.
 */

export const NL = String.fromCharCode(10);
const BACKSLASH = String.fromCharCode(92);
const PUNCTUATION = '!"#$%&()*+,-./:;<=>?@[]^_`{|}~' + BACKSLASH + "'";

export function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// ---------------------------------------------------------------------------
// Inline

/** The position of the `]` closing the `[` at `open`, skipping code spans; -1 if none. */
function closingBracket(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === BACKSLASH) {
      i++;
    } else if (c === '`') {
      const end = codeSpanEnd(text, i);
      if (end > 0) i = end - 1;
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Where the code span opening at `at` ends (the index after its closing run), or -1. */
function codeSpanEnd(text, at) {
  let n = 0;
  while (text[at + n] === '`') n++;
  const fence = '`'.repeat(n);
  let from = at + n;
  for (;;) {
    const k = text.indexOf(fence, from);
    if (k < 0) return -1;
    let run = 0;
    while (text[k + run] === '`') run++;
    if (run === n) return k + n;
    from = k + run;
  }
}

/** The position of the delimiter closing an emphasis that starts at `from`, or -1. */
function closingDelimiter(text, from, delimiter) {
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === BACKSLASH) {
      i++;
      continue;
    }
    if (c === '`') {
      const end = codeSpanEnd(text, i);
      if (end > 0) i = end - 1;
      continue;
    }
    if (text.startsWith(delimiter, i) && text[i - 1] !== ' ' && i > from) {
      if (delimiter === '*' && (text[i + 1] === '*' || text[i - 1] === '*')) continue;
      return i;
    }
  }
  return -1;
}

/** Inline Markdown as tokens: text, code, link (with children), strong and em (with children). */
export function inline(text) {
  const tokens = [];
  let plain = '';
  const flush = () => {
    if (plain !== '') tokens.push({ t: 'text', v: plain });
    plain = '';
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === BACKSLASH && PUNCTUATION.includes(text[i + 1] ?? '')) {
      plain += text[i + 1];
      i += 2;
      continue;
    }
    if (c === '`') {
      const end = codeSpanEnd(text, i);
      let n = 0;
      while (text[i + n] === '`') n++;
      if (end < 0) {
        plain += '`'.repeat(n);
        i += n;
        continue;
      }
      let v = text.slice(i + n, end - n).replaceAll(NL, ' ');
      if (v.startsWith(' ') && v.endsWith(' ') && v.trim() !== '') v = v.slice(1, -1);
      flush();
      tokens.push({ t: 'code', v });
      i = end;
      continue;
    }
    if (c === '[') {
      const close = closingBracket(text, i);
      if (close > 0 && text[close + 1] === '(') {
        const end = text.indexOf(')', close + 2);
        const href = end > 0 ? text.slice(close + 2, end) : '';
        if (end > 0 && href !== '' && !href.includes(' ') && !href.includes(NL)) {
          flush();
          tokens.push({ t: 'link', href, children: inline(text.slice(i + 1, close)) });
          i = end + 1;
          continue;
        }
      }
      plain += c;
      i++;
      continue;
    }
    if (c === '*') {
      const delimiter = text[i + 1] === '*' ? '**' : '*';
      const start = i + delimiter.length;
      const next = text[start];
      if (next !== undefined && next !== ' ' && next !== NL && next !== '*') {
        const close = closingDelimiter(text, start, delimiter);
        if (close > start) {
          flush();
          tokens.push({ t: delimiter === '**' ? 'strong' : 'em', children: inline(text.slice(start, close)) });
          i = close + delimiter.length;
          continue;
        }
      }
      plain += delimiter;
      i += delimiter.length;
      continue;
    }
    plain += c;
    i++;
  }
  flush();
  return tokens;
}

/** Tokens as HTML; `link` may change each href. */
export function inlineHtml(tokens, link = (href) => href) {
  return tokens
    .map((token) => {
      switch (token.t) {
        case 'text':
          return escapeHtml(token.v);
        case 'code':
          return `<code>${escapeHtml(token.v)}</code>`;
        case 'link':
          return `<a href="${escapeHtml(link(token.href))}">${inlineHtml(token.children, link)}</a>`;
        case 'strong':
          return `<strong>${inlineHtml(token.children, link)}</strong>`;
        case 'em':
          return `<em>${inlineHtml(token.children, link)}</em>`;
        default:
          throw new Error(`unknown inline token ${token.t}`);
      }
    })
    .join('');
}

/** Tokens as Markdown again; `link` may change each href. */
export function inlineMarkdown(tokens, link = (href) => href) {
  return tokens
    .map((token) => {
      switch (token.t) {
        case 'text':
          return token.v;
        case 'code': {
          let n = 1;
          while (token.v.includes('`'.repeat(n))) n++;
          const fence = '`'.repeat(n);
          const pad = token.v.startsWith('`') || token.v.endsWith('`') ? ' ' : '';
          return fence + pad + token.v + pad + fence;
        }
        case 'link':
          return `[${inlineMarkdown(token.children, link)}](${link(token.href)})`;
        case 'strong':
          return `**${inlineMarkdown(token.children, link)}**`;
        case 'em':
          return `*${inlineMarkdown(token.children, link)}*`;
        default:
          throw new Error(`unknown inline token ${token.t}`);
      }
    })
    .join('');
}

/** The text a reader sees, with no markup. */
export function plainText(tokens) {
  return tokens.map((token) => (token.children ? plainText(token.children) : token.v)).join('');
}

/** Every link's href in some inline Markdown. */
export function links(text) {
  const found = [];
  const walk = (tokens) => {
    for (const token of tokens) {
      if (token.t === 'link') found.push(token.href);
      if (token.children) walk(token.children);
    }
  };
  walk(inline(text));
  return found;
}

/**
 * The id GitHub gives a heading: lower case, punctuation dropped, each space a
 * hyphen. Letters outside ASCII are kept, as GitHub keeps them.
 */
export function slug(text) {
  let out = '';
  for (const c of text.toLowerCase()) {
    const isAscii = c.charCodeAt(0) < 128;
    if (c === ' ') out += '-';
    else if (isAscii ? /[a-z0-9_-]/.test(c) : c.toLowerCase() !== c.toUpperCase() || /[0-9]/.test(c)) out += c;
  }
  return out;
}

/** Hands out GitHub's ids for a document's headings in order, numbering repeats as GitHub does. */
export function slugger() {
  const seen = new Map();
  return (text) => {
    const base = slug(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

// ---------------------------------------------------------------------------
// Fences

/** For each line, whether it is outside every fenced block, the fences themselves counted inside. */
export function outsideFences(lines) {
  let open = null;
  return lines.map((line) => {
    const run = /^(`{3,}|~{3,})(.*)$/.exec(line);
    if (open === null) {
      if (run === null) return true;
      open = run[1];
      return false;
    }
    if (run !== null && run[1][0] === open[0] && run[1].length >= open.length && run[2].trim() === "") open = null;
    return false;
  });
}

/** A fence of backticks longer than any run of them that opens one of the lines it encloses. */
export function fenceFor(lines) {
  let longest = 2;
  for (const line of lines) {
    const run = /^`+/.exec(line.trimStart());
    if (run !== null) longest = Math.max(longest, run[0].length);
  }
  return "`".repeat(longest + 1);
}

// ---------------------------------------------------------------------------
// Blocks

const HEADING = /^(#{1,6})[ ]+(.*)$/;
const ITEM = /^([-*]|[0-9]+[.])[ ]+(.*)$/;
const DIRECTIVE = /^<!--[ ]*([a-z][a-z-]*)(?:[ ]*:[ ]*(.*?))?[ ]*-->$/;
const TABLE_RULE = /^[|]?[ ]*:?-{3,}:?[ ]*([|][ ]*:?-{3,}:?[ ]*)*[|]?$/;

/** A trailing `{.class}` or `{#id}`, taken off the text. */
function attributes(text) {
  const match = /[ ]+[{]([.#][A-Za-z0-9_-]+(?:[ ]+[.#][A-Za-z0-9_-]+)*)[}]$/.exec(text);
  if (match === null) return { text, classes: [], id: undefined };
  const parts = match[1].split(/[ ]+/);
  return {
    text: text.slice(0, match.index),
    classes: parts.filter((p) => p.startsWith('.')).map((p) => p.slice(1)),
    id: parts.find((p) => p.startsWith('#'))?.slice(1),
  };
}

function cells(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  // A pipe inside a code span belongs to the cell.
  const out = [];
  let cell = '';
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '`') {
      const end = codeSpanEnd(row, i);
      if (end > 0) {
        cell += row.slice(i, end);
        i = end - 1;
        continue;
      }
    }
    if (row[i] === '|') {
      out.push(cell.trim());
      cell = '';
    } else {
      cell += row[i];
    }
  }
  out.push(cell.trim());
  return out;
}

function startsBlock(line, next) {
  return (
    line.startsWith('```') ||
    HEADING.test(line) ||
    line.startsWith('<!--') ||
    ITEM.test(line) ||
    line.startsWith('>') ||
    (line.startsWith('|') && next !== undefined && TABLE_RULE.test(next.trim()))
  );
}

/**
 * A Markdown source as its front matter and blocks. Each block keeps the
 * source lines it came from, so the Markdown a page is written as can be
 * the source itself.
 */
export function parse(source) {
  const lines = source.replaceAll(String.fromCharCode(13), '').split(NL);
  const meta = {};
  let i = 0;
  if (lines[0] === '---') {
    i = 1;
    while (i < lines.length && lines[i] !== '---') {
      const colon = lines[i].indexOf(':');
      if (colon < 0) throw new Error(`front matter line ${i + 1} is not "key: value": ${lines[i]}`);
      meta[lines[i].slice(0, colon).trim()] = lines[i].slice(colon + 1).trim();
      i++;
    }
    if (i === lines.length) throw new Error('the front matter is not closed with ---');
    i++;
  }
  const blocks = [];
  const ids = slugger();
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const start = i;
    if (line.startsWith('```')) {
      let n = 0;
      while (line[n] === '`') n++;
      const fence = '`'.repeat(n);
      const info = line.slice(n).trim();
      const body = [];
      i++;
      while (i < lines.length && !(lines[i].startsWith(fence) && lines[i].slice(n).trim() === '')) body.push(lines[i++]);
      if (i === lines.length) throw new Error(`the code block opened on line ${start + 1} is not closed`);
      i++;
      blocks.push({ type: 'code', info, lines: body, source: lines.slice(start, i) });
      continue;
    }
    if (line.startsWith('<!--')) {
      if (!line.trimEnd().endsWith('-->')) throw new Error(`line ${i + 1}: an HTML comment is one line here`);
      // `<!-- name: arg -->` or `<!-- name -->` is a directive; any other comment is a note, and dropped.
      const match = DIRECTIVE.exec(line.trim());
      i++;
      if (match !== null) blocks.push({ type: 'directive', name: match[1], arg: match[2] ?? '', source: [line] });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const { text, classes, id } = attributes(heading[2].trim());
      const tokens = inline(text);
      blocks.push({ type: 'heading', level: heading[1].length, text, classes, id: id ?? ids(plainText(tokens)), source: [line] });
      i++;
      continue;
    }
    if (line.startsWith('|') && lines[i + 1] !== undefined && TABLE_RULE.test(lines[i + 1].trim())) {
      const header = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      for (const row of rows) if (row.length !== header.length) throw new Error(`the table on line ${start + 1} has a row of ${row.length} cells under ${header.length} headers`);
      blocks.push({ type: 'table', header, align, rows, source: lines.slice(start, i) });
      continue;
    }
    const item = ITEM.exec(line);
    if (item !== null) {
      const ordered = /^[0-9]/.test(item[1]);
      const items = [];
      while (i < lines.length) {
        const current = ITEM.exec(lines[i]);
        if (current !== null && /^[0-9]/.test(current[1]) === ordered) {
          items.push(current[2]);
          i++;
        } else if (lines[i].startsWith('  ') && lines[i].trim() !== '' && items.length > 0) {
          items[items.length - 1] += NL + lines[i].trim();
          i++;
        } else if (lines[i].trim() === '' && i + 1 < lines.length && ITEM.exec(lines[i + 1]) !== null && /^[0-9]/.test(ITEM.exec(lines[i + 1])[1]) === ordered) {
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'list', ordered, items, source: lines.slice(start, i) });
      continue;
    }
    if (line.startsWith('>')) {
      const body = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>[ ]?/, ''));
      blocks.push({ type: 'quote', text: body.join(NL), source: lines.slice(start, i) });
      continue;
    }
    const body = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i], lines[i + 1])) body.push(lines[i++]);
    const { text, classes, id } = attributes(body.join(NL));
    blocks.push({ type: 'paragraph', text, classes, id, source: lines.slice(start, i) });
  }
  return { meta, blocks };
}

// ---------------------------------------------------------------------------
// Writing

function classAttribute(classes) {
  return classes !== undefined && classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
}

/** One line of a console block: a command after its prompt, or what a command printed. */
function consoleLine(line) {
  if (line.startsWith('$ ')) return `<span class="cmd"><span class="prompt" aria-hidden="true">$ </span>${escapeHtml(line.slice(2))}</span>`;
  return escapeHtml(line);
}

export function codeHtml(info, lines) {
  const language = info.split(' ')[0];
  const body = language === 'console' ? lines.map(consoleLine).join(NL) : escapeHtml(lines.join(NL));
  const label = language === 'console' ? 'Terminal' : 'Code';
  return `<pre tabindex="0" aria-label="${label}"><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${body}</code></pre>`;
}

/**
 * Blocks as HTML. Each `##` heading opens a section that runs to the next one.
 * `render` writes the blocks this file does not know (a page's generated ones).
 */
export function toHtml(blocks, { link, render } = {}) {
  const out = [];
  let inSection = false;
  let lastHeading = '';
  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        if (block.level <= 2 && inSection) {
          out.push('</section>');
          inSection = false;
        }
        if (block.level === 2) {
          out.push(`<section aria-labelledby="${escapeHtml(block.id)}"${classAttribute(block.classes)}>`);
          inSection = true;
        }
        lastHeading = plainText(inline(block.text));
        out.push(`<h${block.level} id="${escapeHtml(block.id)}"${block.level === 2 ? '' : classAttribute(block.classes)}>${inlineHtml(inline(block.text), link)}</h${block.level}>`);
        break;
      }
      case 'paragraph':
        out.push(`<p${block.id ? ` id="${escapeHtml(block.id)}"` : ''}${classAttribute(block.classes)}>${inlineHtml(inline(block.text), link)}</p>`);
        break;
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        out.push(`<${tag}>${block.items.map((item) => `<li>${inlineHtml(inline(item), link)}</li>`).join('')}</${tag}>`);
        break;
      }
      case 'code':
        out.push(codeHtml(block.info, block.lines));
        break;
      case 'quote':
        out.push(`<blockquote><p>${inlineHtml(inline(block.text), link)}</p></blockquote>`);
        break;
      case 'table': {
        const head = block.header.map((cell, k) => `<th scope="col"${block.align[k] === 'left' ? '' : ` style="text-align:${block.align[k]}"`}>${inlineHtml(inline(cell), link)}</th>`).join('');
        const labels = block.header.map((cell) => escapeHtml(plainText(inline(cell))));
        const rows = block.rows
          .map((row) => `<tr>${row.map((cell, k) => `<td data-label="${labels[k]}">${inlineHtml(inline(cell), link)}</td>`).join('')}</tr>`)
          .join(NL);
        out.push(`<div class="table" role="region" aria-label="${escapeHtml(lastHeading)}" tabindex="0"><table><thead><tr>${head}</tr></thead><tbody>${NL}${rows}${NL}</tbody></table></div>`);
        break;
      }
      case 'directive':
        throw new Error(`the directive ${block.name} was not expanded`);
      default: {
        const html = render?.(block, { link });
        if (html === undefined) throw new Error(`no HTML for a ${block.type} block`);
        out.push(html);
      }
    }
  }
  if (inSection) out.push('</section>');
  return out.join(NL);
}

/** Drops a trailing `{.class}` or `{#id}` from a source line. */
function withoutAttributes(line) {
  return line.replace(/[ ]+[{][.#][A-Za-z0-9_ .#-]*[}]$/, '');
}

/** Blocks as Markdown: each from its source, the rest from `render`, a blank line between. */
export function toMarkdown(blocks, { link, render } = {}) {
  const out = [];
  for (const block of blocks) {
    if (block.type === 'directive') throw new Error(`the directive ${block.name} was not expanded`);
    if (block.source !== undefined) {
      const text = block.source.map(withoutAttributes).join(NL);
      out.push(block.type === 'code' || link === undefined ? text : rewriteLinks(text, link));
      continue;
    }
    const markdown = render?.(block, { link });
    if (markdown === undefined) throw new Error(`no Markdown for a ${block.type} block`);
    out.push(markdown);
  }
  return out.join(NL + NL) + NL;
}

/** A source text with each link's href changed, line by line, so that its layout stays. */
export function rewriteLinks(text, link) {
  return text
    .split(NL)
    .map((line) => {
      if (!line.includes('](')) return line;
      let out = '';
      let i = 0;
      while (i < line.length) {
        const at = line.indexOf('](', i);
        if (at < 0) {
          out += line.slice(i);
          break;
        }
        const end = line.indexOf(')', at + 2);
        if (end < 0) {
          out += line.slice(i);
          break;
        }
        out += line.slice(i, at + 2) + link(line.slice(at + 2, end)) + ')';
        i = end + 1;
      }
      return out;
    })
    .join(NL);
}
