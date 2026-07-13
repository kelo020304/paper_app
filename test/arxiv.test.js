'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArxivId, parseAtomEntry } = require('../src/core/arxiv');

test('parseArxivId accepts modern ids and URLs', () => {
  assert.equal(parseArxivId('2406.12345'), '2406.12345');
  assert.equal(parseArxivId('https://arxiv.org/abs/2406.12345v2'), '2406.12345v2');
  assert.equal(parseArxivId('https://arxiv.org/pdf/2406.12345.pdf'), '2406.12345');
});

test('parseArxivId accepts legacy ids', () => {
  assert.equal(parseArxivId('hep-th/9901001'), 'hep-th/9901001');
});

test('parseArxivId rejects unrelated text', () => {
  assert.throws(() => parseArxivId('not a paper'), /无法识别/);
});

test('parseAtomEntry extracts normalized metadata', () => {
  const xml = `<?xml version="1.0"?><feed xmlns:arxiv="http://arxiv.org/schemas/atom">
    <entry><id>http://arxiv.org/abs/2406.12345v2</id><updated>2024-06-20T00:00:00Z</updated>
    <published>2024-06-18T00:00:00Z</published><title>A &amp; B\n Paper</title>
    <summary>  A useful abstract. </summary><author><name>Alice</name></author><author><name>Bob</name></author>
    <arxiv:primary_category term="cs.AI"/><category term="cs.AI"/><category term="cs.LG"/></entry></feed>`;
  const paper = parseAtomEntry(xml, '2406.12345');
  assert.equal(paper.title, 'A & B Paper');
  assert.deepEqual(paper.authors, ['Alice', 'Bob']);
  assert.deepEqual(paper.categories, ['cs.AI', 'cs.LG']);
  assert.equal(paper.baseId, '2406.12345');
  assert.equal(paper.primaryCategory, 'cs.AI');
});
