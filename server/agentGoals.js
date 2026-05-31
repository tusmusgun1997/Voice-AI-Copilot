import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_GOALS_FILE = 'config/agent-goals.json';

const ACTION_WORDS = [
  'appointment',
  'book',
  'booking',
  'schedule',
  'scheduled',
  'confirmed',
  'confirmation',
  'demo',
  'consultation',
  'quote',
  'estimate'
];

const QUALIFICATION_WORDS = [
  'what are you looking for',
  'how can i help',
  'first visit',
  'follow-up',
  'preferred',
  'when works',
  'what time',
  'what day',
  'need',
  'goal'
];

const ESCALATION_WORDS = [
  'manager',
  'office team',
  'human',
  'representative',
  'call back',
  'connect me',
  'transfer',
  'billing',
  'charged',
  'frustrated',
  'upset'
];

export const defaultGoalProfile = {
  id: 'default',
  name: 'Default intake and booking agent',
  scriptSummary: 'Qualify the caller, resolve or route the request, and confirm a concrete next step.',
  goals: [
    'Open with a clear greeting',
    'Understand the caller need',
    'Offer a concrete next step',
    'Confirm the outcome',
    'Escalate support or billing risk'
  ],
  negativeSignals: [
    'call back later',
    'not sure',
    'cannot help',
    "can't help",
    'no availability',
    'hang up',
    'voicemail',
    'frustrated',
    'charged twice'
  ],
  criteria: [
    {
      id: 'opening',
      label: 'Clear opening',
      weight: 12,
      keywordsAny: ['thanks for calling', 'hello', 'hi ', 'good morning', 'good afternoon'],
      issue: 'Opening did not clearly orient the caller.',
      recommendation: 'Add a concise branded opener that states the business and invites the caller to describe the need.'
    },
    {
      id: 'qualification',
      label: 'Need qualification',
      weight: 22,
      keywordsAny: QUALIFICATION_WORDS,
      issue: 'Agent did not gather enough context before responding.',
      recommendation: 'Add one required qualification question before pricing, scheduling, or handoff language.'
    },
    {
      id: 'nextStep',
      label: 'Next step offered',
      weight: 26,
      keywordsAny: ACTION_WORDS,
      allowExecutedAction: true,
      useActionType: 'Script training',
      issue: 'Call ended without a concrete next step.',
      recommendation: 'Train the agent to offer a specific appointment, callback, quote, or transfer before closing.'
    },
    {
      id: 'confirmation',
      label: 'Outcome confirmed',
      weight: 18,
      keywordsAny: ['confirmed', 'you are set', 'text confirmation', 'summary', 'next step'],
      allowExecutedAction: true,
      issue: 'Outcome was not confirmed back to the caller.',
      recommendation: 'Add a closing confirmation that repeats the date, time, owner, or next action.'
    },
    {
      id: 'escalation',
      label: 'Escalation handled',
      weight: 22,
      requiredWhenAny: ESCALATION_WORDS,
      passWhenAny: ['transfer', 'connect you', 'have someone call', 'create a ticket'],
      useActionType: 'Human handoff',
      issue: 'Caller asked for help that should have been escalated.',
      recommendation: 'Add a human handoff rule for billing, complaints, urgent requests, and repeated caller frustration.'
    }
  ]
};

export async function loadAgentGoalProfiles(filePath = DEFAULT_GOALS_FILE) {
  const customProfiles = await readGoalProfiles(filePath);
  const profiles = [defaultGoalProfile, ...customProfiles.map(normalizeGoalProfile)];

  return {
    profiles,
    defaultProfile: profiles[0]
  };
}

export function getAgentGoalProfile(goalProfiles, call) {
  const profiles = goalProfiles?.profiles ?? [defaultGoalProfile];
  const byAgentId = profiles.find((profile) => profile.agentIds?.includes(call.agentId));
  const byAgentName = profiles.find((profile) => profile.agentNames?.includes(call.agentName));

  return byAgentId ?? byAgentName ?? goalProfiles?.defaultProfile ?? defaultGoalProfile;
}

async function readGoalProfiles(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath || DEFAULT_GOALS_FILE);

  try {
    const content = await fs.readFile(resolvedPath, 'utf8');
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.profiles)) return parsed.profiles;
    return [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Unable to load agent goal profiles: ${error.message}`);
  }
}

function normalizeGoalProfile(profile) {
  return {
    ...profile,
    id: profile.id || slug(profile.name || 'custom-agent-profile'),
    name: profile.name || 'Custom agent profile',
    scriptSummary: profile.scriptSummary || defaultGoalProfile.scriptSummary,
    goals: Array.isArray(profile.goals) ? profile.goals : [],
    negativeSignals: Array.isArray(profile.negativeSignals)
      ? profile.negativeSignals
      : defaultGoalProfile.negativeSignals,
    criteria: mergeCriteria(profile.criteria)
  };
}

function mergeCriteria(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return defaultGoalProfile.criteria;
  }

  return criteria.map((criterion) => {
    const fallback = defaultGoalProfile.criteria.find((item) => item.id === criterion.id) ?? {};
    return {
      ...fallback,
      ...criterion,
      weight: Number.isFinite(Number(criterion.weight)) ? Number(criterion.weight) : fallback.weight ?? 10
    };
  });
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
