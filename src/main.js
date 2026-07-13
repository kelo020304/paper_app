'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell, safeStorage, Tray, Menu, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { fetchArxivPaper } = require('./core/arxiv');
const { searchArxiv } = require('./core/arxiv');
const library = require('./core/library');
const git = require('./core/git');
const ai = require('./core/ai');
const research = require('./core/research');

// Keep the existing Paper Vault settings, session data and encrypted API key after the product rename.
app.setPath('userData', path.join(app.getPath('appData'), 'paper-vault'));
app.setName('Paper Orbit');

let mainWindow;
let syncQueue = Promise.resolve();
let dailyTimer;
let tray;
let isQuitting = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
else app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
});

function appConfigPath() { return path.join(app.getPath('userData'), 'config.json'); }

async function readAppConfig() {
  try { return JSON.parse(await fs.readFile(appConfigPath(), 'utf8')); }
  catch { return { vaultPath: path.join(app.getPath('documents'), 'PaperVault') }; }
}

async function writeAppConfig(config) {
  await fs.mkdir(path.dirname(appConfigPath()), { recursive: true });
  await fs.writeFile(appConfigPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function secretPath() { return path.join(app.getPath('userData'), 'openai-key.bin'); }

async function saveApiKey(key) {
  if (!key) { await fs.rm(secretPath(), { force: true }); return; }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用，无法安全保存 API Key');
  await fs.writeFile(secretPath(), safeStorage.encryptString(key.trim()));
}

async function getApiKey() {
  try {
    const encrypted = await fs.readFile(secretPath());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(encrypted) : '';
  } catch { return ''; }
}

async function currentVault() {
  const config = await readAppConfig();
  await library.ensureVault(config.vaultPath);
  return config.vaultPath;
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try { return { ok: true, data: await fn(...args) }; }
    catch (error) {
      console.error(channel, error);
      return { ok: false, error: error.message || String(error) };
    }
  });
}

function registerIpc() {
  handle('vault:load', async () => {
    const vaultPath = await currentVault();
    const settings = await library.getSettings(vaultPath);
    let gitStatus = await git.gitStatus(vaultPath);
    if (!gitStatus.initialized && settings.git?.remote) {
      gitStatus = await git.configureGit(vaultPath, settings.git.remote, settings.git.branch || 'vault');
    }
    const [papers, categories] = await Promise.all([library.listPapers(vaultPath), library.listCategories(vaultPath)]);
    return { vaultPath, papers, categories, settings, gitStatus, hasApiKey: Boolean(await getApiKey()) };
  });

  handle('vault:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Paper Orbit 文件夹', properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    const vaultPath = result.filePaths[0];
    await library.ensureVault(vaultPath);
    await writeAppConfig({ vaultPath });
    return { vaultPath, papers: await library.listPapers(vaultPath), categories: await library.listCategories(vaultPath), settings: await library.getSettings(vaultPath), gitStatus: await git.gitStatus(vaultPath), hasApiKey: Boolean(await getApiKey()) };
  });

  handle('paper:import', async (input, options = {}) => {
    const vaultPath = await currentVault();
    const paper = await fetchArxivPaper(input);
    let saved = await library.upsertPaper(vaultPath, paper, { tags: options.tags || [], source: 'manual' });
    if (options.downloadPdf) await downloadPdf(vaultPath, saved);
    const settings = await library.getSettings(vaultPath);
    if (settings.ai?.autoAnalyze) {
      try { saved = await analyzeAndStorePaper(vaultPath, { ...saved, hasPdf: options.downloadPdf || saved.hasPdf }, settings); }
      catch (error) { saved = { ...saved, analysisStatus: 'failed', analysisError: error.message }; await library.updatePaper(vaultPath, saved.key, { analysisStatus: 'failed' }); }
    }
    return { ...saved, hasPdf: options.downloadPdf || saved.hasPdf };
  });

  handle('paper:update', async (key, changes) => {
    const vaultPath = await currentVault();
    const updated = await library.updatePaper(vaultPath, key, changes);
    if ('categoryId' in changes && changes.categoryId) {
      updateCategorySummary(vaultPath, changes.categoryId, await library.getSettings(vaultPath)).catch((error) => console.error('category:summary', error));
    }
    return updated;
  });
  handle('paper:remove', async (key) => library.removePaper(await currentVault(), key));
  handle('paper:download', async (paper) => {
    const vaultPath = await currentVault();
    await downloadPdf(vaultPath, paper);
    return true;
  });
  handle('paper:open-pdf', async (key) => {
    const { pdf } = library.paperPaths(await currentVault(), key);
    const error = await shell.openPath(pdf);
    if (error) throw new Error(error);
    return true;
  });
  handle('paper:open-url', async (url) => {
    if (!/^https:\/\/(?:www\.)?(?:arxiv\.org|hjfy\.top)\//i.test(url)) throw new Error('只允许打开 arXiv 或幻觉翻译链接');
    await shell.openExternal(url);
    return true;
  });
  handle('paper:translate', async (id) => {
    const baseId = String(id).replace(/v\d+$/i, '');
    await shell.openExternal(`https://hjfy.top/arxiv/${encodeURIComponent(baseId)}`);
    return true;
  });
  handle('paper:open-analysis', async (key) => {
    const target = library.paperPaths(await currentVault(), key).analysisHtml;
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return true;
  });
  handle('paper:analyze', async (key) => {
    const vaultPath = await currentVault();
    const paper = (await library.listPapers(vaultPath)).find((item) => item.key === key);
    if (!paper) throw new Error('论文不存在');
    try { return await analyzeAndStorePaper(vaultPath, paper, await library.getSettings(vaultPath)); }
    catch (error) { await library.updatePaper(vaultPath, key, { analysisStatus: 'failed' }); throw error; }
  });
  handle('category:create', async (input) => library.createCategory(await currentVault(), input));
  handle('category:update-summary', async (id) => updateCategorySummary(await currentVault(), id, await library.getSettings(await currentVault())));
  handle('category:open-summary', async (id) => {
    const target = path.join(await currentVault(), 'categories', library.safeCategoryId(id), 'related-works.md');
    const error = await shell.openPath(target); if (error) throw new Error(error); return true;
  });
  handle('ai:save-key', async (key) => { await saveApiKey(key); return Boolean(key); });
  handle('ai:test', async () => {
    const settings = await library.getSettings(await currentVault());
    return ai.askAI(settings, await getApiKey(), '只回复：Paper Orbit AI 已连接。');
  });
  handle('daily:run', async () => runDaily(await currentVault(), true));

  handle('settings:save', async (settings) => {
    const saved = await library.saveSettings(await currentVault(), settings);
    await configureBackground(saved);
    scheduleDaily(saved);
    return saved;
  });
  handle('git:configure', async (remote, branch) => {
    const vaultPath = await currentVault();
    const status = await git.configureGit(vaultPath, remote, branch);
    const settings = await library.getSettings(vaultPath);
    await library.saveSettings(vaultPath, { ...settings, git: { remote, branch } });
    return status;
  });
  handle('git:sync', async (branch) => {
    const vaultPath = await currentVault();
    const run = () => git.syncGit(vaultPath, branch || 'vault');
    syncQueue = syncQueue.then(run, run);
    return syncQueue;
  });
}

async function analyzeAndStorePaper(vaultPath, paper, settings) {
  await library.updatePaper(vaultPath, paper.key, { analysisStatus: 'analyzing' });
  const categories = await library.listCategories(vaultPath);
  const source = await research.fetchPaperHtml(paper).catch(() => ({ html: '', text: paper.abstract || '' }));
  if (source.html) await library.saveSourceHtml(vaultPath, paper.key, source.html);
  const analysis = await ai.analyzePaper(settings, await getApiKey(), paper, source.text, categories.map((item) => item.name));
  const suggested = /^(暂无|未知|无|未分类)$/i.test(String(analysis.suggestedCategory).trim()) ? '待整理' : (analysis.suggestedCategory || '待整理');
  let category = categories.find((item) => item.id === paper.categoryId || item.name.toLowerCase() === suggested.toLowerCase());
  if (!category) category = await library.createCategory(vaultPath, { name: suggested, color: '#3d7f8c', kind: 'auto' });
  paper = await library.updatePaper(vaultPath, paper.key, { categoryId: category.id, valueScore: analysis.valueScore, valueReason: analysis.valueReason });
  let image = null;
  if (analysis.isKeyPaper && settings.ai?.generateImages !== false) {
    image = await ai.generatePrincipleImage(settings, await getApiKey(), paper, analysis.imagePrompt).catch(() => null);
  }
  const html = research.analysisHtml(paper, analysis, Boolean(image));
  await library.saveAnalysis(vaultPath, paper.key, analysis, html, image);
  await updateCategorySummary(vaultPath, category.id, settings);
  return { ...paper, analysisStatus: 'ready', valueScore: analysis.valueScore, valueReason: analysis.valueReason, categoryId: category.id, hasAnalysis: true, hasPrincipleImage: Boolean(image) };
}

async function updateCategorySummary(vaultPath, categoryId, settings) {
  const categories = await library.listCategories(vaultPath);
  const category = categories.find((item) => item.id === categoryId);
  if (!category) throw new Error('分类不存在');
  const papers = (await library.listPapers(vaultPath)).filter((paper) => paper.categoryId === categoryId || paper.dailyCategoryId === categoryId);
  const summarized = new Set(category.summaryPaperKeys || []);
  const additions = [];
  for (const paper of papers.filter((item) => !summarized.has(item.key))) {
    const analysisPath = library.paperPaths(vaultPath, paper.key).analysis;
    let analysisData = null;
    try { analysisData = JSON.parse(await fs.readFile(analysisPath, 'utf8')); } catch {}
    additions.push({ ...paper, analysis: analysisData });
  }
  if (!additions.length) return category;
  const markdown = await ai.updateRelatedWorks(settings, await getApiKey(), category, category.relatedWorks, additions);
  return library.saveCategorySummary(vaultPath, category, markdown, [...summarized, ...additions.map((item) => item.key)]);
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function runDaily(vaultPath, force = false) {
  const settings = await library.getSettings(vaultPath);
  const date = localDate();
  if (!settings.daily?.enabled && !force) return { skipped: true, reason: 'disabled' };
  if (!force && settings.daily.lastRunDate === date) return { skipped: true, reason: 'already-run' };
  const existing = await library.listPapers(vaultPath);
  const existingIds = new Set(existing.map((paper) => paper.baseId));
  const candidates = (await searchArxiv(settings.daily.keywords, 30)).filter((paper) => !existingIds.has(paper.baseId));
  if (!candidates.length) return { imported: [], date };
  const limit = Math.min(5, Math.max(1, Number(settings.daily.limit) || 5));
  const ranked = await ai.rankDailyPapers(settings, await getApiKey(), candidates, settings.daily.keywords, limit);
  const category = await library.getOrCreateDailyCategory(vaultPath, date);
  const imported = [];
  for (const pick of ranked.picks.slice(0, limit)) {
    const candidate = candidates[pick.index];
    if (!candidate) continue;
    let paper = await library.upsertPaper(vaultPath, candidate, { source: 'daily', dailyCategoryId: category.id, valueScore: pick.score, valueReason: pick.reason, tags: [`每日精选:${date}`] });
    try { paper = await analyzeAndStorePaper(vaultPath, paper, settings); }
    catch (error) { paper = { ...paper, analysisStatus: 'failed', valueReason: `${pick.reason}；解析失败：${error.message}` }; await library.updatePaper(vaultPath, paper.key, paper); }
    imported.push(paper);
  }
  settings.daily.lastRunDate = date;
  await library.saveSettings(vaultPath, settings);
  await updateCategorySummary(vaultPath, category.id, settings).catch(() => {});
  return { imported, date, category };
}

function scheduleDaily(settings) {
  clearTimeout(dailyTimer);
  if (!settings.daily?.enabled) return;
  const [hour, minute] = String(settings.daily.time || '09:00').split(':').map(Number);
  const now = new Date(); const next = new Date(now); next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  dailyTimer = setTimeout(async () => {
    try { await runDaily(await currentVault()); } catch (error) { console.error('daily:run', error); }
    scheduleDaily(await library.getSettings(await currentVault()));
  }, Math.min(2_147_000_000, next - now));
}

async function configureBackground(settings) {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: Boolean(settings.daily?.enabled), openAsHidden: true });
  if (process.platform === 'linux' && app.isPackaged) {
    const dir = path.join(app.getPath('home'), '.config', 'autostart'); const file = path.join(dir, 'paper-vault.desktop');
    if (settings.daily?.enabled) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file, `[Desktop Entry]\nType=Application\nName=Paper Orbit\nExec=${process.execPath} --hidden\nX-GNOME-Autostart-enabled=true\n`, 'utf8');
    } else await fs.rm(file, { force: true });
  }
}

async function downloadPdf(vaultPath, paper) {
  const target = library.paperPaths(vaultPath, paper.key || paper.baseId || paper.id).pdf;
  const response = await fetch(paper.pdfUrl, { headers: { 'User-Agent': 'PaperOrbit/0.4 (personal research library)' }, redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`PDF 下载失败（HTTP ${response.status}）`);
  const tmp = `${target}.tmp`;
  await pipeline(Readable.fromWeb(response.body), require('node:fs').createWriteStream(tmp));
  await fs.rename(tmp, target);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#f4f5f5',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault(); mainWindow.hide();
  });
}

function createTray() {
  if (tray) return;
  const traySize = process.platform === 'darwin' ? 18 : 20;
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: traySize, height: traySize });
  tray = new Tray(icon);
  tray.setToolTip('Paper Orbit');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Paper Orbit', click: () => { if (!mainWindow) createWindow(); mainWindow.show(); } },
    { label: '立即运行每日抓取', click: async () => runDaily(await currentVault(), true).catch((error) => console.error(error)) },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', () => { if (!mainWindow) createWindow(); mainWindow.show(); });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  createTray();
  currentVault().then(async (vaultPath) => {
    const settings = await library.getSettings(vaultPath);
    await configureBackground(settings);
    scheduleDaily(settings);
    const [hour, minute] = String(settings.daily?.time || '09:00').split(':').map(Number);
    const now = new Date();
    if (settings.daily?.enabled && settings.daily.lastRunDate !== localDate() && (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute))) {
      runDaily(vaultPath).catch((error) => console.error('daily:catch-up', error));
    }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else mainWindow.show(); });
});

app.on('before-quit', () => { isQuitting = true; });
