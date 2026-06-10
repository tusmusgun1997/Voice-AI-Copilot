import { DEFAULT_LOCAL_DATA_FILE, readCollection, writeCollection } from './localDataStore.js';
import { getCallOutcome } from './analysisOutcome.js';

const DEFAULT_RESULTS_FILE = DEFAULT_LOCAL_DATA_FILE;
let writeLock = Promise.resolve();

export async function listCallAnalyses(filePath = DEFAULT_RESULTS_FILE) {
  return readStore(filePath);
}

export async function getCallAnalysis(callId, filePath = DEFAULT_RESULTS_FILE) {
  if (!callId) return null;
  const analyses = await readStore(filePath);
  return analyses.find((analysis) => analysis.callId === callId) ?? null;
}

export async function upsertCallAnalysis(record, filePath = DEFAULT_RESULTS_FILE) {
  const nextRecord = normalizeRecord(record);

  writeLock = writeLock.then(async () => {
    const analyses = await readStore(filePath);
    const index = analyses.findIndex((analysis) => analysis.callId === nextRecord.callId);
    const current = index >= 0 ? analyses[index] : {};
    const merged = normalizeRecord({
      ...current,
      ...nextRecord,
      createdAt: current.createdAt || nextRecord.createdAt,
      updatedAt: new Date().toISOString()
    });

    const nextAnalyses = index >= 0
      ? analyses.map((analysis, itemIndex) => (itemIndex === index ? merged : analysis))
      : [...analyses, merged];

    await writeStore(nextAnalyses, filePath);
    return merged;
  });

  return writeLock;
}

export async function updateSystemImprovement(improvementId, patch = {}, filePath = DEFAULT_RESULTS_FILE) {
  const id = cleanString(improvementId);
  if (!id) return null;

  writeLock = writeLock.then(async () => {
    const analyses = await readStore(filePath);
    let updatedImprovement = null;
    const nextAnalyses = analyses.map((analysis) => {
      let didUpdateAnalysis = false;
      const improvements = (analysis.systemImprovements ?? []).map((improvement) => {
        if (improvement.id !== id && aggregateImprovementId(analysis, improvement) !== id) return improvement;

        didUpdateAnalysis = true;
        updatedImprovement = {
          ...improvement,
          status: cleanString(patch.status) || improvement.status || 'open',
          updatedAt: new Date().toISOString()
        };
        return updatedImprovement;
      });

      return {
        ...analysis,
        systemImprovements: improvements,
        updatedAt: didUpdateAnalysis ? new Date().toISOString() : analysis.updatedAt
      };
    });

    if (!updatedImprovement) return null;

    await writeStore(nextAnalyses, filePath);
    return updatedImprovement;
  });

  return writeLock;
}

export async function deleteSystemImprovement(improvementId, filePath = DEFAULT_RESULTS_FILE) {
  const id = cleanString(improvementId);
  if (!id) return false;

  writeLock = writeLock.then(async () => {
    const analyses = await readStore(filePath);
    let deleted = false;
    const nextAnalyses = analyses.map((analysis) => {
      const currentLength = (analysis.systemImprovements ?? []).length;
      const improvements = (analysis.systemImprovements ?? []).filter((improvement) => improvement.id !== id && aggregateImprovementId(analysis, improvement) !== id);
      if (improvements.length === currentLength) return analysis;

      deleted = true;
      return {
        ...analysis,
        systemImprovements: improvements,
        updatedAt: new Date().toISOString()
      };
    });

    if (!deleted) return false;

    await writeStore(nextAnalyses, filePath);
    return true;
  });

  return writeLock;
}

export async function updateHumanAction(actionId, patch = {}, filePath = DEFAULT_RESULTS_FILE) {
  return updateSystemImprovement(actionId, patch, filePath);
}

export async function deleteHumanAction(actionId, filePath = DEFAULT_RESULTS_FILE) {
  return deleteSystemImprovement(actionId, filePath);
}

async function readStore(filePath) {
  try {
    return (await readCollection(filePath, 'analyses')).map(normalizeRecord);
  } catch (error) {
    throw new Error(`Unable to load call analysis results: ${error.message}`);
  }
}

async function writeStore(analyses, filePath) {
  await writeCollection(filePath, 'analyses', analyses);
}

function normalizeRecord(record = {}) {
  const now = new Date().toISOString();
  const score = Number.isFinite(Number(record.score)) ? Number(record.score) : null;

  return {
    id: record.id || analysisId(record),
    jobId: cleanString(record.jobId),
    locationId: cleanString(record.locationId),
    agentId: cleanString(record.agentId),
    agentName: cleanString(record.agentName),
    callId: cleanString(record.callId),
    parameterVersionId: cleanString(record.parameterVersionId),
    callCreatedAt: cleanString(record.callCreatedAt),
    durationSeconds: Number.isFinite(Number(record.durationSeconds)) ? Number(record.durationSeconds) : null,
    status: cleanString(record.status) || 'queued',
    stage: cleanString(record.stage) || 'analysis_pending',
    score,
    outcome: cleanString(record.outcome) || getCallOutcome(score),
    summary: cleanString(record.summary),
    parameterResults: Array.isArray(record.parameterResults) ? record.parameterResults : [],
    recommendations: [],
    useActions: [],
    systemImprovements: normalizeSystemImprovements(record.systemImprovements ?? record.useActions, record),
    errorMessage: cleanString(record.errorMessage),
    model: cleanString(record.model),
    queuedReason: cleanString(record.queuedReason),
    attempts: Number.isFinite(Number(record.attempts)) ? Number(record.attempts) : 0,
    maxAttempts: Number.isFinite(Number(record.maxAttempts)) ? Number(record.maxAttempts) : null,
    nextRetryAt: record.nextRetryAt || null,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    analyzedAt: record.analyzedAt || null
  };
}

function normalizeSystemImprovements(items = [], analysis = {}) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => systemTargetType(item.targetType) !== 'human_follow_up')
    .map((item, index) => ({
      id: cleanString(item.id) || improvementId(analysis, item, index),
      agentId: cleanString(item.agentId || analysis.agentId),
      agentName: cleanString(item.agentName || analysis.agentName),
      title: cleanString(item.title || item.reason || 'System improvement'),
      type: cleanString(item.type || 'prompt_update'),
      reason: cleanString(item.reason),
      suggestion: cleanString(item.suggestion || item.suggestedChange),
      snippet: cleanString(item.snippet || item.evidence),
      severity: ['critical', 'warning', 'info'].includes(item.severity) ? item.severity : 'warning',
      parameterId: cleanString(item.parameterId),
      targetType: systemTargetType(item.targetType),
      targetId: cleanString(item.targetId || item.parameterId),
      sourceCallIds: normalizeSourceCallIds(item.sourceCallIds, item.callId || analysis.callId),
      status: cleanString(item.status) || 'open',
      createdAt: item.createdAt || analysis.analyzedAt || analysis.updatedAt || new Date().toISOString(),
      updatedAt: item.updatedAt || analysis.updatedAt || new Date().toISOString(),
      source: 'llm'
    }));
}

function normalizeSourceCallIds(sourceCallIds, fallbackCallId) {
  const ids = Array.isArray(sourceCallIds) ? sourceCallIds : [];
  const fallback = cleanString(fallbackCallId);
  return Array.from(new Set([...ids, fallback].map(cleanString).filter(Boolean)));
}

function systemTargetType(targetType) {
  if (['agent_profile', 'observability_parameter'].includes(targetType)) return targetType;
  return 'agent_profile';
}

function improvementId(analysis, item, index) {
  const agentId = cleanString(item.agentId || analysis.agentId) || 'agent';
  const parameterId = cleanString(item.parameterId || item.targetId) || `item-${index + 1}`;
  const type = cleanString(item.type) || 'prompt_update';
  return `improvement-${agentId}-${type}-${parameterId}`;
}

function analysisId(record) {
  const locationId = cleanString(record.locationId) || 'location';
  const callId = cleanString(record.callId) || `call-${Date.now()}`;
  return `analysis-${locationId}-${callId}`;
}

function aggregateImprovementId(analysis, improvement) {
  const key = [
    analysis.agentId || improvement.agentId || '',
    improvement.type || 'prompt_update',
    improvement.parameterId || '',
    improvement.targetType || 'agent_profile',
    improvement.targetId || improvement.parameterId || '',
    improvement.title || ''
  ].join('|');
  return `improvement-${slug(key)}`;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
