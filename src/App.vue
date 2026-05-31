<script setup>
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  PhoneCall,
  SlidersHorizontal,
  Users
} from '@lucide/vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ActionsPage from './components/ActionsPage.vue';
import AgentDetailPage from './components/AgentDetailPage.vue';
import AgentsPage from './components/AgentsPage.vue';
import AppSidebar from './components/AppSidebar.vue';
import CallsPage from './components/CallsPage.vue';
import DashboardControls from './components/DashboardControls.vue';
import DashboardTopbar from './components/DashboardTopbar.vue';
import LlmParametersPage from './components/LlmParametersPage.vue';
import OverviewPage from './components/OverviewPage.vue';

const loading = ref(true);
const error = ref('');
const dashboard = ref(null);
const selectedAgent = ref('all');
const activeView = ref('overview');
const sidebarCollapsed = ref(false);
const expandedAgentId = ref('');
const agentRouteId = ref('');
const expandedCallId = ref('');
const editingAgentId = ref('');
const agentDrafts = ref({});
const savingAgentId = ref('');
const agentEditError = ref('');
const agentEditMessage = ref('');
const activeAgentSection = ref('details');
const observabilityProfileByAgent = ref({});
const savedObservabilityProfileByAgent = ref({});
const observabilityProfileDrafts = ref({});
const editingProfileAgentId = ref('');
const editingObservabilityStage = ref('');
const savingProfileAgentId = ref('');
const loadingProfileAgentId = ref('');
const profileEditError = ref('');
const profileEditMessage = ref('');
const analyzingCallIds = ref({});
const parameterVersions = ref([]);
const llmParameterFocusVersionId = ref('');
let dashboardRefreshTimer = null;

const navItems = computed(() => [
  {
    id: 'overview',
    label: 'Overview',
    icon: BarChart3,
    count: dashboard.value?.summary?.monitoredAgents ?? 0
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Users,
    count: dashboard.value?.agents?.length ?? 0
  },
  {
    id: 'calls',
    label: 'Calls',
    icon: PhoneCall,
    count: dashboard.value?.summary?.totalCalls ?? 0
  },
  {
    id: 'actions',
    label: 'Actions',
    icon: ClipboardCheck,
    count: filteredHumanActions.value.length
  },
  {
    id: 'llm-parameters',
    label: 'LLM Parameters',
    icon: SlidersHorizontal,
    count: parameterVersions.value.length
  }
]);

const filteredCalls = computed(() => {
  const calls = dashboard.value?.calls ?? [];
  return calls.filter((call) => {
    const agentMatch = selectedAgent.value === 'all' || call.agentId === selectedAgent.value;
    return agentMatch;
  });
});

const filteredIssues = computed(() => {
  const calls = new Set(filteredCalls.value.map((call) => call.id));
  return (dashboard.value?.issues ?? []).filter((issue) => calls.has(issue.callId));
});

const filteredRecommendations = computed(() => {
  const calls = new Set(filteredCalls.value.map((call) => call.id));
  return (dashboard.value?.recommendations ?? []).filter((recommendation) => calls.has(recommendation.callId));
});

const filteredUseActions = computed(() => {
  const calls = new Set(filteredCalls.value.map((call) => call.id));
  return (dashboard.value?.useActions ?? []).filter((action) => calls.has(action.callId));
});

const filteredHumanActions = computed(() => filteredUseActions.value.filter((action) => action.source === 'llm'));

const criticalIssueCount = computed(() => filteredIssues.value.filter((issue) => issue.severity === 'critical').length);

const selectedAgentName = computed(() => {
  if (selectedAgent.value === 'all') return 'All agents';
  const agent = dashboard.value?.agents?.find((item) => item.id === selectedAgent.value);
  return agent ? displayAgentName(agent.id, agent.name) : 'Selected agent';
});

const topRecommendation = computed(() => filteredRecommendations.value.find((item) => item.severity === 'critical') ?? filteredRecommendations.value[0]);

const sourceLabel = computed(() => {
  const source = dashboard.value?.dataSource;
  const labels = {
    demo: 'Demo data',
    highlevel: 'Live HighLevel data',
    empty: 'No transcripts'
  };

  return labels[source] ?? 'Observability data';
});

const activeViewTitle = computed(() => {
  if (agentRouteId.value) {
    return selectedAgentPanel.value?.displayName ?? 'Agent';
  }

  return navItems.value.find((item) => item.id === activeView.value)?.label ?? 'Overview';
});
const latestCalls = computed(() => filteredCalls.value.slice(0, 4));

const agentDisplayNames = computed(() => {
  const names = new Map();
  const agents = dashboard.value?.agents ?? [];

  agents.forEach((agent, index) => {
    names.set(agent.id, getReadableAgentName(agent, index));
  });

  return names;
});

const agentDirectory = computed(() => {
  const agents = dashboard.value?.agents ?? [];
  const calls = dashboard.value?.calls ?? [];
  const issues = dashboard.value?.issues ?? [];
  const recommendations = dashboard.value?.recommendations ?? [];
  const useActions = dashboard.value?.useActions ?? [];

  return agents.map((agent, index) => {
    const agentCalls = calls.filter((call) => call.agentId === agent.id);
    const agentIssues = issues.filter((issue) => issue.agentId === agent.id);
    const agentRecommendations = recommendations.filter((recommendation) => recommendation.agentId === agent.id);
    const agentUseActions = useActions.filter((action) => action.agentId === agent.id);
    const recentCalls = agentCalls.slice(0, 3);
    const savedProfile = savedObservabilityProfileByAgent.value[agent.id] ?? observabilityProfileByAgent.value[agent.id] ?? null;
    const parameterVersionId = savedProfile?.parameterVersionId || '';
    const weakestCall = agentCalls
      .filter((call) => Number.isFinite(call.score))
      .sort((a, b) => a.score - b.score)[0];

    return {
      ...agent,
      displayName: getReadableAgentName(agent, index),
      calls: agentCalls,
      issues: agentIssues,
      recommendations: agentRecommendations,
      useActions: agentUseActions,
      recentCalls,
      weakestCall,
      kpis: buildAgentKpiSummary(agentCalls),
      observabilityProfile: savedProfile,
      parameterVersionId,
      parameterVersionName: savedProfile?.parameterVersionName || '',
      needsParameterVersion: !parameterVersionId
    };
  });
});

const selectedAgentPanel = computed(() => agentDirectory.value.find((agent) => agent.id === expandedAgentId.value) ?? null);
const selectedObservabilityProfile = computed(() =>
  selectedAgentPanel.value ? observabilityProfileByAgent.value[selectedAgentPanel.value.id] ?? null : null
);

const overviewAgents = computed(() =>
  agentDirectory.value
    .slice()
    .sort((a, b) => (b.issueCount + b.useActionCount) - (a.issueCount + a.useActionCount) || (a.averageScore ?? 101) - (b.averageScore ?? 101))
    .slice(0, 4)
);

const overviewKpis = computed(() => (dashboard.value?.kpiSummary ?? []).slice(0, 5));
const overviewIssues = computed(() => filteredIssues.value.slice(0, 4));
const overviewActions = computed(() => filteredHumanActions.value.slice(0, 3));

const overviewHealthLabel = computed(() => {
  if (criticalIssueCount.value > 0) return 'Needs attention';
  if (filteredHumanActions.value.length > 0) return 'Follow-up active';
  return 'Stable';
});

const callDetailsById = computed(() => {
  const issues = dashboard.value?.issues ?? [];
  const recommendations = dashboard.value?.recommendations ?? [];
  const useActions = dashboard.value?.useActions ?? [];
  const details = new Map();

  for (const call of dashboard.value?.calls ?? []) {
    details.set(call.id, {
      issues: issues.filter((issue) => issue.callId === call.id),
      recommendations: recommendations.filter((recommendation) => recommendation.callId === call.id),
      useActions: useActions.filter((action) => action.callId === call.id),
      transcriptTurns: parseTranscript(call.transcript)
    });
  }

  return details;
});

onMounted(() => {
  syncRouteFromLocation();
  window.addEventListener('popstate', syncRouteFromLocation);
  window.addEventListener('hashchange', syncRouteFromLocation);

  loadDashboard();
  loadParameterVersions();
  dashboardRefreshTimer = window.setInterval(() => {
    if (editingAgentId.value || editingProfileAgentId.value) return;
    loadDashboard({ silent: true });
  }, 12000);
});

onUnmounted(() => {
  if (dashboardRefreshTimer) {
    window.clearInterval(dashboardRefreshTimer);
  }
  window.removeEventListener('popstate', syncRouteFromLocation);
  window.removeEventListener('hashchange', syncRouteFromLocation);
});

async function loadDashboard(options = {}) {
  const silent = options.silent === true;
  if (!silent) {
    loading.value = true;
    error.value = '';
  }

  try {
    const response = await fetch('/api/observability');
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || 'Unable to load observability data');
    }

    dashboard.value = body;
    await loadSavedObservabilityProfiles({ silent: true });

    if (agentRouteId.value && editingProfileAgentId.value !== agentRouteId.value) {
      await loadAgentObservabilityProfile(agentRouteId.value, { silent });
    }
  } catch (requestError) {
    if (!silent) {
      error.value = requestError.message;
    }
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
}

async function loadSavedObservabilityProfiles(options = {}) {
  try {
    const response = await fetch('/api/agent-observability-profiles');
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || 'Unable to load saved observability profiles');
    }

    const profilesByAgent = {};
    for (const profile of body.profiles ?? []) {
      for (const agentId of profile.agentIds ?? []) {
        profilesByAgent[agentId] = profile;
      }
    }
    savedObservabilityProfileByAgent.value = profilesByAgent;
  } catch (requestError) {
    if (!options.silent) {
      error.value = requestError.message;
    }
  }
}

async function loadParameterVersions() {
  try {
    const response = await fetch('/api/llm-parameter-versions');
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || 'Unable to load LLM parameter versions');
    }

    parameterVersions.value = body.versions ?? [];
  } catch (requestError) {
    error.value = requestError.message;
  }
}

function syncRouteFromLocation() {
  const routedAgentId = getAgentIdFromPath();

  if (routedAgentId) {
    agentRouteId.value = routedAgentId;
    expandedAgentId.value = routedAgentId;
    activeView.value = 'agents';

    if (!['details', 'observability-parameters', 'recommendations', 'actions'].includes(activeAgentSection.value)) {
      activeAgentSection.value = 'details';
    }

    loadAgentObservabilityProfile(routedAgentId);
    return;
  }

  if (agentRouteId.value) {
    resetAgentPanelState();
  }

  agentRouteId.value = '';
  const hashView = window.location.hash.replace('#', '');
  if (navItems.value.some((item) => item.id === hashView)) {
    activeView.value = hashView;
  }
}

function getAgentIdFromPath() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!path || path === 'index.html') return '';

  const firstSegment = path.split('/')[0];
  if (['api', 'assets'].includes(firstSegment)) return '';

  try {
    return decodeURIComponent(firstSegment);
  } catch {
    return firstSegment;
  }
}

function setView(view) {
  activeView.value = view;
  agentRouteId.value = '';
  resetAgentPanelState();
  if (view !== 'llm-parameters') {
    llmParameterFocusVersionId.value = '';
  }
  if (view === 'llm-parameters') {
    loadParameterVersions();
  }
  window.history.pushState({}, '', `/#${view}`);
}

function openLlmParameters(versionId = '') {
  llmParameterFocusVersionId.value = versionId || '';
  activeView.value = 'llm-parameters';
  agentRouteId.value = '';
  resetAgentPanelState();
  loadParameterVersions();
  window.history.pushState({}, '', '/#llm-parameters');
}

function openAgentDetails(agentId, section = 'details') {
  activeView.value = 'agents';
  agentRouteId.value = agentId;
  expandedAgentId.value = agentId;
  activeAgentSection.value = section;
  agentEditError.value = '';
  agentEditMessage.value = '';
  profileEditError.value = '';
  profileEditMessage.value = '';
  loadAgentObservabilityProfile(agentId);

  const nextPath = `/${encodeURIComponent(agentId)}`;
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath);
  }
}

function resetAgentPanelState() {
  expandedAgentId.value = '';
  activeAgentSection.value = 'details';
  editingAgentId.value = '';
  editingProfileAgentId.value = '';
  editingObservabilityStage.value = '';
  agentEditError.value = '';
  agentEditMessage.value = '';
  profileEditError.value = '';
  profileEditMessage.value = '';
}

function closeAgentDetails() {
  agentRouteId.value = '';
  resetAgentPanelState();
}

function backToAgents() {
  activeView.value = 'agents';
  agentRouteId.value = '';
  resetAgentPanelState();
  window.history.pushState({}, '', '/#agents');
}

function showAgentDetails(agentId) {
  openAgentDetails(agentId, 'details');
}

function toggleCall(callId) {
  expandedCallId.value = expandedCallId.value === callId ? '' : callId;
}

function showCallDetails(callId) {
  const call = (dashboard.value?.calls ?? []).find((item) => item.id === callId);
  if (!call) return;

  selectedAgent.value = call.agentId;
  expandedCallId.value = callId;
  closeAgentDetails();
  setView('calls');
}

function showAgentCalls(agentId) {
  selectedAgent.value = agentId;
  closeAgentDetails();
  setView('calls');
}

function showAgentRecommendations(agentId) {
  openAgentDetails(agentId, 'recommendations');
}

function showAgentActions(agentId) {
  openAgentDetails(agentId, 'actions');
}

function startEditAgent(agent) {
  editingAgentId.value = agent.id;
  agentEditError.value = '';
  agentEditMessage.value = '';
  agentDrafts.value = {
    ...agentDrafts.value,
    [agent.id]: {
      agentName: agent.name || agent.displayName || '',
      businessName: agent.businessName || '',
      welcomeMessage: agent.welcomeMessage || '',
      agentPrompt: agent.description || ''
    }
  };
}

function cancelEditAgent() {
  editingAgentId.value = '';
  agentEditError.value = '';
}

async function saveAgent(agent) {
  const draft = agentDrafts.value[agent.id];
  if (!draft) return;

  savingAgentId.value = agent.id;
  agentEditError.value = '';
  agentEditMessage.value = '';

  try {
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(draft)
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || 'Unable to update agent');
    }

    agentEditMessage.value = 'Agent updated.';
    editingAgentId.value = '';
    await loadDashboard();
    expandedAgentId.value = agent.id;
  } catch (requestError) {
    agentEditError.value = requestError.message;
  } finally {
    savingAgentId.value = '';
  }
}

async function loadAgentObservabilityProfile(agentId, options = {}) {
  if (!agentId) return;

  const silent = options.silent === true || editingProfileAgentId.value === agentId;
  const agent = agentDirectory.value.find((item) => item.id === agentId);
  const params = new URLSearchParams();
  if (agent?.name || agent?.displayName) params.set('agentName', agent.name || agent.displayName);

  if (!silent) {
    loadingProfileAgentId.value = agentId;
    profileEditError.value = '';
  }

  try {
    const response = await fetch(`/api/agent-observability-profiles/${agentId}?${params}`);
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || 'Unable to load observability profile');
    }

    observabilityProfileByAgent.value = {
      ...observabilityProfileByAgent.value,
      [agentId]: body.profile
    };
    savedObservabilityProfileByAgent.value = {
      ...savedObservabilityProfileByAgent.value,
      [agentId]: body.profile
    };
  } catch (requestError) {
    if (!silent) {
      profileEditError.value = requestError.message;
    }
  } finally {
    if (!silent) {
      loadingProfileAgentId.value = '';
    }
  }
}

function startEditObservabilityProfile(payload) {
  const restoreScroll = preserveCurrentScroll();
  const agent = payload?.agent ?? payload;
  const stage = payload?.stage ?? activeAgentSection.value ?? 'details';
  if (!agent?.id) {
    restoreScroll();
    return;
  }

  const profile = observabilityProfileByAgent.value[agent.id];
  if (!profile) {
    loadAgentObservabilityProfile(agent.id);
    restoreScroll();
    return;
  }

  editingProfileAgentId.value = agent.id;
  editingObservabilityStage.value = stage;
  profileEditError.value = '';
  profileEditMessage.value = '';
  observabilityProfileDrafts.value = {
    ...observabilityProfileDrafts.value,
    [agent.id]: profileToDraft(profile)
  };
  restoreScroll();
}

function cancelEditObservabilityProfile() {
  const restoreScroll = preserveCurrentScroll();
  editingProfileAgentId.value = '';
  editingObservabilityStage.value = '';
  profileEditError.value = '';
  restoreScroll();
}

function addObservabilityCriterion(agentId) {
  const restoreScroll = preserveCurrentScroll();
  const draft = observabilityProfileDrafts.value[agentId];
  if (!draft) {
    restoreScroll();
    return;
  }

  draft.parameters.push({
    id: `parameter-${Date.now()}`,
    title: '',
    description: '',
    category: 'custom',
    successSignalsText: '',
    failureSignalsText: '',
    recommendation: '',
    promptGuidance: '',
    requiresHumanReview: false,
    useActionType: '',
    enabled: true
  });
  restoreScroll();
}

function removeObservabilityCriterion(agentId, criterionId) {
  const restoreScroll = preserveCurrentScroll();
  const draft = observabilityProfileDrafts.value[agentId];
  if (!draft) {
    restoreScroll();
    return;
  }
  draft.parameters = draft.parameters.filter((parameter) => parameter.id !== criterionId);
  restoreScroll();
}

async function saveObservabilityProfile(agent) {
  const restoreScroll = preserveCurrentScroll();
  const draft = observabilityProfileDrafts.value[agent.id];
  if (!draft) {
    restoreScroll();
    return;
  }

  savingProfileAgentId.value = agent.id;
  profileEditError.value = '';
  profileEditMessage.value = '';

  try {
    const response = await fetch(`/api/agent-observability-profiles/${agent.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(draftToProfile(draft, agent))
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || 'Unable to save observability profile');
    }

    observabilityProfileByAgent.value = {
      ...observabilityProfileByAgent.value,
      [agent.id]: body.profile
    };
    savedObservabilityProfileByAgent.value = {
      ...savedObservabilityProfileByAgent.value,
      [agent.id]: body.profile
    };
    profileEditMessage.value = 'Observability settings saved.';
    editingProfileAgentId.value = '';
    editingObservabilityStage.value = '';
    await loadDashboard();
    expandedAgentId.value = agent.id;
  } catch (requestError) {
    profileEditError.value = requestError.message;
  } finally {
    savingProfileAgentId.value = '';
    restoreScroll();
  }
}

async function applyParameterVersionToAgent(payload = {}) {
  const agent = payload.agent;
  const versionId = payload.versionId;
  if (!agent?.id || !versionId) return;

  const version = parameterVersions.value.find((item) => item.id === versionId);
  if (!version) return;

  savingProfileAgentId.value = agent.id;
  profileEditError.value = '';
  profileEditMessage.value = '';

  const currentProfile = observabilityProfileByAgent.value[agent.id] ?? {
    id: `profile-${agent.id}`,
    name: `${agent.displayName || agent.name || 'Agent'} Observability`,
    agentIds: [agent.id],
    agentNames: [agent.displayName || agent.name].filter(Boolean),
    scriptSummary: '',
    goals: [],
    negativeSignals: []
  };

  try {
    const response = await fetch(`/api/agent-observability-profiles/${agent.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...currentProfile,
        name: currentProfile.name || `${agent.displayName || agent.name || 'Agent'} Observability`,
        agentIds: [agent.id],
        agentNames: [agent.displayName || agent.name].filter(Boolean),
        parameterVersionId: version.id,
        parameterVersionName: `${version.name} ${version.versionLabel}`.trim(),
        parameterVersionDescription: version.description,
        parameters: [],
        configured: true
      })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || 'Unable to attach LLM parameter version');
    }

    observabilityProfileByAgent.value = {
      ...observabilityProfileByAgent.value,
      [agent.id]: body.profile
    };
    savedObservabilityProfileByAgent.value = {
      ...savedObservabilityProfileByAgent.value,
      [agent.id]: body.profile
    };
    profileEditMessage.value = `Attached ${version.name} ${version.versionLabel}.`;
    await loadDashboard({ silent: true });
    expandedAgentId.value = agent.id;
  } catch (requestError) {
    profileEditError.value = requestError.message;
  } finally {
    savingProfileAgentId.value = '';
  }
}

async function analyzeCall(call) {
  if (!call?.id) return;

  analyzingCallIds.value = {
    ...analyzingCallIds.value,
    [call.id]: true
  };
  error.value = '';

  try {
    const response = await fetch(`/api/call-analyses/${call.id}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: call.agentId,
        locationId: dashboard.value?.locationId
      })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || 'Unable to enqueue call for analysis');
    }

    await loadDashboard({ silent: true });
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    const next = { ...analyzingCallIds.value };
    delete next[call.id];
    analyzingCallIds.value = next;
  }
}

function preserveCurrentScroll() {
  const scrollTargets = [
    document.scrollingElement,
    document.documentElement,
    document.body,
    document.querySelector('.content-shell'),
    document.querySelector('.agent-detail-content')
  ]
    .filter(Boolean)
    .filter((element, index, list) => list.indexOf(element) === index)
    .map((element) => ({
      element,
      left: element.scrollLeft,
      top: element.scrollTop
    }));
  const windowLeft = window.scrollX;
  const windowTop = window.scrollY;

  return () => {
    const restore = () => {
      window.scrollTo({ left: windowLeft, top: windowTop, behavior: 'auto' });
      for (const target of scrollTargets) {
        target.element.scrollLeft = target.left;
        target.element.scrollTop = target.top;
      }
    };

    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
      window.setTimeout(restore, 80);
    });
  };
}

function callDetails(callId) {
  return callDetailsById.value.get(callId) ?? {
    issues: [],
    recommendations: [],
    useActions: [],
    transcriptTurns: []
  };
}

function profileToDraft(profile) {
  const parameters = (profile.parameters?.length ? profile.parameters : profile.criteria ?? []).map((parameter) =>
    parameter.title
      ? parameterToDraft(parameter)
      : criterionToDraftParameter(parameter)
  );

  return {
    id: profile.id,
    name: profile.name || '',
    scriptSummary: profile.scriptSummary || '',
    goalsText: (profile.goals ?? []).join('\n'),
    negativeSignalsText: (profile.negativeSignals ?? []).join('\n'),
    parameterVersionId: profile.parameterVersionId || '',
    parameterVersionName: profile.parameterVersionName || '',
    parameters
  };
}

function draftToProfile(draft, agent) {
  return {
    id: draft.id,
    name: draft.name || `${agent.displayName || agent.name || 'Agent'} Parameters`,
    agentIds: [agent.id],
    agentNames: [agent.displayName || agent.name].filter(Boolean),
    scriptSummary: draft.scriptSummary,
    goals: splitList(draft.goalsText),
    negativeSignals: splitList(draft.negativeSignalsText),
    parameterVersionId: draft.parameterVersionId || '',
    parameterVersionName: draft.parameterVersionName || '',
    parameters: draft.parameters
      .map((parameter) => ({
        id: parameter.id,
        title: parameter.title,
        description: parameter.description,
        category: parameter.category || 'custom',
        successSignals: splitList(parameter.successSignalsText),
        failureSignals: splitList(parameter.failureSignalsText),
        recommendation: parameter.recommendation,
        promptGuidance: parameter.promptGuidance,
        requiresHumanReview: Boolean(parameter.requiresHumanReview),
        useActionType: parameter.useActionType,
        enabled: parameter.enabled !== false
      }))
      .filter((parameter) => parameter.title || parameter.description),
    configured: true
  };
}

function parameterToDraft(parameter) {
  return {
    id: parameter.id,
    title: parameter.title || '',
    description: parameter.description || '',
    category: parameter.category || 'custom',
    successSignalsText: (parameter.successSignals ?? []).join(', '),
    failureSignalsText: (parameter.failureSignals ?? []).join(', '),
    recommendation: parameter.recommendation || '',
    promptGuidance: parameter.promptGuidance || '',
    requiresHumanReview: Boolean(parameter.requiresHumanReview),
    useActionType: parameter.useActionType || '',
    enabled: parameter.enabled !== false
  };
}

function criterionToDraftParameter(criterion) {
  return {
    id: criterion.id,
    title: criterion.label || '',
    description: criterion.llmDescription || criterion.expectedBehavior || criterion.issue || '',
    category: criterion.category || 'custom',
    successSignalsText: (criterion.keywordsAny ?? criterion.passWhenAny ?? []).join(', '),
    failureSignalsText: (criterion.requiredWhenAny ?? []).join(', '),
    recommendation: criterion.recommendation || '',
    promptGuidance: criterion.promptPatch || '',
    requiresHumanReview: Boolean(criterion.useActionType),
    useActionType: criterion.useActionType || '',
    enabled: true
  };
}

function splitList(value) {
  return String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreClass(score) {
  if (score === null || score === undefined) return 'score-muted';
  if (score >= 80) return 'score-good';
  if (score >= 60) return 'score-watch';
  return 'score-risk';
}

function severityClass(severity) {
  return `severity-${severity || 'info'}`;
}

function formatStatus(status) {
  const labels = {
    attention: 'Needs attention',
    watch: 'Watch',
    healthy: 'Healthy',
    pending: 'Pending transcript',
    incomplete: 'Incomplete'
  };

  return labels[status] ?? 'Unknown';
}

function formatSeverity(severity) {
  const labels = {
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info'
  };

  return labels[severity] ?? 'Info';
}

function displayAgentName(agentId, fallbackName) {
  return agentDisplayNames.value.get(agentId) ?? getReadableAgentName({ id: agentId, name: fallbackName }, 0);
}

function extractAgentRoleObjective(prompt) {
  const content = String(prompt || '').replace(/\r\n/g, '\n').trim();
  if (!content) return '';

  const headingPattern = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*AGENT\s+ROLE\s*&\s*OBJECTIVE\s*(?:\*\*)?\s*:?\s*\n?/i;
  const headingMatch = content.match(headingPattern);

  if (!headingMatch) {
    return '';
  }

  const startIndex = (headingMatch.index ?? 0) + headingMatch[0].length;
  const sectionLines = content.slice(startIndex).split('\n');
  const result = [];

  for (const line of sectionLines) {
    const trimmed = line.trim();
    const isNextHeading =
      trimmed.length > 0 &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('* ') &&
      /^(?:#{1,6}\s*)?(?:\*\*)?[A-Z][A-Z0-9 /&(),.'-]{4,}(?:\*\*)?:?$/.test(trimmed);

    if (isNextHeading) break;
    result.push(line);
  }

  return result.join('\n').trim() || 'No role/objective details found in this prompt section.';
}

function getReadableAgentName(agent, index) {
  const rawName = String(agent?.name || '').trim();
  const id = String(agent?.id || '').trim();

  if (rawName && !looksGeneratedAgentName(rawName, id)) return rawName;

  if (agent?.goalProfileName && !agent.goalProfileName.toLowerCase().startsWith('default')) {
    return agent.goalProfileName;
  }

  return `Voice AI Agent ${index + 1}`;
}

function looksGeneratedAgentName(name, id) {
  const normalizedName = name.toLowerCase();
  const normalizedId = id.toLowerCase();

  return (
    normalizedName === normalizedId ||
    normalizedName === `agent ${normalizedId}` ||
    /^agent\s+[a-z0-9]{12,}$/i.test(name) ||
    /^[a-z0-9]{16,}$/i.test(name)
  );
}

function buildAgentKpiSummary(calls) {
  const byKpi = new Map();

  for (const call of calls) {
    for (const criterion of call.criteria ?? []) {
      if (criterion.passed === null || criterion.passed === undefined) continue;

      if (!byKpi.has(criterion.id)) {
        byKpi.set(criterion.id, {
          id: criterion.id,
          label: criterion.label,
          passed: 0,
          failed: 0
        });
      }

      const item = byKpi.get(criterion.id);
      if (criterion.passed) item.passed += 1;
      else item.failed += 1;
    }
  }

  return Array.from(byKpi.values())
    .map((item) => ({
      ...item,
      failureRate: item.passed + item.failed === 0 ? 0 : Math.round((item.failed / (item.passed + item.failed)) * 100)
    }))
    .sort((a, b) => b.failureRate - a.failureRate || b.failed - a.failed)
    .slice(0, 4);
}

function agentInitials(name) {
  const parts = String(name || 'Agent')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]).join('').toUpperCase() || 'AI';
}

function parseTranscript(transcript) {
  return String(transcript || '')
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      const match = trimmed.match(/^([^:]{1,32}):\s*(.*)$/);

      return {
        id: `turn-${index}`,
        speaker: match ? match[1].trim() : 'Speaker',
        text: match ? match[2].trim() : trimmed
      };
    })
    .filter(Boolean);
}

function speakerClass(speaker) {
  const normalized = String(speaker || '').toLowerCase();
  if (['human', 'caller', 'customer', 'user'].includes(normalized)) return 'caller';
  if (['bot', 'agent', 'assistant'].includes(normalized)) return 'agent';
  return 'other';
}

function formatSpeaker(speaker) {
  const normalized = String(speaker || '').toLowerCase();
  const labels = {
    bot: 'Agent',
    assistant: 'Agent',
    agent: 'Agent',
    human: 'Caller',
    caller: 'Caller',
    customer: 'Caller',
    user: 'Caller'
  };

  return labels[normalized] ?? speaker;
}

function formatScore(score) {
  return score === null || score === undefined ? '--' : score;
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function formatDate(value) {
  if (!value) return 'Unknown';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

const helpers = {
  agentInitials,
  displayAgentName,
  extractAgentRoleObjective,
  formatDate,
  formatDuration,
  formatScore,
  formatSeverity,
  formatSpeaker,
  formatStatus,
  scoreClass,
  severityClass,
  speakerClass
};
</script>

<template>
  <main class="app-frame" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar
      :active-view="activeView"
      :collapsed="sidebarCollapsed"
      :nav-items="navItems"
      @set-view="setView"
      @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed"
    />

    <section class="content-shell">
      <DashboardTopbar
        :active-view-title="activeViewTitle"
        :dashboard="dashboard"
        :loading="loading"
        :source-label="sourceLabel"
        @refresh="loadDashboard"
      />

      <section v-if="error" class="error-band">
        <AlertTriangle :size="18" />
        <span>{{ error }}</span>
      </section>

      <section v-if="loading && !dashboard" class="loading-state">
        <Activity :size="22" class="spinning" />
        <span>Loading observability data</span>
      </section>

      <template v-else-if="dashboard">
        <template v-if="agentRouteId">
          <AgentDetailPage
            v-if="selectedAgentPanel"
            :active-agent-section="activeAgentSection"
            :agent-drafts="agentDrafts"
            :agent-edit-error="agentEditError"
            :agent-edit-message="agentEditMessage"
            :editing-agent-id="editingAgentId"
            :editing-observability-stage="editingObservabilityStage"
            :editing-profile-agent-id="editingProfileAgentId"
            :helpers="helpers"
            :loading-profile-agent-id="loadingProfileAgentId"
            :observability-profile-drafts="observabilityProfileDrafts"
            :parameter-versions="parameterVersions"
            :profile-edit-error="profileEditError"
            :profile-edit-message="profileEditMessage"
            :saving-agent-id="savingAgentId"
            :saving-profile-agent-id="savingProfileAgentId"
            :selected-agent-panel="selectedAgentPanel"
            :selected-observability-profile="selectedObservabilityProfile"
            @add-observability-criterion="addObservabilityCriterion"
            @apply-parameter-version="applyParameterVersionToAgent"
            @back-to-agents="backToAgents"
            @cancel-edit-agent="cancelEditAgent"
            @cancel-edit-observability-profile="cancelEditObservabilityProfile"
            @open-agent-section="openAgentDetails($event.agentId, $event.section)"
            @open-llm-parameters="openLlmParameters"
            @remove-observability-criterion="removeObservabilityCriterion"
            @save-agent="saveAgent"
            @save-observability-profile="saveObservabilityProfile"
            @show-agent-calls="showAgentCalls"
            @show-call="showCallDetails"
            @start-edit-agent="startEditAgent"
            @start-edit-observability-profile="startEditObservabilityProfile"
          />

          <section v-else class="agent-detail-missing">
            <p class="eyebrow">Agent not found</p>
            <h2>This agent is not available anymore</h2>
            <p>It may have been deleted in HighLevel or the local dashboard has not synced it yet.</p>
            <button class="text-button primary" type="button" @click="backToAgents">
              Back to agents
            </button>
          </section>
        </template>

        <template v-else>
          <DashboardControls
            v-model:selected-agent="selectedAgent"
            :active-view="activeView"
            :dashboard="dashboard"
            :helpers="helpers"
          />

        <OverviewPage
          v-if="activeView === 'overview'"
          :critical-issue-count="criticalIssueCount"
          :dashboard="dashboard"
          :filtered-use-actions="filteredHumanActions"
          :helpers="helpers"
          :latest-calls="latestCalls"
          :overview-actions="overviewActions"
          :overview-agents="overviewAgents"
          :overview-health-label="overviewHealthLabel"
          :overview-issues="overviewIssues"
          :overview-kpis="overviewKpis"
          :selected-agent-name="selectedAgentName"
          :top-recommendation="topRecommendation"
          @set-view="setView"
          @show-agent="showAgentDetails"
          @show-call="showCallDetails"
        />

        <AgentsPage
          v-else-if="activeView === 'agents'"
          :agent-directory="agentDirectory"
          :helpers="helpers"
          @open-agent-page="openAgentDetails($event.agentId, $event.section)"
          @show-agent-recommendations="showAgentRecommendations"
        />

        <CallsPage
          v-else-if="activeView === 'calls'"
          :agent-directory="agentDirectory"
          :analyzing-call-ids="analyzingCallIds"
          :call-details="callDetails"
          :expanded-call-id="expandedCallId"
          :filtered-calls="filteredCalls"
          :helpers="helpers"
          :llm-analyses="dashboard.llmAnalyses ?? []"
          :selected-agent="selectedAgent"
          :total-call-count="dashboard.summary.totalCalls"
          @analyze-call="analyzeCall"
          @select-agent="selectedAgent = $event"
          @show-agent-recommendations="showAgentRecommendations"
          @toggle-call="toggleCall"
        />

        <ActionsPage
          v-else-if="activeView === 'actions'"
          :actions="filteredHumanActions"
          :helpers="helpers"
          :selected-agent-name="selectedAgentName"
          @show-agent-review="showAgentActions"
          @show-call="showCallDetails"
        />

        <LlmParametersPage
          v-else-if="activeView === 'llm-parameters'"
          :focus-version-id="llmParameterFocusVersionId"
          @versions-changed="loadParameterVersions"
        />
        </template>
      </template>
    </section>
  </main>
</template>
