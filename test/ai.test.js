'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePrincipleImage } = require('../src/core/ai');

test('key-paper image generation uses GPT Image 2 and returns PNG bytes', async (t) => {
  const originalFetch = global.fetch;
  let requestBody;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/generations');
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }] }) };
  };
  t.after(() => { global.fetch = originalFetch; });
  const bytes = await generatePrincipleImage({ ai: {} }, 'sk-test', { title: 'Key Paper' }, 'Show the method');
  assert.equal(requestBody.model, 'gpt-image-2');
  assert.equal(requestBody.output_format, 'png');
  assert.equal(bytes.toString(), 'png-bytes');
});
