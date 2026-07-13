'use strict';

const { contextBridge, ipcRenderer } = require('electron');

async function invoke(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

contextBridge.exposeInMainWorld('paperVault', {
  load: () => invoke('vault:load'),
  chooseVault: () => invoke('vault:choose'),
  importPaper: (input, options) => invoke('paper:import', input, options),
  updatePaper: (key, changes) => invoke('paper:update', key, changes),
  removePaper: (key) => invoke('paper:remove', key),
  downloadPdf: (paper) => invoke('paper:download', paper),
  openPdf: (key) => invoke('paper:open-pdf', key),
  openUrl: (url) => invoke('paper:open-url', url),
  translatePaper: (id) => invoke('paper:translate', id),
  analyzePaper: (key) => invoke('paper:analyze', key),
  openAnalysis: (key) => invoke('paper:open-analysis', key),
  createCategory: (input) => invoke('category:create', input),
  updateCategorySummary: (id) => invoke('category:update-summary', id),
  openCategorySummary: (id) => invoke('category:open-summary', id),
  saveApiKey: (key) => invoke('ai:save-key', key),
  testAI: () => invoke('ai:test'),
  runDaily: () => invoke('daily:run'),
  saveSettings: (settings) => invoke('settings:save', settings),
  configureGit: (remote, branch) => invoke('git:configure', remote, branch),
  syncGit: (branch) => invoke('git:sync', branch)
});
