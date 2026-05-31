import { defaultGoalProfile } from './agentGoals.js';
import { DEFAULT_LOCAL_DATA_FILE, readCollection, writeCollection } from './localDataStore.js';
import { getParameterVersion } from './parameterVersions.js';

const DEFAULT_PROFILES_FILE = DEFAULT_LOCAL_DATA_FILE;
const DEFAULT_VERSIONS_FILE = DEFAULT_LOCAL_DATA_FILE;

export async function loadObservabilityProfiles(filePath = DEFAULT_PROFILES_FILE, versionsFilePath = DEFAULT_VERSIONS_FILE) {
  const customProfiles = await readProfiles(filePath);
  const resolvedProfiles = await Promise.all(
    customProfiles.map((profile) => resolveVersionedProfile(normalizeProfile(profile, { useDefaults: false }), versionsFilePath))
  );
  const profiles = [defaultGoalProfile, ...resolvedProfiles];

  return {
    profiles,
    defaultProfile: defaultGoalProfile
  };
}

export async function listSavedObservabilityProfiles(filePath = DEFAULT_PROFILES_FILE) {
  return {
    profiles: (await readProfiles(filePath)).map((profile) => normalizeProfile(profile, { useDefaults: false }))
  };
}

export async function getAgentObservabilityProfile(
  agent,
  filePath = DEFAULT_PROFILES_FILE,
  versionsFilePath = DEFAULT_VERSIONS_FILE
) {
  const profiles = (await readProfiles(filePath)).map((profile) => normalizeProfile(profile, { useDefaults: false }));
  const existing = findProfileForAgent(profiles, agent);
  return resolveVersionedProfile(existing ?? createEmptyAgentProfile(agent), versionsFilePath);
}

export async function saveAgentObservabilityProfile(
  agentId,
  profile,
  filePath = DEFAULT_PROFILES_FILE,
  versionsFilePath = DEFAULT_VERSIONS_FILE
) {
  if (!agentId) {
    const error = new Error('Missing agentId');
    error.status = 400;
    throw error;
  }

  const profiles = await readProfiles(filePath);
  const normalized = normalizeProfile(
    {
      ...profile,
      id: profile?.id || `profile-${agentId}`,
      agentIds: unique([agentId, ...(profile?.agentIds ?? [])])
    },
    { useDefaults: false }
  );
  const nextProfiles = profiles.filter((item) => !(item.agentIds ?? []).includes(agentId));
  nextProfiles.push(toStorageProfile(normalized));
  await writeProfiles(nextProfiles, filePath);
  return resolveVersionedProfile(normalized, versionsFilePath);
}

function createEmptyAgentProfile(agent = {}) {
  const displayName = agent.displayName || agent.name || agent.agentName || 'Voice AI Agent';

  return normalizeProfile({
    id: `profile-${agent.id || slug(displayName)}`,
    name: '',
    agentIds: agent.id ? [agent.id] : [],
    agentNames: [displayName].filter(Boolean),
    scriptSummary: '',
    goals: [],
    negativeSignals: [],
    parameterVersionId: '',
    parameterVersionName: '',
    parameters: [],
    criteria: []
  }, { useDefaults: false });
}

function findProfileForAgent(profiles, agent = {}) {
  return profiles.find((profile) => {
    const agentIds = profile.agentIds ?? [];
    const agentNames = profile.agentNames ?? [];
    return (agent.id && agentIds.includes(agent.id)) || (agent.name && agentNames.includes(agent.name));
  });
}

async function readProfiles(filePath) {
  try {
    return readCollection(filePath, 'profiles');
  } catch (error) {
    throw new Error(`Unable to load observability profiles: ${error.message}`);
  }
}

async function writeProfiles(profiles, filePath) {
  await writeCollection(filePath, 'profiles', profiles);
}

function normalizeProfile(profile = {}, options = {}) {
  const useDefaults = options.useDefaults !== false;
  const parameters = normalizeParameters(profile.parameters ?? criteriaToParameters(profile.criteria));
  const criteria = normalizeCriteria(profile.criteria, { useDefaults, parameters });

  return {
    id: profile.id || slug(profile.name || 'agent-observability-profile'),
    name: cleanString(profile.name) || (useDefaults ? 'Agent Observability Profile' : ''),
    agentIds: unique(asStringArray(profile.agentIds)),
    agentNames: unique(asStringArray(profile.agentNames)),
    scriptSummary: cleanString(profile.scriptSummary) || (useDefaults ? defaultGoalProfile.scriptSummary : ''),
    goals: asStringArray(profile.goals),
    negativeSignals: asStringArray(profile.negativeSignals),
    parameterVersionId: cleanString(profile.parameterVersionId),
    parameterVersionName: cleanString(profile.parameterVersionName),
    parameterVersionDescription: cleanString(profile.parameterVersionDescription),
    parameters,
    criteria,
    configured: Boolean(profile.configured ?? isProfileConfigured({ ...profile, parameters, criteria }))
  };
}

async function resolveVersionedProfile(profile, versionsFilePath) {
  if (!profile?.parameterVersionId) return profile;

  const version = await getParameterVersion(profile.parameterVersionId, versionsFilePath);
  if (!version) return profile;

  return normalizeProfile(
    {
      ...profile,
      parameterVersionName: `${version.name} ${version.versionLabel}`.trim(),
      parameterVersionDescription: version.description,
      parameters: version.parameters,
      criteria: []
    },
    { useDefaults: false }
  );
}

function normalizeCriteria(criteria, options = {}) {
  const source = Array.isArray(criteria) && criteria.length > 0
    ? criteria
    : options.parameters.length > 0
      ? parametersToCriteria(options.parameters)
      : options.useDefaults
        ? defaultGoalProfile.criteria
        : [];

  return source.map((criterion, index) => {
    const fallback = defaultGoalProfile.criteria.find((item) => item.id === criterion.id) ?? {};
    const id = cleanString(criterion.id) || slug(criterion.label || `criterion-${index + 1}`);

    return {
      ...fallback,
      ...criterion,
      id,
      label: cleanString(criterion.label) || fallback.label || `Criterion ${index + 1}`,
      category: cleanString(criterion.category || fallback.category) || id,
      weight: clampNumber(criterion.weight, fallback.weight ?? derivedCriterionWeight(source.length), 0, 50),
      expectedBehavior: cleanString(criterion.expectedBehavior),
      failureBehavior: cleanString(criterion.failureBehavior),
      llmDescription: cleanString(criterion.llmDescription || criterion.description),
      keywordsAny: asStringArray(criterion.keywordsAny),
      requiredWhenAny: asStringArray(criterion.requiredWhenAny),
      passWhenAny: asStringArray(criterion.passWhenAny),
      issue: cleanString(criterion.issue) || fallback.issue || `${criterion.label || id} did not pass.`,
      recommendation:
        cleanString(criterion.recommendation) ||
        fallback.recommendation ||
        'Review the script and add clearer guidance for this behavior.',
      promptPatch: cleanString(criterion.promptPatch || fallback.promptPatch),
      useActionType: cleanString(criterion.useActionType || fallback.useActionType),
      allowExecutedAction: Boolean(criterion.allowExecutedAction ?? fallback.allowExecutedAction)
    };
  });
}

function normalizeParameters(parameters) {
  if (!Array.isArray(parameters)) return [];

  return parameters
    .map((parameter, index) => {
      const title = cleanString(parameter.title || parameter.label);
      const description = cleanString(parameter.description || parameter.llmDescription || parameter.expectedBehavior);

      return {
        id: cleanString(parameter.id) || slug(title || `parameter-${index + 1}`),
        title,
        description,
        category: cleanString(parameter.category || 'custom'),
        successSignals: asStringArray(parameter.successSignals ?? parameter.keywordsAny ?? parameter.passWhenAny),
        failureSignals: asStringArray(parameter.failureSignals ?? parameter.requiredWhenAny),
        recommendation: cleanString(parameter.recommendation),
        promptGuidance: cleanString(parameter.promptGuidance || parameter.promptPatch),
        requiresHumanReview: Boolean(parameter.requiresHumanReview),
        useActionType: cleanString(parameter.useActionType),
        enabled: parameter.enabled !== false
      };
    })
    .filter((parameter) => parameter.title || parameter.description);
}

function criteriaToParameters(criteria) {
  if (!Array.isArray(criteria)) return [];

  return criteria.map((criterion) => ({
    id: criterion.id,
    title: criterion.label,
    description: criterion.llmDescription || criterion.expectedBehavior || criterion.issue,
    category: criterion.category,
    successSignals: criterion.keywordsAny ?? criterion.passWhenAny ?? [],
    failureSignals: criterion.requiredWhenAny ?? [],
    recommendation: criterion.recommendation,
    promptGuidance: criterion.promptPatch,
    requiresHumanReview: Boolean(criterion.useActionType),
    useActionType: criterion.useActionType,
    enabled: true
  }));
}

function parametersToCriteria(parameters) {
  const enabledParameters = parameters.filter((parameter) => parameter.enabled !== false);
  const weight = derivedCriterionWeight(enabledParameters.length);

  return enabledParameters.map((parameter, index) => ({
    id: parameter.id || slug(parameter.title || `parameter-${index + 1}`),
    label: parameter.title || `Parameter ${index + 1}`,
    category: parameter.category || 'custom',
    weight,
    expectedBehavior: parameter.description,
    failureBehavior: parameter.failureSignals.join(', '),
    llmDescription: parameter.description,
    keywordsAny: parameter.successSignals,
    requiredWhenAny: parameter.failureSignals,
    passWhenAny: parameter.successSignals,
    issue: `${parameter.title || 'Parameter'} was not satisfied.`,
    recommendation: parameter.recommendation || 'Review this behavior and update the agent instructions.',
    promptPatch: parameter.promptGuidance,
    useActionType: parameter.requiresHumanReview ? parameter.useActionType || 'Human review' : '',
    allowExecutedAction: false
  }));
}

function derivedCriterionWeight(count) {
  if (!count) return 0;
  return Math.max(1, Math.round(90 / count));
}

function isProfileConfigured(profile) {
  return Boolean(
    cleanString(profile.name) ||
      cleanString(profile.scriptSummary) ||
      asStringArray(profile.goals).length > 0 ||
      asStringArray(profile.negativeSignals).length > 0 ||
      (Array.isArray(profile.parameters) && profile.parameters.length > 0) ||
      (Array.isArray(profile.criteria) && profile.criteria.length > 0)
  );
}

function toStorageProfile(profile) {
  const { criteria, ...storageProfile } = profile;
  return storageProfile;
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|,/)
      .map(cleanString)
      .filter(Boolean);
  }

  return [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
