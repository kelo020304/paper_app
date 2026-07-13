'use strict';

const state = { papers: [], settings: {}, gitStatus: {}, vaultPath: '', filter: 'all', tag: '', query: '', sort: 'added' };
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
  $('#vault-path').textContent = state.vaultPath;
  $('#vault-path').title = state.vaultPath;
  $('#page-title').textContent = state.tag ? `# ${state.tag}` : filterNames[state.filter];
  $('#result-count').textContent = state.papers.length ? `显示 ${papers.length} / ${state.papers.length} 篇论文` : '你的本地优先研究资料库';
  renderTags();
  const grid = $('#paper-grid');
  const empty = $('#empty-state');
  grid.classList.toggle('hidden', papers.length === 0);
  empty.classList.toggle('hidden', papers.length !== 0);
  empty.querySelector('h2').textContent = state.papers.length ? '没有匹配的论文' : '开始建立你的论文库';
  empty.querySelector('p').textContent = state.papers.length ? '试试清除搜索词或切换筛选条件。' : '粘贴 arXiv 链接或编号，标题、作者和摘要会自动归档。';
  grid.innerHTML = papers.map(paperCard).join('');
}

function paperCard(paper) {
  const tags = (paper.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const extra = (paper.tags || []).length > 3 ? `<span class="tag">+${paper.tags.length - 3}</span>` : '';
  return `<article class="paper-card" data-key="${escapeHtml(paper.key)}">
    <div class="card-top"><button class="status-pill" data-action="cycle-status" data-status="${paper.status}">${statusNames[paper.status] || '待读'}</button><span class="arxiv-id">${escapeHtml(paper.id)}</span><button class="favorite-btn ${paper.favorite ? 'active' : ''}" data-action="favorite" title="收藏">${paper.favorite ? '◆' : '◇'}</button></div>
    <h2 class="paper-title">${escapeHtml(paper.title)}</h2>
    <div class="authors">${escapeHtml((paper.authors || []).join(', '))}</div>
    <p class="abstract">${escapeHtml(paper.abstract)}</p>
    <div class="card-bottom">${tags}${extra}${paper.hasPdf ? '<span class="pdf-badge">PDF ✓</span>' : ''}</div>
  </article>`;
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
  $('#detail-content').innerHTML = `<div class="detail-shell">
    <button class="dialog-close detail-close" data-detail-close>×</button>
    <section class="detail-main">
      <p class="eyebrow">ARXIV · ${escapeHtml(paper.id)}</p>
      <h2>${escapeHtml(paper.title)}</h2>
      <div class="detail-authors">${escapeHtml((paper.authors || []).join(', '))}</div>
      <div class="detail-section"><h3>摘要</h3><p class="detail-abstract">${escapeHtml(paper.abstract)}</p></div>
      <div class="detail-section"><h3>我的笔记</h3><textarea id="detail-notes" class="notes-area" placeholder="记录核心观点、方法、疑问和复现实验…">${escapeHtml(paper.notes || '')}</textarea></div>
    </section>
    <aside class="detail-side">
      <div class="side-field"><h3>阅读状态</h3><select id="detail-status"><option value="unread">待读</option><option value="reading">阅读中</option><option value="done">已读</option></select></div>
      <div class="side-field"><h3>标签</h3><input id="detail-tags" value="${escapeHtml((paper.tags || []).join(', '))}" placeholder="逗号分隔"></div>
      <div class="side-field"><h3>论文信息</h3><div class="meta-line">发表：${escapeHtml((paper.published || '').slice(0, 10))}<br>分类：${escapeHtml((paper.categories || []).join(', '))}<br>更新：${escapeHtml((paper.updated || '').slice(0, 10))}</div></div>
      <div class="detail-actions">
        <button class="button primary" id="detail-save">保存修改</button>
        <button class="button ghost" id="detail-pdf">${paper.hasPdf ? '打开 PDF' : '下载 PDF'}</button>
        <button class="button ghost" id="detail-arxiv">在 arXiv 查看</button>
        <button class="button danger" id="detail-delete">移出论文库</button>
      </div>
    </aside>
  </div>`;
  $('#detail-status').value = paper.status;
  dialog.showModal();
  $('[data-detail-close]').onclick = () => dialog.close();
  $('#detail-save').onclick = async () => {
    const changes = {
      status: $('#detail-status').value,
      tags: $('#detail-tags').value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      notes: $('#detail-notes').value
    };
    await patchPaper(paper.key, changes);
    dialog.close(); toast('论文信息已保存');
  };
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
  state.filter = item.dataset.filter; state.tag = ''; render();
});
$('#tag-list').addEventListener('click', (event) => { const item = event.target.closest('[data-tag]'); if (!item) return; state.tag = item.dataset.tag; render(); });
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
  const button = $('#import-submit'); button.disabled = true; button.textContent = '正在获取…';
  try {
    const paper = await window.paperVault.importPaper($('#arxiv-input').value, {
      tags: $('#import-tags').value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      downloadPdf: $('#download-pdf').checked
    });
    const old = state.papers.findIndex((item) => item.key === paper.key);
    if (old >= 0) state.papers[old] = paper; else state.papers.unshift(paper);
    $('#import-dialog').close(); $('#import-form').reset(); $('#download-pdf').checked = true; render(); toast('论文已导入');
    scheduleAutoSync();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.textContent = '导入论文'; }
});

$('#settings-btn').onclick = () => {
  $('#settings-vault').value = state.vaultPath;
  $('#git-remote').value = state.settings.git?.remote || state.gitStatus.remote || '';
  $('#git-branch').value = state.settings.git?.branch || state.gitStatus.branch || 'vault';
  $('#auto-sync').checked = state.settings.autoSync !== false;
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
    state.settings = await window.paperVault.saveSettings({ ...state.settings, autoSync: $('#auto-sync').checked, git: { remote, branch } });
    state.gitStatus = await window.paperVault.configureGit(remote, branch);
    configureAutoSync(); $('#settings-dialog').close(); toast('GitHub 同步设置已保存');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});
$('#sync-btn').onclick = async () => {
  await performSync(true);
};

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
