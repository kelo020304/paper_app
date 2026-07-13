'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { fetchArxivPaper } = require('./core/arxiv');
const library = require('./core/library');
const git = require('./core/git');

let mainWindow;
let syncQueue = Promise.resolve();

function appConfigPath() { return path.join(app.getPath('userData'), 'config.json'); }

async function readAppConfig() {
  try { return JSON.parse(await fs.readFile(appConfigPath(), 'utf8')); }
  catch { return { vaultPath: path.join(app.getPath('documents'), 'PaperVault') }; }
}

async function writeAppConfig(config) {
  await fs.mkdir(path.dirname(appConfigPath()), { recursive: true });
  await fs.writeFile(appConfigPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
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
    const papers = await library.listPapers(vaultPath);
    return { vaultPath, papers, settings, gitStatus };
  });

  handle('vault:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Paper Vault 文件夹', properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    const vaultPath = result.filePaths[0];
    await library.ensureVault(vaultPath);
    await writeAppConfig({ vaultPath });
    return { vaultPath, papers: await library.listPapers(vaultPath), settings: await library.getSettings(vaultPath), gitStatus: await git.gitStatus(vaultPath) };
  });

  handle('paper:import', async (input, options = {}) => {
    const vaultPath = await currentVault();
    const paper = await fetchArxivPaper(input);
    const saved = await library.upsertPaper(vaultPath, paper, { tags: options.tags || [] });
    if (options.downloadPdf) await downloadPdf(vaultPath, saved);
    return { ...saved, hasPdf: options.downloadPdf || saved.hasPdf };
  });

  handle('paper:update', async (key, changes) => library.updatePaper(await currentVault(), key, changes));
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
    if (!/^https:\/\/(?:www\.)?arxiv\.org\//i.test(url)) throw new Error('只允许打开 arXiv 链接');
    await shell.openExternal(url);
    return true;
  });

  handle('settings:save', async (settings) => library.saveSettings(await currentVault(), settings));
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

async function downloadPdf(vaultPath, paper) {
  const target = library.paperPaths(vaultPath, paper.key || paper.baseId || paper.id).pdf;
  const response = await fetch(paper.pdfUrl, { headers: { 'User-Agent': 'PaperVault/0.1 (personal research library)' }, redirect: 'follow' });
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
    backgroundColor: '#f5f1e8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
