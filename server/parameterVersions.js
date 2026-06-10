import { DEFAULT_LOCAL_DATA_FILE, readCollection, writeCollection } from './localDataStore.js';

const DEFAULT_VERSIONS_FILE = DEFAULT_LOCAL_DATA_FILE;

const defaultParameters = [
  {
    id: 'project-need-captured',
    title: 'Project or issue need captured',
    description:
      'Evaluate whether the agent clearly identified why the caller contacted the business and captured the core project, service need, or issue in enough detail for a human team member to act.',
    category: 'qualification',
    successSignals: ['need', 'issue', 'project', 'looking for', 'interested in', 'problem'],
    failureSignals: ['not sure why they called', 'no issue captured', 'unclear request'],
    recommendation:
      'Update the agent objective or script to ask one direct question about the caller need before moving to next steps.',
    promptGuidance:
      'Ask: "What would you like help with today?" Then summarize the need back in one short sentence.',
    requiresHumanReview: false,
    useActionType: '',
    enabled: true
  },
  {
    id: 'contact-details-captured',
    title: 'Contact details captured',
    description:
      'Evaluate whether the agent captured the caller name and at least one usable contact method or confirmed that HighLevel already has enough contact information.',
    category: 'intake',
    successSignals: ['name', 'phone', 'email', 'contact', 'spell'],
    failureSignals: ['no name', 'no contact', 'cannot call back'],
    recommendation:
      'Add an explicit contact capture step before the call closes, including name confirmation when needed.',
    promptGuidance:
      'Before ending the call, confirm the caller name and the best callback number or email.',
    requiresHumanReview: true,
    useActionType: 'Contact follow-up',
    enabled: true
  },
  {
    id: 'timeline-urgency-qualified',
    title: 'Timeline and urgency qualified',
    description:
      'Evaluate whether the agent asked when the caller needs help, whether the request is urgent, or whether there is a preferred callback/service timeline.',
    category: 'qualification',
    successSignals: ['today', 'tomorrow', 'this week', 'next week', 'urgent', 'timeline', 'when'],
    failureSignals: ['no timeline', 'unclear urgency', 'call back sometime'],
    recommendation:
      'Coach the agent to ask one timing question so the team can prioritize the lead or support request.',
    promptGuidance:
      'Ask: "When are you hoping to get this handled?" or "Is this urgent or flexible?"',
    requiresHumanReview: false,
    useActionType: '',
    enabled: true
  },
  {
    id: 'next-step-confirmed',
    title: 'Clear next step confirmed',
    description:
      'Evaluate whether the agent ended with a concrete next step, such as a callback owner, appointment, expected follow-up window, or human handoff.',
    category: 'handoff',
    successSignals: ['call you back', 'follow up', 'appointment', 'scheduled', 'team member', 'next step'],
    failureSignals: ['no next step', 'ended abruptly', 'unclear follow-up'],
    recommendation:
      'Update the script so every successful intake call closes with who will follow up and when.',
    promptGuidance:
      'End with: "A team member will follow up [timeframe] about [caller need]."',
    requiresHumanReview: true,
    useActionType: 'Follow-up review',
    enabled: true
  },
  {
    id: 'caller-risk-or-friction-detected',
    title: 'Caller risk or friction handled',
    description:
      'Evaluate whether the agent noticed and responded appropriately to frustration, confusion, repeated objections, pricing pressure, callback demands, or requests needing human intervention.',
    category: 'risk',
    successSignals: ['I understand', 'team member', 'human', 'call back', 'help you with that'],
    failureSignals: ['frustrated', 'angry', 'confused', 'pricing', 'complaint', 'call me back'],
    recommendation:
      'Add a recovery branch for frustrated or high-intent callers so the agent acknowledges the concern and routes it to a human.',
    promptGuidance:
      'If the caller sounds frustrated, asks for pricing, or requests a human, acknowledge it and create a clear callback/handoff.',
    requiresHumanReview: true,
    useActionType: 'Human review',
    enabled: true
  }
];

export const defaultParameterVersion = {
  id: 'default-lead-qualification-v1',
  name: 'Default lead qualification',
  versionLabel: 'v1',
  description:
    'A reusable starter checklist for judging whether a Voice AI agent captured the caller need, contact details, urgency, next step, and human-review signals.',
  locked: true,
  source: 'system',
  parameters: defaultParameters,
  createdAt: '2026-05-31T00:00:00.000Z',
  updatedAt: '2026-05-31T00:00:00.000Z'
};

export const defaultParameterTemplates = [
  defaultParameterVersion,
  {
    id: 'default-support-intake-v1',
    name: 'Default support intake',
    versionLabel: 'v1',
    description:
      'A starter checklist for support agents that need to capture identity, issue summary, urgency, expectation setting, and escalation signals.',
    locked: true,
    source: 'system',
    parameters: [
      defaultParameters[1],
      {
        ...defaultParameters[0],
        id: 'support-issue-summarized',
        title: 'Support issue summarized',
        description:
          'Evaluate whether the agent summarized the caller issue in a way a support team member can understand without rereading the full transcript.'
      },
      defaultParameters[2],
      defaultParameters[3],
      defaultParameters[4]
    ],
    createdAt: '2026-05-31T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z'
  }
];

export async function listParameterVersions(filePath = DEFAULT_VERSIONS_FILE) {
  const customVersions = await readVersions(filePath);
  const versions = [
    defaultParameterVersion,
    ...customVersions.map((version) => normalizeVersion(version, { locked: false }))
  ];

  return {
    versions,
    defaultVersion: defaultParameterVersion,
    templates: defaultParameterTemplates
  };
}

export async function getParameterVersion(versionId, filePath = DEFAULT_VERSIONS_FILE) {
  const { versions } = await listParameterVersions(filePath);
  return versions.find((version) => version.id === versionId) ?? null;
}

export async function createParameterVersion(input = {}, filePath = DEFAULT_VERSIONS_FILE) {
  const versions = await readVersions(filePath);
  const source = findTemplate(input.sourceTemplateId) ?? defaultParameterVersion;
  const now = new Date().toISOString();
  const shouldCopyTemplateParameters = input.includeTemplateParameters !== false;
  const parameters = Array.isArray(input.parameters)
    ? input.parameters
    : shouldCopyTemplateParameters
      ? source.parameters
      : [];
  const normalized = normalizeVersion(
    {
      id: uniqueVersionId(input.name || source.name, input.versionLabel || nextVersionLabel(versions, source.name), versions),
      name: input.name || source.name,
      versionLabel: input.versionLabel || nextVersionLabel(versions, source.name),
      description: input.description || source.description,
      sourceTemplateId: source.id,
      parameters,
      createdAt: now,
      updatedAt: now
    },
    { locked: false }
  );

  versions.push(toStoredVersion(normalized));
  await writeVersions(versions, filePath);
  return normalized;
}

export async function updateParameterVersion(versionId, input = {}, filePath = DEFAULT_VERSIONS_FILE) {
  if (!versionId) {
    const error = new Error('Missing versionId');
    error.status = 400;
    throw error;
  }

  if (defaultParameterTemplates.some((template) => template.id === versionId)) {
    const error = new Error('Default parameter versions cannot be edited. Create a custom version from the default first.');
    error.status = 400;
    throw error;
  }

  const versions = await readVersions(filePath);
  const index = versions.findIndex((version) => version.id === versionId);

  if (index < 0) {
    const error = new Error('LLM parameter version was not found.');
    error.status = 404;
    throw error;
  }

  const normalized = normalizeVersion(
    {
      ...versions[index],
      ...input,
      id: versionId,
      locked: false,
      updatedAt: new Date().toISOString()
    },
    { locked: false }
  );
  versions[index] = toStoredVersion(normalized);
  await writeVersions(versions, filePath);
  return normalized;
}

export function normalizeParameters(parameters) {
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

function normalizeVersion(version = {}, options = {}) {
  const name = cleanString(version.name) || 'LLM parameter version';
  const versionLabel = cleanString(version.versionLabel || version.version || 'v1');

  return {
    id: cleanString(version.id) || slug(`${name}-${versionLabel}`),
    name,
    versionLabel,
    description: cleanString(version.description),
    sourceTemplateId: cleanString(version.sourceTemplateId),
    locked: Boolean(options.locked ?? version.locked),
    source: cleanString(version.source || (options.locked ? 'system' : 'custom')),
    parameters: normalizeParameters(version.parameters),
    createdAt: version.createdAt || new Date().toISOString(),
    updatedAt: version.updatedAt || new Date().toISOString()
  };
}

async function readVersions(filePath) {
  try {
    return readCollection(filePath, 'versions');
  } catch (error) {
    throw new Error(`Unable to load LLM parameter versions: ${error.message}`);
  }
}

async function writeVersions(versions, filePath) {
  await writeCollection(filePath, 'versions', versions);
}

function toStoredVersion(version) {
  const { locked, source, ...stored } = version;
  return stored;
}

function findTemplate(templateId) {
  return defaultParameterTemplates.find((template) => template.id === templateId) ?? null;
}

function nextVersionLabel(versions, name) {
  const normalizedName = cleanString(name).toLowerCase();
  const customCount = versions.filter((version) => cleanString(version.name).toLowerCase() === normalizedName).length;
  const hasDefault = defaultParameterTemplates.some((template) => cleanString(template.name).toLowerCase() === normalizedName);
  return `v${customCount + (hasDefault ? 2 : 1)}`;
}

function uniqueVersionId(name, versionLabel, versions) {
  const base = slug(`${name}-${versionLabel}`) || `llm-parameter-version-${Date.now()}`;
  if (String(process.env.DATA_STORE || '').toLowerCase() === 'supabase') {
    return `${base}-${Date.now().toString(36)}`;
  }

  const ids = new Set([
    defaultParameterVersion.id,
    ...defaultParameterTemplates.map((template) => template.id),
    ...versions.map((version) => version.id)
  ]);

  if (!ids.has(base)) return base;

  let index = 2;
  while (ids.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
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

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
