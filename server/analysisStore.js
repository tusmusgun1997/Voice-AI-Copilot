import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_RESULTS_FILE = 'data/call-analysis-results.json';
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

async function readStore(filePath) {
  const resolvedPath = resolveStorePath(filePath);

  try {
    const content = await fs.readFile(resolvedPath, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.map(normalizeRecord);
    if (Array.isArray(parsed?.analyses)) return parsed.analyses.map(normalizeRecord);
    return [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Unable to load call analysis results: ${error.message}`);
  }
}

async function writeStore(analyses, filePath) {
  const resolvedPath = resolveStorePath(filePath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, `${JSON.stringify({ analyses }, null, 2)}\n`, 'utf8');
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

function resolveStorePath(filePath = DEFAULT_RESULTS_FILE) {
  return path.resolve(process.cwd(), filePath || DEFAULT_RESULTS_FILE);
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
