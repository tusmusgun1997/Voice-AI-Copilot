import { DEFAULT_LOCAL_DATA_FILE, readCollection, writeCollection } from './localDataStore.js';

const DEFAULT_RESULTS_FILE = DEFAULT_LOCAL_DATA_FILE;
let writeLock = Promise.resolve();

export async function listCallAnalyses(filePath = DEFAULT_RESULTS_FILE, locationId) {
  return readStore(filePath, locationId);
}

export async function getCallAnalysis(callId, filePath = DEFAULT_RESULTS_FILE, locationId) {
  if (!callId) return null;
  const analyses = await readStore(filePath, locationId);
  return analyses.find((analysis) => analysis.callId === callId) ?? null;
}

export async function upsertCallAnalysis(record, filePath = DEFAULT_RESULTS_FILE) {
  const nextRecord = normalizeRecord(record);
  const locationId = nextRecord.locationId;

  writeLock = writeLock.then(async () => {
    const analyses = await readStore(filePath, locationId);
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

    await writeStore(nextAnalyses, filePath, locationId);
    return merged;
  });

  return writeLock;
}

export async function updateHumanAction(actionId, patch = {}, filePath = DEFAULT_RESULTS_FILE, locationId) {
  const id = cleanString(actionId);
  if (!id) return null;

  writeLock = writeLock.then(async () => {
    const analyses = await readStore(filePath, locationId);
    let updatedAction = null;
    const nextAnalyses = analyses.map((analysis) => {
      let didUpdateAnalysis = false;
      const actions = (analysis.useActions ?? []).map((action) => {
        if (action.id !== id) return action;

        didUpdateAnalysis = true;
        updatedAction = {
          ...action,
          status: cleanString(patch.status) || action.status || 'open',
          updatedAt: new Date().toISOString()
        };
        return updatedAction;
      });

      return {
        ...analysis,
        useActions: actions,
        updatedAt: didUpdateAnalysis ? new Date().toISOString() : analysis.updatedAt
      };
    });

    if (!updatedAction) return null;

    await writeStore(nextAnalyses, filePath, locationId);
    return updatedAction;
  });

  return writeLock;
}

export async function deleteHumanAction(actionId, filePath = DEFAULT_RESULTS_FILE, locationId) {
  const id = cleanString(actionId);
  if (!id) return false;

  writeLock = writeLock.then(async () => {
    const analyses = await readStore(filePath, locationId);
    let deleted = false;
    const nextAnalyses = analyses.map((analysis) => {
      const currentLength = (analysis.useActions ?? []).length;
      const actions = (analysis.useActions ?? []).filter((action) => action.id !== id);
      if (actions.length === currentLength) return analysis;

      deleted = true;
      return {
        ...analysis,
        useActions: actions,
        updatedAt: new Date().toISOString()
      };
    });

    if (!deleted) return false;

    await writeStore(nextAnalyses, filePath, locationId);
    return true;
  });

  return writeLock;
}

async function readStore(filePath, locationId) {
  try {
    return (await readCollection(filePath, 'analyses', locationId)).map(normalizeRecord);
  } catch (error) {
    throw new Error(`Unable to load call analysis results: ${error.message}`);
  }
}

async function writeStore(analyses, filePath, locationId) {
  await writeCollection(filePath, 'analyses', analyses, locationId);
}

function normalizeRecord(record = {}) {
  const now = new Date().toISOString();

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
    score: Number.isFinite(Number(record.score)) ? Number(record.score) : null,
    summary: cleanString(record.summary),
    parameterResults: Array.isArray(record.parameterResults) ? record.parameterResults : [],
    recommendations: Array.isArray(record.recommendations) ? record.recommendations : [],
    useActions: Array.isArray(record.useActions) ? record.useActions : [],
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

function analysisId(record) {
  const locationId = cleanString(record.locationId) || 'location';
  const callId = cleanString(record.callId) || `call-${Date.now()}`;
  return `analysis-${locationId}-${callId}`;
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
