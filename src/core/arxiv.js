'use strict';

const ARXIV_ID_PATTERN = /(?:arxiv\.org\/(?:abs|pdf|html)\/)?((?:[a-z-]+(?:\.[A-Z]{2})?\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?)/i;

function parseArxivId(input) {
  const value = String(input || '').trim().replace(/\.pdf(?:\?.*)?$/i, '');
  const match = value.match(ARXIV_ID_PATTERN);
  if (!match) throw new Error('无法识别 arXiv 编号，请粘贴类似 2406.12345 或 arxiv.org/abs/2406.12345 的内容');
  return match[1];
}

function decodeXml(value = '') {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => entities[name]);
}

function textOf(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) : '';
}

function parseEntryXml(entry, requestedId = '') {
  if (!entry) {
    throw new Error('arXiv 没有返回这篇论文');
  }

  const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)]
    .map((match) => decodeXml(match[1].replace(/\s+/g, ' ').trim()));
  const categories = [...entry.matchAll(/<category[^>]+term=["']([^"']+)["'][^>]*\/?\s*>/gi)]
    .map((match) => decodeXml(match[1]));
  const idUrl = textOf(entry, 'id');
  const id = idUrl.split('/abs/').pop() || requestedId;
  const primaryCategory = entry.match(/<arxiv:primary_category[^>]+term=["']([^"']+)["']/i)?.[1] || categories[0] || '';

  return {
    id,
    baseId: id.replace(/v\d+$/i, ''),
    title: textOf(entry, 'title'),
    authors,
    abstract: textOf(entry, 'summary'),
    published: textOf(entry, 'published'),
    updated: textOf(entry, 'updated'),
    categories,
    primaryCategory,
    comment: textOf(entry, 'arxiv:comment'),
    journalRef: textOf(entry, 'arxiv:journal_ref'),
    doi: textOf(entry, 'arxiv:doi'),
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`
  };
}

function parseAtomEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => parseEntryXml(match[1]));
}

function parseAtomEntry(xml, requestedId) {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry) {
    const message = textOf(xml, 'summary') || 'arXiv 没有返回这篇论文';
    throw new Error(message);
  }
  return parseEntryXml(entry, requestedId);
}

async function fetchArxivPaper(input, fetchImpl = globalThis.fetch) {
  const id = parseArxivId(input);
  const response = await fetchImpl(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, {
    headers: { 'User-Agent': 'PaperVault/0.1 (personal research library)' }
  });
  if (!response.ok) throw new Error(`arXiv 请求失败（HTTP ${response.status}）`);
  return parseAtomEntry(await response.text(), id);
}

async function searchArxiv(keywords, maxResults = 25, fetchImpl = globalThis.fetch) {
  const terms = String(keywords || '').split(/[,，\n]/).map((term) => term.trim()).filter(Boolean);
  if (!terms.length) throw new Error('请先设置每日抓取关键词');
  const query = terms.map((term) => `all:${JSON.stringify(term)}`).join(' OR ');
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${Math.min(50, maxResults)}&sortBy=submittedDate&sortOrder=descending`;
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'PaperVault/0.2 (personal research library)' } });
  if (!response.ok) throw new Error(`arXiv 搜索失败（HTTP ${response.status}）`);
  return parseAtomEntries(await response.text());
}

module.exports = { parseArxivId, parseAtomEntry, parseAtomEntries, fetchArxivPaper, searchArxiv };
