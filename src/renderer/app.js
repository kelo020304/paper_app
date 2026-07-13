'use strict';

const state = { papers: [], categories: [], settings: {}, gitStatus: {}, vaultPath: '', filter: 'all', tag: '', categoryId: '', query: '', sort: 'added', hasApiKey: false };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const statusNames = { unread: '待读', reading: '阅读中', done: '已读' };
const filterNames = { all: '全部论文', unread: '待读', reading: '阅读中', done: '已读', favorite: '收藏' };
let autoSyncTimer;
let scheduledSyncTimer;
let syncInFlight = false;
let didInitialAutoSync = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function toast(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

function filteredPapers() {
  const query = state.query.trim().toLowerCase();
  const papers = state.papers.filter((paper) => {
    if (state.filter === 'favorite' && !paper.favorite) return false;
    if (['unread', 'reading', 'done'].includes(state.filter) && paper.status !== state.filter) return false;
    if (state.tag && !(paper.tags || []).includes(state.tag)) return false;
    if (state.categoryId && paper.categoryId !== state.categoryId && paper.dailyCategoryId !== state.categoryId) return false;
    if (query) {
      const haystack = [paper.title, paper.abstract, ...(paper.authors || []), ...(paper.tags || [])].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  return papers.sort((a, b) => {
    if (state.sort === 'title') return a.title.localeCompare(b.title);
    if (state.sort === 'published') return String(b.published).localeCompare(String(a.published));
    return String(b.addedAt).localeCompare(String(a.addedAt));
  });
}

function render() {
  const papers = filteredPapers();
  $('#count-all').textContent = state.papers.length;
  $('#count-unread').textContent = state.papers.filter((paper) => paper.status === 'unread').length;
  $('#count-reading').textContent = state.papers.filter((paper) => paper.status === 'reading').length;
  $('#count-done').textContent = state.papers.filter((paper) => paper.status === 'done').length;
  $('#count-favorite').textContent = state.papers.filter((paper) => paper.favorite).length;
  $('#vault-path').textContent = state.vaultPath;
  $('#vault-path').title = state.vaultPath;
  const activeCategory = state.categories.find((item) => item.id === state.categoryId);
  $('#page-title').textContent = activeCategory?.name || (state.tag ? `# ${state.tag}` : filterNames[state.filter]);
  $('#view-context').textContent = activeCategory ? '论文分类' : (state.tag ? '标签筛选' : (state.filter === 'all' ? '论文库' : '智能筛选'));
  $('#category-summary-btn').classList.toggle('hidden', !activeCategory);
  $('#result-count').textContent = state.papers.length ? `${papers.length} 篇论文${papers.length !== state.papers.length ? ` · 全库 ${state.papers.length} 篇` : ''}` : '本地优先、可跨设备同步的研究资料库';
  renderSyncState();
  renderTags();
  renderCategories();
  const grid = $('#paper-grid');
  const empty = $('#empty-state');
  $('.list-caption').classList.toggle('hidden', papers.length === 0);
  grid.classList.toggle('hidden', papers.length === 0);
  empty.classList.toggle('hidden', papers.length !== 0);
  empty.querySelector('h2').textContent = state.papers.length ? '没有匹配的论文' : '开始建立你的论文库';
  empty.querySelector('p').textContent = state.papers.length ? '试试清除搜索词或切换筛选条件。' : '粘贴 arXiv 链接或编号，标题、作者和摘要会自动归档。';
  grid.innerHTML = papers.map(paperCard).join('');
}

function renderSyncState() {
  const ready = Boolean(state.gitStatus.initialized && (state.settings.git?.remote || state.gitStatus.remote));
  const dirty = Boolean(state.gitStatus.dirty);
  const label = ready ? (dirty ? '等待同步' : 'GitHub 已同步') : '仅保存在本机';
  const compactLabel = ready ? (dirty ? '有更改等待同步' : '已连接 GitHub') : '未连接 GitHub';
  const classes = ready ? (dirty ? 'dirty' : 'connected') : '';
  const syncState = $('#sync-state');
  const syncMini = $('.sync-mini');
  syncState.className = `sync-state ${classes}`.trim();
  syncState.querySelector('span').textContent = label;
  syncMini.className = `sync-mini ${classes}`.trim();
  $('#sync-mini-label').textContent = compactLabel;
}

function paperCard(paper) {
  const category = state.categories.find((item) => item.id === paper.categoryId);
  const tags = (paper.tags || []).slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const extra = (paper.tags || []).length > 2 ? `<span class="tag">+${paper.tags.length - 2}</span>` : '';
  const sourceLabel = paper.source === 'daily' ? '每日精选' : '手动导入';
  const signal = paper.valueScore
    ? `<div class="score-badge"><strong>${escapeHtml(paper.valueScore)}</strong><span>/ 10</span></div>`
    : (paper.hasPdf ? '<span class="pdf-badge">PDF 已归档</span>' : '<span class="pdf-badge">仅元数据</span>');
  return `<article class="paper-card" data-key="${escapeHtml(paper.key)}" data-source="${escapeHtml(paper.source || 'manual')}">
    <div class="paper-content">
      <div class="card-top"><button class="status-pill" data-action="cycle-status" data-status="${paper.status}" aria-label="切换阅读状态">${statusNames[paper.status] || '待读'}</button><span class="arxiv-id">${escapeHtml(paper.id)}</span><span class="source-label">${sourceLabel}</span><span class="published-year">${escapeHtml((paper.published || '').slice(0, 4))}</span></div>
      <h2 class="paper-title">${escapeHtml(paper.title)}</h2>
      <div class="authors">${escapeHtml((paper.authors || []).join(', '))}</div>
      <p class="abstract">${escapeHtml(paper.abstract)}</p>
      <div class="card-bottom">${category ? `<span class="category-chip">${escapeHtml(category.name)}</span>` : ''}${tags}${extra}</div>
    </div>
    <aside class="paper-aside">
      <button class="favorite-btn ${paper.favorite ? 'active' : ''}" data-action="favorite" title="${paper.favorite ? '取消收藏' : '收藏'}" aria-label="${paper.favorite ? '取消收藏' : '收藏'}">${paper.favorite ? '★' : '☆'}</button>
      <div class="paper-signals">${signal}${paper.analysisStatus === 'ready' ? '<span class="analysis-badge">AI 报告已生成</span>' : ''}<span class="open-indicator">›</span></div>
    </aside>
  </article>`;
}

function renderCategories() {
  const counts = new Map(); state.papers.forEach((paper) => { for (const id of [paper.categoryId, paper.dailyCategoryId].filter(Boolean)) counts.set(id, (counts.get(id) || 0) + 1); });
  $('#category-list').innerHTML = state.categories.map((category) => `<button class="category-filter ${state.categoryId === category.id ? 'active' : ''}" data-category="${escapeHtml(category.id)}"><i class="category-color" style="background:${escapeHtml(category.color)}"></i><span>${escapeHtml(category.name)}</span><small class="category-count">${counts.get(category.id) || 0}</small></button>`).join('') || '<span class="vault-path">还没有分类</span>';
}

function renderTags() {
  const counts = new Map();
  state.papers.forEach((paper) => (paper.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  $('#tag-list').innerHTML = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) =>
    `<button class="tag-filter ${state.tag === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <small>${count}</small></button>`
  ).join('') || '<span class="vault-path">还没有标签</span>';
}

function findPaper(key) { return state.papers.find((paper) => paper.key === key); }

async function patchPaper(key, changes) {
  try {
    const updated = await window.paperVault.updatePaper(key, changes);
    const index = state.papers.findIndex((paper) => paper.key === key);
    state.papers[index] = { ...state.papers[index], ...updated, ...changes };
    render();
    scheduleAutoSync();
    return state.papers[index];
  } catch (error) { toast(error.message, true); throw error; }
}

function openDetail(paper) {
  const dialog = $('#detail-dialog');
  const categoryOptions = ['<option value="">未分类</option>', ...state.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)].join('');
  $('#detail-content').innerHTML = `<div class="detail-shell">
    <button class="dialog-close detail-close" data-detail-close>×</button>
    <section class="detail-main">
      <p class="detail-kicker ${paper.source === 'daily' ? 'daily' : ''}"><i></i>ARXIV · ${escapeHtml(paper.id)} · ${paper.source === 'daily' ? '每日精选' : '手动导入'}</p>
      <h2>${escapeHtml(paper.title)}</h2>
      <div class="detail-authors">${escapeHtml((paper.authors || []).join(', '))}</div>
      <div class="detail-section"><h3>摘要</h3><p class="detail-abstract">${escapeHtml(paper.abstract)}</p></div>
      <div class="detail-section"><h3>我的笔记</h3><textarea id="detail-notes" class="notes-area" placeholder="记录核心观点、方法、疑问和复现实验…">${escapeHtml(paper.notes || '')}</textarea></div>
    </section>
    <aside class="detail-side">
      <div class="side-field"><h3>阅读状态</h3><select id="detail-status"><option value="unread">待读</option><option value="reading">阅读中</option><option value="done">已读</option></select></div>
      <div class="side-field"><h3>论文分类</h3><select id="detail-category" class="category-select">${categoryOptions}</select></div>
      <div class="side-field"><h3>标签</h3><input id="detail-tags" value="${escapeHtml((paper.tags || []).join(', '))}" placeholder="逗号分隔"></div>
      <div class="side-field"><h3>论文信息</h3><div class="meta-line">来源：${paper.source === 'daily' ? '每日抓取' : '人工加入'}<br>发表：${escapeHtml((paper.published || '').slice(0, 10))}<br>arXiv 分类：${escapeHtml((paper.categories || []).join(', '))}<br>${paper.valueScore ? `价值：${paper.valueScore}/10<br>${escapeHtml(paper.valueReason || '')}` : ''}</div></div>
      <div class="detail-actions">
        <button class="button primary" id="detail-save">保存修改</button>
        <button class="button secondary" id="detail-analyze">${paper.analysisStatus === 'ready' ? '打开 AI 研究报告' : '生成 AI 研究报告'}</button>
        <button class="button secondary" id="detail-translate">HJFY 中文翻译</button>
        <button class="button secondary" id="detail-pdf">${paper.hasPdf ? '打开本地 PDF' : '下载 PDF'}</button>
        <button class="button secondary" id="detail-arxiv">打开 arXiv 页面</button>
        <div class="action-separator"></div>
        <button class="button danger" id="detail-delete">移出论文库</button>
      </div>
    </aside>
  </div>`;
  $('#detail-status').value = paper.status;
  $('#detail-category').value = paper.categoryId || '';
  dialog.showModal();
  $('[data-detail-close]').onclick = () => dialog.close();
  $('#detail-save').onclick = async () => {
    const changes = {
      status: $('#detail-status').value,
      categoryId: $('#detail-category').value,
      tags: $('#detail-tags').value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      notes: $('#detail-notes').value
    };
    await patchPaper(paper.key, changes);
    dialog.close(); toast('论文信息已保存');
  };
  $('#detail-analyze').onclick = async (event) => {
    const button = event.currentTarget;
    try {
      if (paper.analysisStatus === 'ready') return await window.paperVault.openAnalysis(paper.key);
      button.disabled = true; button.textContent = 'AI 正在解析…';
      const updated = await window.paperVault.analyzePaper(paper.key);
      Object.assign(paper, updated); const data = await window.paperVault.load(); Object.assign(state, data); render(); dialog.close(); toast('AI 解析、分类和 Related Works 已更新'); scheduleAutoSync();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  };
  $('#detail-translate').onclick = () => window.paperVault.translatePaper(paper.id).catch((error) => toast(error.message, true));
  $('#detail-pdf').onclick = async (event) => {
    const button = event.currentTarget; button.disabled = true;
    try {
      if (paper.hasPdf) await window.paperVault.openPdf(paper.key);
      else { await window.paperVault.downloadPdf(paper); paper.hasPdf = true; render(); dialog.close(); toast('PDF 已下载'); }
    } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
  };
  $('#detail-arxiv').onclick = () => window.paperVault.openUrl(paper.absUrl).catch((error) => toast(error.message, true));
  $('#detail-delete').onclick = async () => {
    if (!confirm(`确定移除《${paper.title}》？本地 PDF 和笔记也会删除。`)) return;
    try { await window.paperVault.removePaper(paper.key); state.papers = state.papers.filter((item) => item.key !== paper.key); dialog.close(); render(); scheduleAutoSync(); toast('论文已移出'); }
    catch (error) { toast(error.message, true); }
  };
}

async function load() {
  try {
    const data = await window.paperVault.load();
    Object.assign(state, data);
    render();
    configureAutoSync();
    if (!didInitialAutoSync && state.settings.autoSync && state.gitStatus.initialized && state.gitStatus.remote) {
      didInitialAutoSync = true;
      setTimeout(() => performSync(false), 0);
    }
  } catch (error) { render(); toast(error.message, true); }
}

$('#nav').addEventListener('click', (event) => {
  const item = event.target.closest('[data-filter]'); if (!item) return;
  $$('.nav-item[data-filter]').forEach((node) => node.classList.toggle('active', node === item));
  state.filter = item.dataset.filter; state.tag = ''; state.categoryId = ''; render();
});
$('#tag-list').addEventListener('click', (event) => {
  const item = event.target.closest('[data-tag]'); if (!item) return;
  state.tag = item.dataset.tag; state.categoryId = ''; state.filter = 'all';
  $$('.nav-item[data-filter]').forEach((node) => node.classList.remove('active'));
  render();
});
$('#category-list').addEventListener('click', (event) => {
  const item = event.target.closest('[data-category]'); if (!item) return;
  state.categoryId = item.dataset.category; state.tag = ''; state.filter = 'all';
  $$('.nav-item[data-filter]').forEach((node) => node.classList.remove('active'));
  render();
});
$('#category-summary-btn').onclick = () => window.paperVault.openCategorySummary(state.categoryId).catch((error) => toast(error.message, true));
$('#search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
$('#paper-grid').addEventListener('click', async (event) => {
  const card = event.target.closest('.paper-card'); if (!card) return;
  const paper = findPaper(card.dataset.key); const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'favorite') { await patchPaper(paper.key, { favorite: !paper.favorite }); return; }
  if (action === 'cycle-status') {
    const next = { unread: 'reading', reading: 'done', done: 'unread' }[paper.status] || 'unread';
    await patchPaper(paper.key, { status: next }); return;
  }
  openDetail(paper);
});

function showImport() { $('#import-dialog').showModal(); setTimeout(() => $('#arxiv-input').focus(), 50); }
$('#import-btn').onclick = showImport;
$$('[data-open-import]').forEach((button) => { button.onclick = showImport; });
$('#import-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') { $('#import-dialog').close(); return; }
  const button = $('#import-submit'); button.disabled = true; button.textContent = '正在导入并解析…';
  try {
    const paper = await window.paperVault.importPaper($('#arxiv-input').value, {
      tags: $('#import-tags').value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      downloadPdf: $('#download-pdf').checked
    });
    const old = state.papers.findIndex((item) => item.key === paper.key);
    if (old >= 0) state.papers[old] = paper; else state.papers.unshift(paper);
    $('#import-dialog').close(); $('#import-form').reset(); $('#download-pdf').checked = true; render(); toast(paper.analysisStatus === 'failed' ? '论文已导入；AI 解析可稍后重试' : '论文已导入并完成 AI 整理');
    scheduleAutoSync();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.textContent = '导入论文'; }
});

$('#settings-btn').onclick = () => {
  $('#settings-vault').value = state.vaultPath;
  $('#git-remote').value = state.settings.git?.remote || state.gitStatus.remote || '';
  $('#git-branch').value = state.settings.git?.branch || state.gitStatus.branch || 'vault';
  $('#auto-sync').checked = state.settings.autoSync !== false;
  $('#ai-provider').value = state.settings.ai?.provider || 'codex';
  $('#ai-model').value = state.settings.ai?.model || 'gpt-5.6-terra';
  $('#api-key').placeholder = state.hasApiKey ? 'API Key 已安全保存；留空表示不修改' : 'sk-…';
  $('#auto-analyze').checked = state.settings.ai?.autoAnalyze !== false;
  $('#generate-images').checked = state.settings.ai?.generateImages !== false;
  $('#daily-enabled').checked = state.settings.daily?.enabled !== false;
  $('#daily-keywords').value = state.settings.daily?.keywords || '';
  $('#daily-time').value = state.settings.daily?.time || '09:00';
  $('#daily-limit').value = Math.min(5, state.settings.daily?.limit || 5);
  $('#api-key-row').classList.toggle('hidden', $('#ai-provider').value !== 'openai');
  $('#git-state').textContent = state.gitStatus.initialized ? `Git 已初始化${state.gitStatus.dirty ? ' · 有未同步修改' : ' · 工作区已同步'}` : '尚未初始化 Git';
  $('#settings-dialog').showModal();
};
$('#choose-vault').onclick = async () => {
  try { const data = await window.paperVault.chooseVault(); if (!data) return; Object.assign(state, data); didInitialAutoSync = false; configureAutoSync(); $('#settings-dialog').close(); render(); toast('已切换论文库'); }
  catch (error) { toast(error.message, true); }
};
$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') { $('#settings-dialog').close(); return; }
  const button = $('#save-settings'); button.disabled = true;
  try {
    const remote = $('#git-remote').value.trim(); const branch = $('#git-branch').value.trim() || 'vault';
    const key = $('#api-key').value.trim(); if (key) { state.hasApiKey = await window.paperVault.saveApiKey(key); $('#api-key').value = ''; }
    state.settings = await window.paperVault.saveSettings({ ...state.settings, autoSync: $('#auto-sync').checked,
      ai: { ...(state.settings.ai || {}), provider: $('#ai-provider').value, model: $('#ai-model').value.trim(), autoAnalyze: $('#auto-analyze').checked, generateImages: $('#generate-images').checked },
      daily: { ...(state.settings.daily || {}), enabled: $('#daily-enabled').checked, keywords: $('#daily-keywords').value.trim(), time: $('#daily-time').value || '09:00', limit: Math.min(5, Math.max(1, Number($('#daily-limit').value) || 5)) },
      git: { remote, branch } });
    state.gitStatus = await window.paperVault.configureGit(remote, branch);
    configureAutoSync(); $('#settings-dialog').close(); toast('GitHub 同步设置已保存');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});
$('#sync-btn').onclick = async () => {
  await performSync(true);
};

$('#ai-provider').onchange = () => $('#api-key-row').classList.toggle('hidden', $('#ai-provider').value !== 'openai');
$('#test-ai').onclick = async (event) => {
  const button = event.currentTarget; button.disabled = true;
  try {
    const key = $('#api-key').value.trim(); if (key) { state.hasApiKey = await window.paperVault.saveApiKey(key); $('#api-key').value = ''; }
    await window.paperVault.saveSettings({ ...state.settings, ai: { ...(state.settings.ai || {}), provider: $('#ai-provider').value, model: $('#ai-model').value.trim() } });
    toast(await window.paperVault.testAI());
  } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
};
$('#run-daily').onclick = async (event) => {
  const button = event.currentTarget; button.disabled = true; button.textContent = '正在筛选与解析…';
  try {
    await window.paperVault.saveSettings({ ...state.settings, daily: { ...(state.settings.daily || {}), enabled: true, keywords: $('#daily-keywords').value.trim(), time: $('#daily-time').value || '09:00', limit: Math.min(5, Number($('#daily-limit').value) || 5) } });
    const result = await window.paperVault.runDaily(); const data = await window.paperVault.load(); Object.assign(state, data); render(); toast(`每日抓取完成：${result.imported.length} 篇`); scheduleAutoSync();
  } catch (error) { toast(error.message, true); } finally { button.disabled = false; button.textContent = '立即运行一次每日抓取'; }
};

$('#add-category').onclick = () => $('#category-dialog').showModal();
$('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (event.submitter?.value === 'cancel') { $('#category-dialog').close(); return; }
  try {
    const category = await window.paperVault.createCategory({ name: $('#category-name').value.trim(), color: $('#category-color').value, kind: 'manual' });
    state.categories.push(category); $('#category-form').reset(); $('#category-color').value = '#2563eb'; $('#category-dialog').close(); render(); scheduleAutoSync(); toast('分类已创建');
  } catch (error) { toast(error.message, true); }
});

function configureAutoSync() {
  clearInterval(autoSyncTimer);
  if (!state.settings.autoSync || !state.gitStatus.initialized || !state.gitStatus.remote) return;
  const seconds = Math.max(15, Number(state.settings.autoSyncIntervalSeconds) || 30);
  autoSyncTimer = setInterval(() => performSync(false), seconds * 1000);
}

function scheduleAutoSync() {
  if (!state.settings.autoSync || !state.gitStatus.initialized || !state.gitStatus.remote) return;
  clearTimeout(scheduledSyncTimer);
  scheduledSyncTimer = setTimeout(() => performSync(false), 2000);
}

async function performSync(showSuccess) {
  if (syncInFlight) return;
  syncInFlight = true;
  const button = $('#sync-btn'); const icon = $('#sync-icon'); button.disabled = true; icon.classList.add('spin');
  try {
    state.gitStatus = await window.paperVault.syncGit(state.settings.git?.branch || 'vault');
    const data = await window.paperVault.load();
    Object.assign(state, data); render(); configureAutoSync();
    if (showSuccess) toast('已与 GitHub 同步');
  } catch (error) { toast(`同步失败：${error.message}`, true); }
  finally { syncInFlight = false; button.disabled = false; icon.classList.remove('spin'); }
}

load();
