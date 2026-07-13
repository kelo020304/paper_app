'use strict';

// Static-browser preview only. Electron always supplies the real, sandboxed API from preload.js.
if (!window.paperVault && ['127.0.0.1', 'localhost'].includes(location.hostname)) {
  const now = new Date().toISOString();
  const papers = [
    {
      key: '2406.09246', id: '2406.09246v2', baseId: '2406.09246',
      title: 'OpenVLA: An Open-Source Vision-Language-Action Model',
      authors: ['Moo Jin Kim', 'Karl Pertsch', 'Siddharth Karamcheti', 'et al.'],
      abstract: 'We introduce OpenVLA, an open-source vision-language-action model trained on a diverse collection of robot demonstrations.',
      categories: ['cs.RO', 'cs.AI', 'cs.CV'], tags: ['VLA', 'Robotics'], status: 'reading', favorite: true,
      categoryId: 'vla', source: 'manual', analysisStatus: 'ready', valueScore: 9, valueReason: '开源 VLA 基线，影响广泛',
      published: '2024-06-13T00:00:00Z', updated: '2024-09-03T00:00:00Z', addedAt: now, notes: '重点关注数据配比与微调方法。', hasPdf: true,
      absUrl: 'https://arxiv.org/abs/2406.09246', pdfUrl: 'https://arxiv.org/pdf/2406.09246'
    },
    {
      key: '2307.15818', id: '2307.15818', baseId: '2307.15818',
      title: 'RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control',
      authors: ['Anthony Brohan', 'Noah Brown', 'Justice Carbajal', 'et al.'],
      abstract: 'We explore how vision-language models can be directly trained to output low-level actions for robotic control.',
      categories: ['cs.RO', 'cs.AI'], tags: ['VLA', 'Foundation Model'], status: 'done', favorite: false,
      categoryId: 'vla', dailyCategoryId: 'daily-2026-07-14', source: 'daily', valueScore: 8, valueReason: '代表性 VLA 工作',
      published: '2023-07-28T00:00:00Z', updated: '2023-07-28T00:00:00Z', addedAt: '2026-07-13T10:00:00Z', notes: '', hasPdf: false,
      absUrl: 'https://arxiv.org/abs/2307.15818', pdfUrl: 'https://arxiv.org/pdf/2307.15818'
    },
    {
      key: '2303.04137', id: '2303.04137', baseId: '2303.04137',
      title: 'PaLM-E: An Embodied Multimodal Language Model',
      authors: ['Danny Driess', 'Fei Xia', 'Meghan S. M. Sajjadi', 'et al.'],
      abstract: 'We propose an embodied multimodal language model that directly incorporates continuous sensor modalities.',
      categories: ['cs.LG', 'cs.RO'], tags: ['Embodied AI'], status: 'unread', favorite: false,
      categoryId: 'embodied-ai', source: 'manual',
      published: '2023-03-07T00:00:00Z', updated: '2023-03-07T00:00:00Z', addedAt: '2026-07-12T10:00:00Z', notes: '', hasPdf: true,
      absUrl: 'https://arxiv.org/abs/2303.04137', pdfUrl: 'https://arxiv.org/pdf/2303.04137'
    }
  ];
  const categories = [
    { id: 'vla', name: 'Vision-Language-Action', color: '#d95d39', kind: 'auto', relatedWorks: '# VLA Related Works' },
    { id: 'embodied-ai', name: 'Embodied AI', color: '#58756b', kind: 'manual', relatedWorks: '' },
    { id: 'daily-2026-07-14', name: '每日精选 2026-07-14', color: '#7556a8', kind: 'daily', date: '2026-07-14', relatedWorks: '' }
  ];
  window.paperVault = {
    load: async () => ({ vaultPath: '~/Documents/PaperVault (预览)', papers, categories, hasApiKey: false, settings: { autoSync: false, ai: { provider: 'codex', model: 'gpt-5.6-terra', autoAnalyze: true, generateImages: true }, daily: { enabled: true, time: '09:00', keywords: 'VLA, world model', limit: 5 }, git: { remote: '', branch: 'vault' } }, gitStatus: { initialized: false, remote: '', dirty: false } }),
    updatePaper: async (key, changes) => Object.assign(papers.find((paper) => paper.key === key), changes),
    removePaper: async (key) => { const index = papers.findIndex((paper) => paper.key === key); if (index >= 0) papers.splice(index, 1); },
    importPaper: async () => { throw new Error('静态预览不连接 arXiv，请在 Electron 应用中导入'); },
    chooseVault: async () => null,
    saveSettings: async (settings) => settings,
    configureGit: async () => ({ initialized: true, dirty: false }),
    syncGit: async () => ({ initialized: true, dirty: false }),
    downloadPdf: async () => true,
    openPdf: async () => true,
    openUrl: async () => true
    ,translatePaper: async () => true
    ,analyzePaper: async (key) => Object.assign(papers.find((paper) => paper.key === key), { analysisStatus: 'ready', valueScore: 8 })
    ,openAnalysis: async () => true
    ,createCategory: async (input) => { const category = { ...input, id: input.name.toLowerCase().replace(/\s+/g, '-'), relatedWorks: '' }; categories.push(category); return category; }
    ,openCategorySummary: async () => true
    ,updateCategorySummary: async () => true
    ,saveApiKey: async () => true
    ,testAI: async () => 'Paper Orbit AI 已连接。'
    ,runDaily: async () => ({ imported: [], date: '2026-07-14' })
  };
}
