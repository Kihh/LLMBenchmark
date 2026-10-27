// Versions and evaluation settings stay separate. Order within a tier is curated.
const BENCHMARKS = [
  ['terminalBench4', 'agentic', 'Terminal-Bench 4.0', 'frontier', '新版终端任务，评估多步骤执行与错误恢复'],
  ['deepSwe', 'coding', 'DeepSWE', 'frontier', '长流程真实软件工程任务，评估代码理解与问题修复能力'],
  ['arcAgi3', 'reasoning', 'ARC-AGI-3', 'frontier', '通过交互探索陌生环境，衡量学习、规划与适应能力'],
  ['frontierMathV2Tier4', 'math', 'FrontierMath v2 (Tier 4)', 'frontier', '研究级数学难题，评估复杂数学推理能力'],
  ['hleNoTools', 'knowledge', "Humanity's Last Exam (无工具)", 'frontier', '跨学科专家难题，评估无工具条件下的知识与推理能力'],
  ['hleWithTools', 'agentic', "Humanity's Last Exam (有工具)", 'frontier', '借助工具完成跨学科专家难题'],
  ['browseComp', 'agentic', 'BrowseComp', 'frontier', '需要网络检索与证据综合的困难事实问题'],
  ['osWorld21', 'agentic', 'OSWorld 2.1', 'frontier', '桌面环境中的交互操作任务'],
  ['toolathlonVerified', 'agentic', 'Toolathlon-Verified', 'frontier', '跨工具、多步骤任务执行与结果验证'],
  ['frontierMathV2Tiers13', 'math', 'FrontierMath v2 (Tiers 1–3)', 'specialist', '进阶数学问题，评估多步骤数学推理能力'],
  ['swePro', 'coding', 'SWE-bench Pro', 'specialist', '复杂代码仓库中的软件工程任务'],
  ['liveCodeBench', 'coding', 'LiveCodeBench', 'specialist', '持续更新题目的编程能力评测'],
  ['mcpAtlas', 'agentic', 'MCP Atlas', 'specialist', '多工具调用与任务协作'],
  ['gdpvalAaNormalized', 'agentic', 'GDPval-AA (归一化)', 'specialist', '评估专业工作任务的完成能力'],
  ['officeQaPro', 'multimodalGrounded', 'OfficeQA Pro', 'specialist', '办公文档、表格与图表的有据问答'],
  ['aaMmmuPro', 'multimodalGrounded', 'MMMU-Pro (AA)', 'specialist', '高难度图文理解与多模态推理'],
  ['aaSciCode', 'coding', 'SciCode (AA)', 'specialist', '结合科研知识与代码能力的科学计算编程'],
  ['ifBench', 'instructionFollowing', 'IFBench', 'specialist', '复杂指令、格式约束与细节遵循'],
].map(([key, category, label, tier, description]) => ({ key, category, label, tier, description }));

const MODELS_URL = 'https://benchlm.ai/data/models.json';
const CATALOG_URL = 'https://benchlm.ai/data/benchmarks.json';
const TIER_ORDER = { overview: 0, frontier: 1, specialist: 2 };

function isScore(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function rankedRows(items, scoreOf) {
  return items.flatMap(item => {
    const score = scoreOf(item);
    return typeof item.model === 'string' && item.model.trim() && isScore(score)
      ? [[item.model, score]] : [];
  }).sort((a, b) => b[1] - a[1]).slice(0, 15);
}

function buildSnapshot(source, catalog, previous = null, now = new Date().toISOString()) {
  if (source && (!Array.isArray(source.items) || !source.items.length)) throw new Error('Invalid model export');
  if (source && (!Array.isArray(catalog?.items) || !catalog.items.length)) throw new Error('Invalid benchmark export');
  // Older caches contain category composites and invented fallbacks: do not migrate scores.
  const trustedPrevious = previous?.schemaVersion === 2 ? previous : null;
  const categories = {};
  const benchmarks = [];
  const definitions = [{ key: 'overall', label: 'Overall', tier: 'overview', description: '综合加权评分，覆盖全部基准' }, ...BENCHMARKS];
  for (const definition of definitions) {
    const overall = definition.key === 'overall';
    const upstream = catalog?.items.find(item => item.benchmarkKey === definition.key && item.category === definition.category);
    const rows = source ? rankedRows(source.items, item => overall
      ? (item.rankingEligible === true ? item.displayScore : null)
      : item.benchmarks?.[definition.category]?.[definition.key]) : [];
    const old = trustedPrevious?.benchmarks?.find(item => item.key === definition.key);
    const cached = trustedPrevious?.categories?.[definition.label];
    const models = rows.length ? rows : (Array.isArray(cached) ? cached : []);
    const top = models.slice(0, 5).map(row => row[1]);
    const clustered = !overall && top.length === 5 && top[4] >= 90 && top[0] - top[4] <= 5;
    if (clustered) continue;
    categories[definition.label] = models;
    benchmarks.push({
      ...definition, clustered,
      status: rows.length ? 'live' : (models.length ? 'cached' : 'unavailable'),
      fetchedAt: rows.length ? now : (old?.fetchedAt || null),
      sourceUpdatedAt: rows.length ? source.sourceLastUpdated || null : old?.sourceUpdatedAt || null,
      sourceUrl: overall ? 'https://benchlm.ai' : upstream?.url || old?.sourceUrl || 'https://benchlm.ai/benchmarks',
      metric: overall ? '综合分' : upstream?.format || old?.metric || '来源原始分数',
      unit: '分',
    });
  }
  benchmarks.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  return {
    schemaVersion: 2, refreshedAt: now,
    updatedAt: benchmarks.some(item => item.status === 'live') ? now : trustedPrevious?.updatedAt || null,
    source: { name: 'BenchLM.ai', url: 'https://benchlm.ai/data', license: source?.license || 'CC BY-NC 4.0' },
    benchmarks, categories,
  };
}

module.exports = { BENCHMARKS, MODELS_URL, CATALOG_URL, buildSnapshot };
