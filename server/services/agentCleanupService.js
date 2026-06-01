import { listCallAnalyses } from '../analysisStore.js';
import { listSavedObservabilityProfiles } from '../observabilityProfiles.js';
import { writeCollection } from '../localDataStore.js';
import {
  cleanupSupabaseDeletedAgents,
  cleanupSupabaseAgentData,
  isSupabaseStoreEnabled
} from './supabaseStore.js';

export async function cleanupDeletedAgentData({ activeAgentIds = [], localDataFile, locationId, allowEmptyActiveSet = false } = {}) {
  const activeIds = new Set((activeAgentIds ?? []).filter(Boolean));
  if (activeIds.size === 0 && !allowEmptyActiveSet) return { deletedAgentIds: [], deletedCount: 0 };

  if (isSupabaseStoreEnabled()) {
    return cleanupSupabaseDeletedAgents({ activeAgentIds: Array.from(activeIds), locationId, allowEmptyActiveSet });
  }

  const [{ profiles }, analyses] = await Promise.all([
    listSavedObservabilityProfiles(localDataFile),
    listCallAnalyses(localDataFile)
  ]);

  const profileAgentIds = profiles.flatMap((profile) => profile.agentIds ?? []);
  const analysisAgentIds = analyses.map((analysis) => analysis.agentId).filter(Boolean);
  const knownAgentIds = Array.from(new Set([...profileAgentIds, ...analysisAgentIds]));
  const deletedAgentIds = knownAgentIds.filter((agentId) => !activeIds.has(agentId));

  if (deletedAgentIds.length === 0) {
    return { deletedAgentIds: [], deletedCount: 0 };
  }

  const deletedSet = new Set(deletedAgentIds);
  const nextProfiles = profiles.filter((profile) => !(profile.agentIds ?? []).some((agentId) => deletedSet.has(agentId)));
  const nextAnalyses = analyses.filter((analysis) => !deletedSet.has(analysis.agentId));

  await Promise.all([
    writeCollection(localDataFile, 'profiles', nextProfiles),
    writeCollection(localDataFile, 'analyses', nextAnalyses)
  ]);

  return {
    deletedAgentIds,
    deletedCount: deletedAgentIds.length
  };
}

export async function cleanupAgentData(agentId, { localDataFile, locationId } = {}) {
  if (!agentId) return { deletedAgentIds: [], deletedCount: 0 };

  if (isSupabaseStoreEnabled()) {
    return cleanupSupabaseAgentData({ agentId, locationId });
  }

  const [{ profiles }, analyses] = await Promise.all([
    listSavedObservabilityProfiles(localDataFile),
    listCallAnalyses(localDataFile)
  ]);

  const nextProfiles = profiles.filter((profile) => !(profile.agentIds ?? []).includes(agentId));
  const nextAnalyses = analyses.filter((analysis) => analysis.agentId !== agentId);

  await Promise.all([
    writeCollection(localDataFile, 'profiles', nextProfiles),
    writeCollection(localDataFile, 'analyses', nextAnalyses)
  ]);

  return {
    deletedAgentIds: [agentId],
    deletedCount: Number(nextProfiles.length !== profiles.length || nextAnalyses.length !== analyses.length)
  };
}
