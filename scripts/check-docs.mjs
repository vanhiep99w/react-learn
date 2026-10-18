import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const ledger = JSON.parse(fs.readFileSync(path.join(root, 'scripts/diagram-migration.json'), 'utf8'));
export function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
export const pages = () => walk(path.join(root, 'content/docs')).filter(f => /\.mdx?$/.test(f) && !f.includes('/assets/'));
export function blocks(source) {
  return [...source.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)].map(m => ({
    language: m[1].split(/\s/)[0], meta: m[1].slice(m[1].split(/\s/)[0].length).trim(),
    code: m[2], line: source.slice(0, m.index).split('\n').length,
  }));
}
// Review exemptions are exact artifacts, not a blanket exception for all `text` fences.
const literalArtifacts = new Map(ledger.retained.filter(e => ['', 'text', 'plaintext'].includes(e.language))
  .map(e => [e.sha256, e]));
export function legacyIssues(source, name = 'input') {
  const issues = [];
  for (const block of blocks(source)) {
    if (block.language === 'mermaid') issues.push(`${name}:${block.line}: Mermaid fence`);
    if (literalArtifacts.has(hash(block.code))) continue;
    if (/[┌┐└┘╔╗╚╝├┤┬┴]/u.test(block.code)) issues.push(`${name}:${block.line}: box/tree diagram needs review`);
    if (['', 'text', 'plaintext', 'ascii', 'diagram', 'console'].includes(block.language) &&
      /(?:→|←|↓|↑|▼|-->|==>|\s->\s|\s=>\s)/u.test(block.code)) {
      issues.push(`${name}:${block.line}: text flow/timeline needs review`);
    }
  }
  const prose = source.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
  if (/[┌┐└┘╔╗╚╝├┤┬┴]/u.test(prose)) issues.push(`${name}: unfenced box/tree needs review`);
  if (/<Mermaid(?:Diagram)?\b/.test(prose)) issues.push(`${name}: legacy renderer`);
  return issues;
}
export function audit() {
  const report = { pages: 0, d2: 0, learning: {}, retainedText: [], issues: [] };
  for (const file of pages()) {
    const name = path.relative(root, file), source = fs.readFileSync(file, 'utf8');
    report.pages++;
    report.issues.push(...legacyIssues(source, name));
    for (const b of blocks(source)) {
      if (b.language === 'd2') report.d2++;
      if (['code-walkthrough', 'code-diff', 'terminal-session', 'protocol-exchange', 'span-waterfall'].includes(b.language)) {
        report.learning[b.language] = (report.learning[b.language] ?? 0) + 1;
      }
      if (literalArtifacts.has(hash(b.code))) report.retainedText.push(`${name}:${b.line} (${b.language || 'formula'})`);
    }
  }
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = audit();
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) process.exitCode = 1;
}
