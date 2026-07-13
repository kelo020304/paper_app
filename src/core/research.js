'use strict';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function list(items) {
  return `<ul>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function analysisHtml(paper, analysis, hasImage) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(paper.title)} — Paper Vault</title><style>
  body{max-width:920px;margin:48px auto;padding:0 28px;color:#28251f;background:#faf7f0;font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}h1,h2{font-family:Georgia,"Songti SC",serif}h1{font-size:38px;line-height:1.2}h2{margin-top:34px;border-bottom:1px solid #ddd5c7;padding-bottom:8px}.meta{color:#777166}.score{display:inline-block;background:#d95d39;color:white;padding:4px 10px;border-radius:14px}blockquote{margin:22px 0;padding:14px 18px;border-left:4px solid #58756b;background:#f0ece3}img{width:100%;border:1px solid #ddd5c7;border-radius:10px;background:white}li{margin:7px 0}.footer{margin-top:50px;color:#8b857a;font-size:13px}</style></head><body>
  <div class="meta">arXiv ${escapeHtml(paper.id)} · ${(paper.authors || []).map(escapeHtml).join(', ')}</div><h1>${escapeHtml(paper.title)}</h1>
  <p><span class="score">价值 ${analysis.valueScore}/10</span> ${escapeHtml(analysis.valueReason)}</p><blockquote>${escapeHtml(analysis.oneSentence)}</blockquote>
  <h2>研究问题</h2><p>${escapeHtml(analysis.problem)}</p><h2>核心贡献</h2>${list(analysis.contributions)}
  <h2>方法原理</h2><p>${escapeHtml(analysis.method)}</p>${hasImage ? '<h2>关键原理图</h2><img src="principle.png" alt="论文关键原理图">' : ''}
  <h2>实验与证据</h2><p>${escapeHtml(analysis.experiments)}</p><h2>局限与阅读提醒</h2>${list(analysis.limitations)}
  <h2>Related Works 表述</h2><p>${escapeHtml(analysis.relatedWorks)}</p><div class="footer">由 Paper Vault AI 生成，请以论文原文为准。</div></body></html>`;
}

function stripHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

async function fetchPaperHtml(paper) {
  const urls = [
    `https://arxiv.org/html/${encodeURIComponent(paper.id)}`,
    `https://ar5iv.labs.arxiv.org/html/${encodeURIComponent(paper.baseId || paper.id)}`
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'PaperVault/0.2 (personal research library)' } });
      if (!response.ok) continue;
      const html = await response.text(); const text = stripHtml(html);
      if (text.length > 2000) return { html, text, sourceUrl: url };
    } catch {}
  }
  return { html: '', text: paper.abstract || '', sourceUrl: '' };
}

module.exports = { analysisHtml, stripHtml, fetchPaperHtml };
