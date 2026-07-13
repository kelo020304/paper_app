'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analysisHtml, stripHtml } = require('../src/core/research');

test('analysisHtml produces a self-contained escaped paper report', () => {
  const html = analysisHtml({ id: '1', title: '<Paper>', authors: ['A'] }, {
    valueScore: 9, valueReason: 'Useful', oneSentence: 'Summary', problem: 'Problem',
    contributions: ['One', 'Two'], method: 'Method', experiments: 'Experiments',
    limitations: ['Limit'], relatedWorks: 'Related.'
  }, true);
  assert.match(html, /<!doctype html>/);
  assert.match(html, /principle\.png/);
  assert.match(html, /&lt;Paper&gt;/);
  assert.doesNotMatch(html, /<h1><Paper>/);
});

test('stripHtml removes scripts and keeps readable text', () => {
  assert.equal(stripHtml('<style>x</style><h1>Title</h1><script>alert(1)</script><p>A &amp; B</p>'), 'Title A & B');
});
