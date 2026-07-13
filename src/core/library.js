'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = {
  version: 1,
  pdfPolicy: 'download',
  autoSync: true,
  autoSyncIntervalSeconds: 30,
  ai: { provider: 'codex', model: 'gpt-5.6-terra', baseUrl: 'https://api.openai.com/v1', autoAnalyze: true, generateImages: true },
  daily: { enabled: true, time: '09:00', keywords: 'vision language action, autonomous driving, world model', limit: 5, lastRunDate: '' },
  git: { remote: 'git@github.com:kelo020304/paper_app.git', branch: 'vault' }
};

function safePaperId(id) {
  return String(id).replace(/v\d+$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function pathExists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}

async function ensureVault(vaultPath) {
  await fs.mkdir(path.join(vaultPath, 'papers'), { recursive: true });
  await fs.mkdir(path.join(vaultPath, 'categories'), { recursive: true });
  const settingsPath = path.join(vaultPath, 'vault.json');
  if (!(await pathExists(settingsPath))) await writeJsonAtomic(settingsPath, DEFAULT_SETTINGS);
  const readmePath = path.join(vaultPath, 'README.md');
  if (!(await pathExists(readmePath))) {
    await fs.writeFile(readmePath, '# Paper Orbit\n\n由 Paper Orbit 管理的本地论文库。论文元数据和笔记适合用 Git 同步。\n', 'utf8');
  }
  const gitignorePath = path.join(vaultPath, '.gitignore');
  if (!(await pathExists(gitignorePath))) {
    await fs.writeFile(gitignorePath, '.DS_Store\n*.tmp\n', 'utf8');
  }
  return vaultPath;
}

async function getSettings(vaultPath) {
  await ensureVault(vaultPath);
  try {
    const saved = JSON.parse(await fs.readFile(path.join(vaultPath, 'vault.json'), 'utf8'));
    return {
      ...DEFAULT_SETTINGS, ...saved,
      git: { ...DEFAULT_SETTINGS.git, ...(saved.git || {}) },
      ai: { ...DEFAULT_SETTINGS.ai, ...(saved.ai || {}) },
      daily: { ...DEFAULT_SETTINGS.daily, ...(saved.daily || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

async function saveSettings(vaultPath, settings) {
  const next = {
    ...DEFAULT_SETTINGS,
    ...settings,
    git: { ...DEFAULT_SETTINGS.git, ...(settings.git || {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(settings.ai || {}) },
    daily: { ...DEFAULT_SETTINGS.daily, ...(settings.daily || {}) }
  };
  await writeJsonAtomic(path.join(vaultPath, 'vault.json'), next);
  return next;
}

async function listPapers(vaultPath) {
  await ensureVault(vaultPath);
  const root = path.join(vaultPath, 'papers');
  const entries = await fs.readdir(root, { withFileTypes: true });
  const papers = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      const paperDir = path.join(root, entry.name);
      const metadata = JSON.parse(await fs.readFile(path.join(paperDir, 'metadata.json'), 'utf8'));
      const notes = await fs.readFile(path.join(paperDir, 'notes.md'), 'utf8').catch(() => '');
      const hasPdf = await pathExists(path.join(paperDir, 'paper.pdf'));
      const hasAnalysis = await pathExists(path.join(paperDir, 'analysis.html'));
      const hasPrincipleImage = await pathExists(path.join(paperDir, 'principle.png'));
      return { ...metadata, notes, hasPdf, hasAnalysis, hasPrincipleImage };
    } catch { return null; }
  }));
  return papers.filter(Boolean).sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
}

async function upsertPaper(vaultPath, paper, changes = {}) {
  const key = safePaperId(paper.baseId || paper.id);
  const paperDir = path.join(vaultPath, 'papers', key);
  await fs.mkdir(paperDir, { recursive: true });
  let previous = {};
  try { previous = JSON.parse(await fs.readFile(path.join(paperDir, 'metadata.json'), 'utf8')); } catch {}
  const now = new Date().toISOString();
  const metadata = {
    ...previous,
    ...paper,
    ...changes,
    key,
    status: changes.status || previous.status || 'unread',
    favorite: changes.favorite ?? previous.favorite ?? false,
    tags: changes.tags ?? previous.tags ?? [],
    categoryId: changes.categoryId ?? previous.categoryId ?? '',
    dailyCategoryId: changes.dailyCategoryId ?? previous.dailyCategoryId ?? '',
    source: changes.source ?? previous.source ?? 'manual',
    addedAt: previous.addedAt || now,
    modifiedAt: now
  };
  delete metadata.notes;
  delete metadata.hasPdf;
  await writeJsonAtomic(path.join(paperDir, 'metadata.json'), metadata);
  const notesPath = path.join(paperDir, 'notes.md');
  if (!(await pathExists(notesPath))) await fs.writeFile(notesPath, '', 'utf8');
  const notes = changes.notes ?? await fs.readFile(notesPath, 'utf8');
  return { ...metadata, notes, hasPdf: await pathExists(path.join(paperDir, 'paper.pdf')) };
}

async function updatePaper(vaultPath, key, changes) {
  const paperDir = path.join(vaultPath, 'papers', safePaperId(key));
  const metadataPath = path.join(paperDir, 'metadata.json');
  const existing = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const allowed = ['status', 'favorite', 'tags', 'rating', 'categoryId', 'dailyCategoryId', 'source', 'valueScore', 'valueReason', 'analysisStatus'];
  const next = { ...existing, modifiedAt: new Date().toISOString() };
  for (const field of allowed) if (field in changes) next[field] = changes[field];
  await writeJsonAtomic(metadataPath, next);
  if ('notes' in changes) await fs.writeFile(path.join(paperDir, 'notes.md'), String(changes.notes), 'utf8');
  return { ...next, notes: changes.notes ?? await fs.readFile(path.join(paperDir, 'notes.md'), 'utf8').catch(() => '') };
}

async function removePaper(vaultPath, key) {
  await fs.rm(path.join(vaultPath, 'papers', safePaperId(key)), { recursive: true, force: true });
}

function paperPaths(vaultPath, key) {
  const dir = path.join(vaultPath, 'papers', safePaperId(key));
  return {
    dir, pdf: path.join(dir, 'paper.pdf'), analysis: path.join(dir, 'analysis.json'),
    analysisHtml: path.join(dir, 'analysis.html'), sourceHtml: path.join(dir, 'source.html'),
    principleImage: path.join(dir, 'principle.png')
  };
}

function safeCategoryId(value) {
  const ascii = String(value || '').normalize('NFKD').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return ascii || `category-${Date.now()}`;
}

async function listCategories(vaultPath) {
  await ensureVault(vaultPath);
  const root = path.join(vaultPath, 'categories');
  const entries = await fs.readdir(root, { withFileTypes: true });
  const categories = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      const dir = path.join(root, entry.name);
      const metadata = JSON.parse(await fs.readFile(path.join(dir, 'metadata.json'), 'utf8'));
      const relatedWorks = await fs.readFile(path.join(dir, 'related-works.md'), 'utf8').catch(() => '');
      return { ...metadata, relatedWorks };
    } catch { return null; }
  }));
  return categories.filter(Boolean).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

async function createCategory(vaultPath, input) {
  const base = safeCategoryId(input.id || input.name);
  let id = base; let suffix = 2;
  while (await pathExists(path.join(vaultPath, 'categories', id))) id = `${base}-${suffix++}`;
  const dir = path.join(vaultPath, 'categories', id);
  await fs.mkdir(dir, { recursive: true });
  const metadata = {
    id, name: String(input.name).trim(), color: input.color || '#58756b',
    kind: input.kind || 'manual', date: input.date || '', createdAt: new Date().toISOString(), summaryPaperKeys: []
  };
  await writeJsonAtomic(path.join(dir, 'metadata.json'), metadata);
  await fs.writeFile(path.join(dir, 'related-works.md'), `# ${metadata.name} — Related Works\n\n`, 'utf8');
  return { ...metadata, relatedWorks: `# ${metadata.name} — Related Works\n\n` };
}

async function getOrCreateDailyCategory(vaultPath, date) {
  const categories = await listCategories(vaultPath);
  const existing = categories.find((category) => category.kind === 'daily' && category.date === date);
  if (existing) return existing;
  return createCategory(vaultPath, { id: `daily-${date}`, name: `每日精选 ${date}`, color: '#7556a8', kind: 'daily', date });
}

async function saveAnalysis(vaultPath, key, analysis, html, image = null) {
  const paths = paperPaths(vaultPath, key);
  await writeJsonAtomic(paths.analysis, analysis);
  await fs.writeFile(paths.analysisHtml, html, 'utf8');
  if (image) await fs.writeFile(paths.principleImage, image);
  await updatePaper(vaultPath, key, { valueScore: analysis.valueScore, valueReason: analysis.valueReason, analysisStatus: 'ready' });
  return paths;
}

async function saveSourceHtml(vaultPath, key, html) {
  const paths = paperPaths(vaultPath, key);
  await fs.writeFile(paths.sourceHtml, html, 'utf8');
  return paths.sourceHtml;
}

async function saveCategorySummary(vaultPath, category, markdown, paperKeys) {
  const dir = path.join(vaultPath, 'categories', safeCategoryId(category.id));
  const metadataPath = path.join(dir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const next = { ...metadata, summaryPaperKeys: [...new Set(paperKeys)], summaryUpdatedAt: new Date().toISOString() };
  await writeJsonAtomic(metadataPath, next);
  await fs.writeFile(path.join(dir, 'related-works.md'), markdown, 'utf8');
  return { ...next, relatedWorks: markdown };
}

module.exports = {
  DEFAULT_SETTINGS, ensureVault, getSettings, saveSettings, listPapers,
  upsertPaper, updatePaper, removePaper, paperPaths, safePaperId,
  listCategories, createCategory, getOrCreateDailyCategory, saveAnalysis,
  saveSourceHtml, saveCategorySummary, safeCategoryId
};
