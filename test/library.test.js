'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const library = require('../src/core/library');

async function tempVault(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-vault-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('vault stores each paper as readable files', async (t) => {
  const root = await tempVault(t);
  await library.ensureVault(root);
  await library.upsertPaper(root, {
    id: '2406.12345v1', baseId: '2406.12345', title: 'Test Paper', authors: ['A'], abstract: 'Summary'
  }, { tags: ['VLA'] });
  const papers = await library.listPapers(root);
  assert.equal(papers.length, 1);
  assert.equal(papers[0].status, 'unread');
  assert.deepEqual(papers[0].tags, ['VLA']);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'papers', '2406.12345', 'metadata.json'))).title, 'Test Paper');
});

test('updates metadata and notes independently', async (t) => {
  const root = await tempVault(t);
  await library.upsertPaper(root, { id: '2406.12345', baseId: '2406.12345', title: 'Test' });
  await library.updatePaper(root, '2406.12345', { status: 'reading', favorite: true, notes: '# Insight' });
  const [paper] = await library.listPapers(root);
  assert.equal(paper.status, 'reading');
  assert.equal(paper.favorite, true);
  assert.equal(paper.notes, '# Insight');
});

test('removePaper deletes the complete paper directory', async (t) => {
  const root = await tempVault(t);
  await library.upsertPaper(root, { id: '2406.12345', baseId: '2406.12345', title: 'Test' });
  await library.removePaper(root, '2406.12345');
  assert.deepEqual(await library.listPapers(root), []);
});
