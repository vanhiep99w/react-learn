import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, pages, blocks, ledger, hash, legacyIssues, audit } from '../scripts/check-docs.mjs';
import { remarkD2 } from '@vanhiep99w/docs-kit/d2';
import { parseCodeWalkthroughDescriptor } from '@vanhiep99w/docs-kit/code-walkthrough';
import { parseCodeDiffDescriptor } from '@vanhiep99w/docs-kit/code-diff';
import { parseTerminalSession } from '@vanhiep99w/docs-kit/terminal-session';
import { parseProtocolExchangeDescriptor } from '@vanhiep99w/docs-kit/protocol-exchange';
import { parseSpanWaterfallDescriptor } from '@vanhiep99w/docs-kit/span-waterfall';
import { d2Options } from '../scripts/d2-options.mjs';

const all = pages().map(file => ({ file, name: path.relative(root, file), text: fs.readFileSync(file, 'utf8') }));
const parsers = {
  'code-walkthrough': parseCodeWalkthroughDescriptor,
  'code-diff': parseCodeDiffDescriptor,
  'terminal-session': parseTerminalSession,
  'protocol-exchange': parseProtocolExchangeDescriptor,
  'span-waterfall': parseSpanWaterfallDescriptor,
};
const parsed = new Map();

test('inventory: all 29 routes, 94 Mermaid + 15 text diagrams, no unreviewed diagram', () => {
  const report = audit();
  assert.equal(report.pages, 29);
  assert.equal(report.d2, 109);
  assert.equal(ledger.diagrams.filter(d => d.originalLanguage === 'mermaid').length, 94);
  assert.equal(ledger.diagrams.filter(d => d.originalLanguage === 'text').length, 15);
  assert.equal(report.retainedText.length, 4);
  assert.deepEqual(report.issues, []);
  for (const kind of Object.keys(parsers)) assert.equal(report.learning[kind], 1, kind);
});

test('scanner rejects legacy diagrams but accepts reviewed logs, listings and real code arrows', () => {
  const wrap = (language, code) => '```' + language + '\n' + code + '\n```';
  assert.equal(legacyIssues(wrap('mermaid', 'graph LR\nA --> B')).length, 1);
  assert.ok(legacyIssues(wrap('text', 'setup → cleanup → setup')).length);
  assert.ok(legacyIssues(wrap('typescript', '// ┌────┐\n// │ API│\n// └────┘')).length);
  assert.deepEqual(legacyIssues(wrap('tsx', 'const next = current => current + 1; // count → next')), []);
  assert.deepEqual(legacyIssues(wrap('json', '{"route":"a->b","count":9007199254740993}')), []);
  for (const p of all) assert.deepEqual(legacyIssues(p.text, p.name), []);
});

test('page identity, metadata, heading anchors and existing URLs are retained', () => {
  assert.deepEqual(all.map(p => p.name).sort(), Object.keys(ledger.pages).sort());
  for (const p of all) {
    const before = ledger.pages[p.name];
    assert.equal(p.text.split('---', 3)[1], before.frontmatter, p.name);
    const prose = p.text.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
    assert.deepEqual([...prose.matchAll(/^#{2,6} .+$/gm)].map(m => m[0]), before.headings, p.name);
    assert.ok(prose.includes('## Mục lục'), p.name);
    assert.doesNotMatch(prose, /^# /m, 'frontmatter owns the H1');
    for (const pair of before.urls) assert.ok(p.text.includes(pair[0] || pair[1]), `${p.name}: ${pair}`);
  }
  for (const [file, digest] of Object.entries(ledger.metadata)) {
    assert.equal(hash(fs.readFileSync(path.join(root, file))), digest, file);
  }
});

test('every original non-diagram code/log/payload/listing is kept byte-for-byte', () => {
  for (const entry of ledger.retained) {
    const page = all.find(p => p.name === entry.file);
    assert.ok(blocks(page.text).some(b => b.language === entry.language && hash(b.code) === entry.sha256),
      `${entry.file}: original block ${entry.originalBlock}`);
  }
});

test('all migrated labels, connection endpoints, direction, notes and D2 sources stay reviewed', () => {
  for (const e of ledger.diagrams) {
    const page = all.find(p => p.name === e.file);
    const b = blocks(page.text).find(b => b.language === 'd2' && b.meta.includes(`title=${JSON.stringify(e.title)}`));
    assert.ok(b, `${e.file}: ${e.title}`);
    assert.equal(hash(b.code), e.d2Sha256, e.title);
    const code = b.code.replaceAll('\\$', '$');
    for (const label of e.labels ?? []) assert.ok(code.includes(JSON.stringify(label)), `${e.title}: ${label}`);
    for (const [from, op, to, label] of e.connections ?? []) {
      assert.ok(code.includes(`${from} ${op} ${to}` + (label ? ': ' + JSON.stringify(label) : '')), `${e.title}: ${from} ${op} ${to}`);
    }
  }
});

test('strict learning descriptors parse using installed 0.9.5 and preserve adapted source', async () => {
  for (const p of all) for (const b of blocks(p.text)) {
    if (!parsers[b.language]) continue;
    parsed.set(b.language, await parsers[b.language](b.code));
  }
  assert.equal(parsed.size, 5);
  const walkthrough = parsed.get('code-walkthrough');
  const original = ledger.adaptedExamples.find(e => e.component === 'code-walkthrough');
  assert.equal(hash(walkthrough.snapshots[0].code + '\n'), original.sha256);
  const protocol = parsed.get('protocol-exchange');
  assert.deepEqual(protocol.variants.map(v => v.response.status), [200, 404]);
  assert.ok(walkthrough.snapshots[0].code.includes('return () => { cancelled = true; };'));
  const spans = parsed.get('span-waterfall');
  assert.equal(spans.provenance.kind, 'illustrative');
  const terminal = parsed.get('terminal-session');
  assert.equal(terminal.context.kind, 'local');
  assert.deepEqual(terminal.steps.map(s => s.command), ['npm install @reduxjs/toolkit react-redux', 'npm ls @reduxjs/toolkit react-redux']);
});

test('all 109 D2 fences render light/dark SVG with locally embedded icons', { timeout: 180000 }, async () => {
  const plugin = remarkD2.call({ use() {} }, d2Options);
  let rendered = 0, embedded = 0;
  for (const p of all) {
    const d2 = blocks(p.text).filter(b => b.language === 'd2');
    const tree = { type: 'root', children: d2.map(b => ({ type: 'code', lang: 'd2', meta: b.meta, value: b.code })) };
    const file = { path: p.file, cwd: root, data: {}, fail(message) { throw new Error(`${p.name}: ${message}`); } };
    await plugin(tree, file);
    for (const node of tree.children) {
      assert.equal(node.type, 'mdxJsxFlowElement', p.name);
      assert.ok(['D2Diagram', 'D2InteractiveDiagram'].includes(node.name));
      const serialized = JSON.stringify(node);
      assert.ok(serialized.includes('<svg'), p.name);
      assert.ok(serialized.includes('darkSvg') && serialized.includes('lightSvg'), p.name);
      assert.ok(!serialized.includes('https://icons.d2lang.com/'), 'no remote icon dependency');
      if (serialized.includes('data:image/svg+xml')) embedded++;
      rendered++;
    }
  }
  assert.equal(rendered, 109);
  assert.ok(embedded > 0);
});

test('pinned package, vetted icon and three-layer integration remain in sync', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.dependencies['@vanhiep99w/docs-kit'], '0.9.5');
  assert.equal(lock.packages['node_modules/@vanhiep99w/docs-kit'].version, '0.9.5');
  assert.ok(!pkg.dependencies.mermaid);
  const svg = fs.readFileSync(path.join(root, 'content/docs/assets/react.svg'), 'utf8');
  assert.equal(hash(svg), 'b0a72f181b3b6093ad6814dffec060cc4e7d84cf16a41fd786cb069773512b5a');
  assert.doesNotMatch(svg, /<script|on\w+=|href=|<foreignObject/i);
  const config = fs.readFileSync(path.join(root, 'source.config.ts'), 'utf8');
  const registry = fs.readFileSync(path.join(root, 'src/mdx-components.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
  for (const [kind, component] of Object.entries({ d2: 'D2Diagram', 'code-walkthrough': 'CodeWalkthrough', 'code-diff': 'CodeDiff', 'terminal-session': 'TerminalSession', 'protocol-exchange': 'ProtocolExchange', 'span-waterfall': 'SpanWaterfall' })) {
    assert.ok(config.includes(`@vanhiep99w/docs-kit/${kind}`));
    assert.ok(registry.includes(component));
    assert.ok(css.includes(`@vanhiep99w/docs-kit/styles/${kind}.css`));
  }
});
