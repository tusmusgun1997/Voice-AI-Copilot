<script setup>
import { ChevronDown } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps({
  agentDirectory: {
    type: Array,
    required: true
  },
  analyzingCallIds: {
    type: Object,
    default: () => ({})
  },
  callDetails: {
    type: Function,
    required: true
  },
  expandedCallId: {
    type: String,
    default: ''
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

defineEmits(['analyze-call', 'select-agent', 'show-agent-recommendations', 'toggle-call']);

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

function callAnalysis(call) {
  return analysisByCallId.value.get(call.id) ?? {
    status: call.llmAnalysisStatus,
    stage: call.llmStage,
    score: call.llmScore,
    summary: call.llmSummary,
    parameterResults: call.llmParameterResults
  };
}

function analysisLabel(analysis) {
  const stage = analysis?.stage || '';
  const status = analysis?.status || '';
  const labels = {
    analysis_pending: 'Queued',
    analysis_running: 'Running',
    waiting_for_call_log: 'Waiting for call',
    waiting_for_transcript: 'Waiting for transcript',
    missing_parameters: 'Missing parameters',
    analysis_failed: 'Failed',
    healthy: 'Healthy',
    monitor: 'Monitor',
    needs_review: 'Needs review',
    human_follow_up: 'Human follow-up',
    script_training: 'Script training'
  };

  return labels[stage] || labels[status] || (status ? status.replace(/_/g, ' ') : 'Not queued');
}

function analysisClass(analysis) {
  const stage = analysis?.stage || '';
  const status = analysis?.status || '';

  if (status === 'failed' || stage === 'analysis_failed') return 'failed';
  if (status === 'queued' || status === 'running' || status === 'retrying') return 'active';
  if (stage === 'healthy') return 'healthy';
  if (stage === 'human_follow_up' || stage === 'script_training' || stage === 'needs_review') return 'attention';
  if (stage === 'missing_parameters') return 'muted';
  return 'monitor';
}

function analysisScore(analysis, fallbackScore) {
  if (analysis?.score !== null && analysis?.score !== undefined) return analysis.score;
  return fallbackScore;
}

function isActiveAnalysis(analysis) {
  return ['queued', 'running', 'retrying'].includes(analysis?.status);
}

function isCallAnalyzing(call) {
  return Boolean(props.analyzingCallIds?.[call.id]) || isActiveAnalysis(callAnalysis(call));
}

function targetTypeLabel(type) {
  const labels = {
    agent_profile: 'Agent profile',
    highlevel_goal: 'HighLevel goal',
    observability_parameter: 'Observability parameter'
  };

  return labels[type] ?? 'Observability parameter';
}

function targetActionLabel(recommendation) {
  const action = recommendation?.targetAction === 'add' ? 'Add' : 'Update';
  return `${action} ${targetTypeLabel(recommendation?.targetType).toLowerCase()}`;
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
          <small>{{ totalCallCount }}</small>
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
          <small>{{ agent.callCount }}</small>
        </span>
      </button>
    </div>

    <div class="call-directory">
      <article
        v-for="call in filteredCalls"
        :key="call.id"
        class="call-expander"
        :class="{ expanded: expandedCallId === call.id }"
      >
        <button
          class="call-expander-button"
          type="button"
          :aria-expanded="expandedCallId === call.id"
          @click="$emit('toggle-call', call.id)"
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
              <strong>{{ helpers.formatStatus(call.status) }}</strong>
              <small>Status</small>
            </span>
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
              <strong>{{ analysisLabel(callAnalysis(call)) }}</strong>
              <small>LLM</small>
            </span>
          </span>
          <ChevronDown class="expand-icon" :size="18" />
        </button>

        <div v-if="expandedCallId === call.id" class="call-expanded-content">
          <div class="call-detail-grid">
            <section class="call-detail-cell">
              <p class="eyebrow">Summary</p>
              <p>{{ call.summary || 'No call summary available yet.' }}</p>
              <div class="call-meta-list">
                <div>
                  <span>Goal profile</span>
                  <strong>{{ call.goalProfile.name }}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{{ helpers.formatDate(call.createdAt) }}</strong>
                </div>
                <div>
                  <span>Call ID</span>
                  <strong>{{ call.id }}</strong>
                </div>
              </div>
            </section>

            <section class="call-detail-cell">
              <div class="call-cell-heading">
                <p class="eyebrow">LLM Analysis</p>
                <button
                  class="text-button compact"
                  type="button"
                  :disabled="isCallAnalyzing(call)"
                  @click="$emit('analyze-call', call)"
                >
                  {{ isCallAnalyzing(call) ? 'Analyzing...' : callAnalysis(call).status ? 'Analyze again' : 'Analyze call' }}
                </button>
              </div>
              <div class="analysis-detail-block" :class="analysisClass(callAnalysis(call))">
                <span>{{ analysisLabel(callAnalysis(call)) }}</span>
                <strong>{{ helpers.formatScore(analysisScore(callAnalysis(call), null)) }}</strong>
                <p>
                  {{ call.llmSummary || callAnalysis(call).summary || callAnalysis(call).errorMessage || 'Waiting for the webhook analysis result.' }}
                </p>
                <small v-if="callAnalysis(call).nextRetryAt">
                  Next retry {{ helpers.formatDate(callAnalysis(call).nextRetryAt) }}
                </small>
              </div>
            </section>

            <section class="call-detail-cell">
              <p class="eyebrow">KPI Checks</p>
              <div class="criteria-pill-row compact">
                <span
                  v-for="criterion in call.criteria"
                  :key="criterion.id"
                  :class="{ passed: criterion.passed === true, failed: criterion.passed === false }"
                >
                  {{ criterion.label }}
                </span>
              </div>
            </section>

            <section class="call-detail-cell full-span">
              <p class="eyebrow">LLM Parameter Results</p>
              <div class="parameter-result-list">
                <article
                  v-for="result in callAnalysis(call).parameterResults || []"
                  :key="result.parameterId"
                  :class="result.status"
                >
                  <span>{{ result.status }}</span>
                  <div>
                    <strong>{{ result.title }}</strong>
                    <p>{{ result.reasoningSummary || result.evidence }}</p>
                    <small v-if="result.evidence">{{ result.evidence }}</small>
                  </div>
                </article>

                <p v-if="!(callAnalysis(call).parameterResults || []).length" class="empty-copy">
                  Parameter-level LLM results will appear after the webhook job finishes.
                </p>
              </div>
            </section>

            <section class="call-detail-cell full-span">
              <p class="eyebrow">Recommendations</p>
              <div class="call-recommendation-list">
                <article v-for="recommendation in callDetails(call.id).recommendations" :key="recommendation.id">
                  <div class="review-item-top">
                    <span class="severity-pill" :class="helpers.severityClass(recommendation.severity)">
                      {{ helpers.formatSeverity(recommendation.severity) }}
                    </span>
                    <small>{{ targetActionLabel(recommendation) }}</small>
                  </div>
                  <strong>{{ recommendation.title }}</strong>
                  <p>{{ recommendation.detail }}</p>
                  <div v-if="recommendation.suggestedChange || recommendation.promptPatch" class="review-suggestion">
                    <span>Suggested change for human review</span>
                    <p>{{ recommendation.suggestedChange || recommendation.promptPatch }}</p>
                  </div>
                  <div class="review-item-footer">
                    <span>Needs human review</span>
                    <button class="text-button compact" type="button" @click="$emit('show-agent-recommendations', call.agentId)">
                      Open agent review
                    </button>
                  </div>
                </article>

                <p v-if="callDetails(call.id).recommendations.length === 0" class="empty-copy">
                  No LLM recommendations are attached to this call yet.
                </p>
              </div>
            </section>

            <section class="call-detail-cell">
              <p class="eyebrow">Review Items</p>
              <div class="call-review-list">
                <article v-for="issue in callDetails(call.id).issues" :key="issue.id">
                  <span class="severity-pill" :class="helpers.severityClass(issue.severity)">
                    {{ helpers.formatSeverity(issue.severity) }}
                  </span>
                  <div>
                    <strong>{{ issue.label }}</strong>
                    <p>{{ issue.message }}</p>
                    <button class="text-button compact" type="button" @click="$emit('show-agent-recommendations', call.agentId)">
                      Open agent review
                    </button>
                  </div>
                </article>
                <p v-if="callDetails(call.id).issues.length === 0">No review issues for this call.</p>
              </div>
            </section>

            <section class="call-detail-cell">
              <p class="eyebrow">Use Actions</p>
              <div class="call-review-list">
                <article v-for="action in callDetails(call.id).useActions" :key="action.id">
                  <span class="severity-dot" :class="action.severity"></span>
                  <div>
                    <strong>{{ action.type }}</strong>
                    <p>{{ action.reason }}</p>
                    <button class="text-button compact" type="button" @click="$emit('show-agent-recommendations', call.agentId)">
                      Open agent review
                    </button>
                  </div>
                </article>
                <p v-if="callDetails(call.id).useActions.length === 0">No use actions for this call.</p>
              </div>
            </section>
          </div>

          <section class="transcript-panel">
            <div class="panel-heading compact">
              <div>
                <p class="eyebrow">Transcript</p>
                <h2>{{ call.contactName }}</h2>
              </div>
              <span class="panel-meta">{{ callDetails(call.id).transcriptTurns.length }} turns</span>
            </div>

            <div class="transcript-list">
              <article
                v-for="turn in callDetails(call.id).transcriptTurns"
                :key="turn.id"
                class="transcript-turn"
                :class="helpers.speakerClass(turn.speaker)"
              >
                <span>{{ helpers.formatSpeaker(turn.speaker) }}</span>
                <p>{{ turn.text }}</p>
              </article>

              <p v-if="callDetails(call.id).transcriptTurns.length === 0" class="empty-copy">
                Transcript is not available for this call yet.
              </p>
            </div>
          </section>
        </div>
      </article>

      <p v-if="filteredCalls.length === 0" class="empty-copy">
        No calls match the current filters.
      </p>
    </div>
  </section>
</template>
