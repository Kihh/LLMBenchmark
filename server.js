const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { MODELS_URL, CATALOG_URL, buildSnapshot } = require('./benchmarks');

const app = express();
const PORT = process.env.PORT || 6066;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'benchmarks.json');

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return null; }
}

let refreshing;
function refreshData() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const previous = readCache();
    let output;
    try {
      const [models, catalog] = await Promise.all([fetchJson(MODELS_URL), fetchJson(CATALOG_URL)]);
      output = buildSnapshot(models, catalog, previous);
    } catch (error) {
      console.error(`Refresh failed: ${error.message}`);
      output = buildSnapshot(null, null, previous);
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temporary = `${DATA_FILE}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(output, null, 2));
    fs.renameSync(temporary, DATA_FILE);
    console.log(`[${output.refreshedAt}] Refreshed ${output.benchmarks.filter(item => item.status === 'live').length}/${output.benchmarks.length} benchmarks`);
    return output;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.post('/api/data', (req, res) => {
  const cached = readCache();
  if (cached?.schemaVersion !== 2) return res.status(503).json({ error: 'Data not ready' });
  res.set('Cache-Control', 'no-store').json(cached);
});
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

if (require.main === module) {
  cron.schedule('0 9 * * *', () => refreshData().catch(console.error), { timezone: 'Asia/Shanghai' });
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    refreshData().catch(console.error);
  });
}
module.exports = { app, refreshData };
