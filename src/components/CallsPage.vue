<script setup>
import { ArrowRight } from '@lucide/vue';
import { computed } from 'vue';

const PASSING_SCORE = 80;

const props = defineProps({
  agentDirectory: {
    type: Array,
    required: true
  },
  callDetails: {
    type: Function,
    required: true
  },
  filteredCalls: {
    type: Array,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  },
  llmAnalyses: {
    type: Array,
    default: () => []
  },
  selectedAgent: {
    type: String,
    required: true
  },
  totalCallCount: {
    type: Number,
    required: true
  }
});

defineEmits(['open-call', 'select-agent']);

const analysisByCallId = computed(() => {
  const map = new Map();

  for (const analysis of props.llmAnalyses) {
    if (!analysis.callId) continue;
    const current = map.get(analysis.callId);
    if (!current || new Date(analysis.updatedAt || 0) > new Date(current.updatedAt || 0)) {
      map.set(analysis.callId, analysis);
    }
  }

  return map;
});

const callOnlyAgentCount = computed(() => {
  const activeAgentIds = new Set(props.agentDirectory.map((agent) => agent.id));
  const callAgentIds = new Set(props.filteredCalls.map((call) => call.agentId).filter(Boolean));
  return Array.from(callAgentIds).filter((agentId) => !activeAgentIds.has(agentId)).length;
});

const allAgentOutcomeStats = computed(() =>
  props.agentDirectory.reduce(
    (stats, agent) => ({
      passed: stats.passed + Number(agent.passedCallCount || 0),
      failed: stats.failed + Number(agent.failedCallCount || 0),
      analyzed: stats.analyzed + Number(agent.totalAnalyzedCalls || agent.analyzedCallCount || 0)
    }),
    { passed: 0, failed: 0, analyzed: 0 }
  )
);

function callAnalysis(call) {
  return analysisByCallId.value.get(call.id) ?? {
    status: call.llmAnalysisStatus,
    stage: call.llmStage,
    score: call.llmScore,
    outcome: call.llmOutcome || call.outcome,
    summary: call.llmSummary,
    parameterResults: call.llmParameterResults
  };
}

function analysisLabel(analysis) {
  const outcome = callOutcome(analysis);
  if (outcome === 'passed') return 'Passed';
  if (outcome === 'failed') return 'Failed';

  const stage = analysis?.stage || '';
  const status = analysis?.status || '';
  const labels = {
    analysis_pending: 'Queued',
    analysis_running: 'Running',
    waiting_for_call_log: 'Waiting for call',
    waiting_for_transcript: 'Waiting for transcript',
    missing_parameters: 'Missing parameters',
    analysis_failed: 'Failed',
    healthy: 'Passed',
    monitor: 'Monitor',
    needs_review: 'Needs review',
    script_training: 'Script training'
  };

  return labels[stage] || labels[status] || (status ? status.replace(/_/g, ' ') : 'Not analyzed');
}

function analysisClass(analysis) {
  const outcome = callOutcome(analysis);
  const stage = analysis?.stage || '';
  const status = analysis?.status || '';

  if (outcome === 'passed') return 'healthy';
  if (outcome === 'failed') return 'attention';
  if (status === 'failed' || stage === 'analysis_failed') return 'failed';
  if (status === 'queued' || status === 'running' || status === 'retrying') return 'active';
  if (stage === 'missing_parameters') return 'muted';
  return 'monitor';
}

function analysisScore(analysis, fallbackScore) {
  if (analysis?.score !== null && analysis?.score !== undefined) return analysis.score;
  return fallbackScore;
}

function callOutcome(analysis) {
  if (analysis?.outcome && analysis.outcome !== 'pending') return analysis.outcome;
  const score = Number(analysis?.score);
  if (!Number.isFinite(score)) return 'pending';
  return score >= PASSING_SCORE ? 'passed' : 'failed';
}

function agentOutcomeCopy(agent) {
  const analyzed = Number(agent.totalAnalyzedCalls || agent.analyzedCallCount || 0);
  if (!analyzed) return `${agent.callCount || 0} calls`;
  return `${agent.passedCallCount || 0} passed / ${agent.failedCallCount || 0} failed`;
}
</script>

<template>
  <section class="calls-page">
    <div class="workspace-list-heading">
      <div>
        <p class="eyebrow">Monitor</p>
        <h2>Call timeline</h2>
      </div>
      <div class="workspace-heading-actions">
        <span>{{ filteredCalls.length }} calls</span>
      </div>
    </div>

    <p v-if="callOnlyAgentCount > 0" class="call-history-note">
      {{ callOnlyAgentCount }} deleted or unavailable agent{{ callOnlyAgentCount === 1 ? '' : 's' }} still appear in historical HighLevel call logs.
    </p>

    <div class="call-agent-tabs" aria-label="Filter calls by agent">
      <button
        class="call-agent-tab"
        :class="{ active: selectedAgent === 'all' }"
        type="button"
        @click="$emit('select-agent', 'all')"
      >
        <span>
          <strong>All agents</strong>
          <small v-if="allAgentOutcomeStats.analyzed">
            {{ allAgentOutcomeStats.passed }} passed / {{ allAgentOutcomeStats.failed }} failed
          </small>
          <small v-else>{{ totalCallCount }} calls</small>
        </span>
      </button>

      <button
        v-for="agent in agentDirectory"
        :key="agent.id"
        class="call-agent-tab"
        :class="{ active: selectedAgent === agent.id }"
        type="button"
        @click="$emit('select-agent', agent.id)"
      >
        <span>
          <strong>{{ agent.displayName }}</strong>
          <small>{{ agentOutcomeCopy(agent) }}</small>
        </span>
      </button>
    </div>

    <div class="call-directory">
      <article
        v-for="call in filteredCalls"
        :key="call.id"
        class="call-expander"
      >
        <button
          class="call-expander-button"
          type="button"
          @click="$emit('open-call', call.id)"
        >
          <span class="agent-score" :class="helpers.scoreClass(analysisScore(callAnalysis(call), call.score))">
            {{ helpers.formatScore(analysisScore(callAnalysis(call), call.score)) }}
          </span>
          <span class="call-title">
            <strong>{{ call.contactName }}</strong>
            <small>{{ helpers.displayAgentName(call.agentId, call.agentName) }}</small>
          </span>
          <span class="call-metrics">
            <span>
              <strong>{{ helpers.formatDuration(call.durationSeconds) }}</strong>
              <small>Duration</small>
            </span>
            <span>
              <strong>{{ callDetails(call.id).issues.length }}</strong>
              <small>Issues</small>
            </span>
            <span>
              <strong>{{ callDetails(call.id).transcriptTurns.length }}</strong>
              <small>Turns</small>
            </span>
            <span>
              <strong :class="`call-outcome-label ${analysisClass(callAnalysis(call))}`">
                {{ analysisLabel(callAnalysis(call)) }}
              </strong>
              <small>LLM outcome</small>
            </span>
          </span>
          <ArrowRight class="expand-icon" :size="18" />
        </button>
      </article>

      <p v-if="filteredCalls.length === 0" class="empty-copy">
        No calls match the current filters.
      </p>
    </div>
  </section>
</template>
