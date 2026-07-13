'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = {
  version: 1,
  pdfPolicy: 'download',
  autoSync: true,
  autoSyncIntervalSeconds: 30,
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
  const settingsPath = path.join(vaultPath, 'vault.json');
  if (!(await pathExists(settingsPath))) await writeJsonAtomic(settingsPath, DEFAULT_SETTINGS);
  const readmePath = path.join(vaultPath, 'README.md');
  if (!(await pathExists(readmePath))) {
    await fs.writeFile(readmePath, '# Paper Vault\n\n由 Paper Vault 管理的本地论文库。论文元数据和笔记适合用 Git 同步。\n', 'utf8');
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
    return { ...DEFAULT_SETTINGS, ...saved, git: { ...DEFAULT_SETTINGS.git, ...(saved.git || {}) } };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

async function saveSettings(vaultPath, settings) {
  const next = {
    ...DEFAULT_SETTINGS,
    ...settings,
    git: { ...DEFAULT_SETTINGS.git, ...(settings.git || {}) }
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
      return { ...metadata, notes, hasPdf };
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
  const allowed = ['status', 'favorite', 'tags', 'rating'];
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
  return { dir, pdf: path.join(dir, 'paper.pdf') };
}

module.exports = {
  DEFAULT_SETTINGS, ensureVault, getSettings, saveSettings, listPapers,
  upsertPaper, updatePaper, removePaper, paperPaths, safePaperId
};
