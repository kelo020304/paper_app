'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    oneSentence: { type: 'string' },
    problem: { type: 'string' },
    contributions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    method: { type: 'string' },
    experiments: { type: 'string' },
    limitations: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    relatedWorks: { type: 'string' },
    valueScore: { type: 'integer', minimum: 1, maximum: 10 },
    valueReason: { type: 'string' },
    suggestedCategory: { type: 'string' },
    isKeyPaper: { type: 'boolean' },
    imagePrompt: { type: 'string' }
  },
  required: ['oneSentence', 'problem', 'contributions', 'method', 'experiments', 'limitations', 'relatedWorks', 'valueScore', 'valueReason', 'suggestedCategory', 'isKeyPaper', 'imagePrompt']
};

function extractResponseText(payload) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  throw new Error('AI 没有返回文本结果');
}

function parseJsonText(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function callOpenAI(settings, apiKey, prompt, schema = null) {
  if (!apiKey) throw new Error('请在设置中保存 OpenAI API Key');
  const body = {
    model: settings.ai?.model || 'gpt-5.6-terra',
    input: prompt,
    reasoning: { effort: 'medium' },
    text: schema ? { format: { type: 'json_schema', name: 'paper_result', strict: true, schema } } : { verbosity: 'medium' }
  };
  const baseUrl = String(settings.ai?.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI 请求失败（HTTP ${response.status}）`);
  return schema ? parseJsonText(extractResponseText(payload)) : extractResponseText(payload);
}

function codexCandidates() {
  return [
    '/Applications/ChatGPT.app/Contents/Resources/codex',
    path.join(os.homedir(), '.local', 'bin', 'codex'),
    '/usr/local/bin/codex', '/opt/homebrew/bin/codex', 'codex'
  ];
}

function runProcess(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `Codex 退出码 ${code}`)));
    child.stdin.end(input);
  });
}

async function callCodex(settings, prompt, schema = null) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-vault-ai-'));
  const outputFile = path.join(tmp, 'result.txt');
  const schemaFile = path.join(tmp, 'schema.json');
  if (schema) await fs.writeFile(schemaFile, JSON.stringify(schema), 'utf8');
  const args = ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '-o', outputFile];
  if (settings.ai?.model) args.push('--model', settings.ai.model);
  if (schema) args.push('--output-schema', schemaFile);
  args.push('-');
  let lastError;
  try {
    for (const command of codexCandidates()) {
      try {
        await runProcess(command, args, prompt);
        const result = await fs.readFile(outputFile, 'utf8');
        return schema ? parseJsonText(result) : result;
      } catch (error) {
        lastError = error;
        if (!/ENOENT|spawn .* not found/i.test(error.message)) break;
      }
    }
    throw lastError || new Error('未找到 Codex，请先安装并登录 ChatGPT/Codex');
  } finally { await fs.rm(tmp, { recursive: true, force: true }).catch(() => {}); }
}

async function askAI(settings, apiKey, prompt, schema = null) {
  return settings.ai?.provider === 'openai'
    ? callOpenAI(settings, apiKey, prompt, schema)
    : callCodex(settings, prompt, schema);
}

async function analyzePaper(settings, apiKey, paper, sourceText, categoryNames) {
  const prompt = `你是严谨的机器学习论文研究助理。请分析下面论文，输出中文。详细但不冗余；只陈述论文有依据的内容，不确定处明确说明。Related Works 段落要能直接作为综述初稿，并包含作者/论文简称与相对既有工作的差异。\n\n可用分类：${categoryNames.join('、') || '暂无'}\n标题：${paper.title}\n作者：${(paper.authors || []).join(', ')}\n摘要：${paper.abstract}\n论文正文（可能截断）：\n${String(sourceText || '').slice(0, 90000)}`;
  return askAI(settings, apiKey, prompt, ANALYSIS_SCHEMA);
}

async function rankDailyPapers(settings, apiKey, papers, keywords, limit) {
  const candidates = papers.map((paper, index) => ({ index, id: paper.baseId, title: paper.title, abstract: paper.abstract.slice(0, 1800) }));
  const schema = { type: 'object', additionalProperties: false, properties: { picks: { type: 'array', maxItems: limit, items: { type: 'object', additionalProperties: false, properties: { index: { type: 'integer' }, score: { type: 'integer', minimum: 1, maximum: 10 }, reason: { type: 'string' } }, required: ['index', 'score', 'reason'] } } }, required: ['picks'] };
  const prompt = `你是研究论文编辑。根据关键词“${keywords}”，从候选 arXiv 论文中选出最多 ${limit} 篇最值得精读的论文。优先考虑方法新颖性、潜在影响、与关键词相关性和实验可信度；不要只按标题。输出按价值降序。\n${JSON.stringify(candidates)}`;
  return askAI(settings, apiKey, prompt, schema);
}

async function updateRelatedWorks(settings, apiKey, category, existing, newPapers) {
  const prompt = `请增量更新分类“${category.name}”的 Related Works。保留已有内容中仍正确的结构，把新增论文自然融入方法脉络；比较关键差异，避免逐篇流水账。使用 Markdown，包含简短总览和按方法组织的正文。\n\n已有总结：\n${existing || '暂无'}\n\n新增论文分析：\n${newPapers.map((item) => `${item.title}\n${item.analysis?.relatedWorks || item.abstract}`).join('\n\n')}`;
  return askAI(settings, apiKey, prompt);
}

async function generatePrincipleImage(settings, apiKey, paper, imagePrompt) {
  if (!apiKey) throw new Error('GPT Image 2 需要 OpenAI API Key；ChatGPT/Codex 账号模式仅用于文本分析');
  const baseUrl = String(settings.ai?.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: `为论文“${paper.title}”制作严谨的学术原理图。${imagePrompt}。白色背景，清晰流程箭头，简洁中文标注，不添加论文未声称的内容。`, size: '1536x1024', quality: 'medium', output_format: 'png' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `图片生成失败（HTTP ${response.status}）`);
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) throw new Error('GPT Image 2 没有返回图片');
  return Buffer.from(b64, 'base64');
}

module.exports = { ANALYSIS_SCHEMA, askAI, analyzePaper, rankDailyPapers, updateRelatedWorks, generatePrincipleImage };
