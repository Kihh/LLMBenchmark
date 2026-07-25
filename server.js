const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 6066;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'benchmarks.json');

const BENCHLM_CATS = [
  { cat: '', label: 'Overall' },
  { cat: 'coding', label: 'SWE-bench Verified' },
  { cat: 'agentic', label: 'Terminal-Bench' },
  { cat: 'knowledge', label: 'MMLU-Pro' },
  { cat: 'multimodalGrounded', label: 'MMMU' },
  { cat: 'instructionFollowing', label: 'IFBench' },
];

const MIN_MODELS = 3;

async function fetchBenchLM(cat) {
  const url = cat
    ? `https://benchlm.ai/api/data/leaderboard?category=${cat}&limit=15`
    : `https://benchlm.ai/api/data/leaderboard?limit=15`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const d = await resp.json();
  if (!d.models || d.models.length < MIN_MODELS) throw new Error('only ' + d.models?.length);
  return d.models.filter(m => m.overallScore > 0).map(m => [m.model, m.overallScore]);
}

function getFallbackData() {
  return {
    'Overall': { models: [
      ['GPT-5.6 Sol', 82.1], ['Claude Fable 5', 80.5], ['Kimi K3', 79.8],
      ['Gemini 3.1 Pro', 78.6], ['GPT-5.5', 77.9], ['Claude Opus 5', 77.2],
      ['Grok 4.5', 75.8], ['DeepSeek V3.2', 74.3], ['GLM-5.2', 73.1],
      ['Claude Opus 4.8', 71.5], ['Qwen3.7 Max', 70.2], ['MiniMax M3', 68.9],
      ['Llama 4 Scout', 67.4], ['Gemini 3 Flash', 65.8], ['GPT-5.2', 64.1],
    ]},
    'SWE-bench Verified': { models: [
      ['GPT-5.6 Sol', 72.5], ['Claude Fable 5', 71.8], ['Kimi K3', 69.2],
      ['GPT-5.5', 67.8], ['Gemini 3.1 Pro', 66.1], ['Claude Opus 5', 64.9],
      ['Grok 4.5', 63.2], ['DeepSeek V3.2', 61.5], ['GLM-5.2', 59.8],
      ['Claude Opus 4.8', 58.1], ['Qwen3.7 Max', 56.4], ['MiniMax M3', 54.7],
      ['Llama 4 Scout', 53.0], ['Gemini 3 Flash', 51.3], ['GPT-5.2', 49.6],
    ]},
    'Terminal-Bench': { models: [
      ['GPT-5.6 Sol', 65.9], ['Claude Fable 5', 62.9], ['GPT-5.5', 60.6],
      ['Claude Opus 4.8', 58.3], ['Kimi K3', 56.1], ['Gemini 3.1 Pro', 54.8],
      ['Grok 4.5', 53.2], ['DeepSeek V3.2', 51.7], ['GLM-5.2', 50.3],
      ['Claude Opus 5', 49.8], ['Qwen3.7 Max', 48.2], ['MiniMax M3', 46.8],
      ['Llama 4 Scout', 45.1], ['Gemini 3 Flash', 43.6], ['GPT-5.2', 42.0],
    ]},
    'SciCode': { models: [
      ['Claude Fable 5', 60.2], ['Gemini 3.1 Pro', 58.9], ['Kimi K3', 58.7],
      ['GPT-5.4', 56.6], ['Claude Opus 5', 55.3], ['GPT-5.6 Sol', 54.1], ['Grok 4.5', 52.8],
      ['DeepSeek V3.2', 51.5], ['GLM-5.2', 50.2], ['Gemini 3 Flash', 49.0],
      ['Qwen3.7 Max', 47.8], ['MiniMax M3', 46.5], ['Claude Opus 4.8', 45.2],
      ['Llama 4 Scout', 43.9], ['GPT-5.2', 42.6],
    ]},
    'OfficeQA Pro': { models: [
      ['Claude Opus 5', 66.9], ['Claude Opus 4.8', 66.2], ['Kimi K3', 63.3],
      ['Claude Fable 5', 57.9], ['GPT-5.5', 54.1], ['GPT-5.4', 53.2],
      ['MiniMax M3', 45.1], ['Claude Opus 4.7', 43.6],
    ]},
    'MMMU': { models: [
      ['Gemini 3.1 Pro', 83.8], ['GPT-5.5', 83.0], ['Gemini 3.5 Flash', 83.0],
      ['Gemini 3 Flash Preview', 82.8], ['Claude Opus 5', 82.1], ['Kimi K3', 81.5],
      ['GPT-5.6 Sol', 80.8], ['Grok 4.5', 80.1], ['DeepSeek V3.2', 79.4],
      ['GLM-5.2', 78.7], ['Qwen3.7 Max', 78.0], ['MiniMax M3', 77.3],
      ['Claude Opus 4.8', 76.6], ['Llama 4 Scout', 75.8], ['Gemini 3 Flash', 75.1],
    ]},
    'IFBench': { models: [
      ['MiniMax M3', 82.9], ['Nemotron 3 Ultra 550B', 81.4], ['Qwen3.7 Max', 80.5],
      ['MiMo v2.5 Pro', 79.9], ['Claude Opus 5', 79.2], ['GPT-5.6 Sol', 78.6],
      ['Gemini 3.1 Pro', 77.9], ['Kimi K3', 77.2], ['Grok 4.5', 76.5],
      ['DeepSeek V3.2', 75.8], ['GLM-5.2', 75.1], ['Claude Fable 5', 74.4],
      ['Llama 4 Scout', 73.6], ['MiniMax M2.5', 72.9], ['Gemini 3 Flash', 72.1],
    ]},
  };
}

async function refreshData() {
  console.log(`[${new Date().toISOString()}] Refreshing data...`);

  const resultMap = {};

  const results = await Promise.allSettled(
    BENCHLM_CATS.map(async bc => {
      try {
        const models = await fetchBenchLM(bc.cat);
        return { label: bc.label, models };
      } catch (e) {
        return null;
      }
    })
  );

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      resultMap[r.value.label] = r.value.models;
    }
  });

  // Fill missing categories with fallback
  const fallback = getFallbackData();
  let fallbackUsed = 0;
  for (const [label, data] of Object.entries(fallback)) {
    if (!resultMap[label]) {
      resultMap[label] = data.models;
      fallbackUsed++;
    }
  }

  const output = {
    updatedAt: new Date().toISOString(),
    categories: resultMap,
  };

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));

  const successCount = Object.keys(resultMap).length - fallbackUsed;
  console.log(`[${new Date().toISOString()}] Data refreshed: ${successCount} from API, ${fallbackUsed} from fallback`);
}

// Serve static files
app.use(express.static(__dirname));

// API endpoint (POST only)
app.post('/api/data', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  res.sendFile(DATA_FILE);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Cron: 9 AM Beijing time (UTC+8) = 1 AM UTC
cron.schedule('0 1 * * *', refreshData, {
  timezone: 'Asia/Shanghai',
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Fetch data on startup if not exists
  if (!fs.existsSync(DATA_FILE)) {
    console.log('No data file found, fetching initial data...');
    await refreshData();
  }
});
