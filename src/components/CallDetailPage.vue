<script setup>
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ListChecks,
  MessageSquareText,
  MinusCircle,
  RefreshCw,
  Settings2,
  Trash2,
  UserRound,
  XCircle,
  CircleHelp
} from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps({
  analyzing: {
    type: Boolean,
    default: false
  },
  call: {
    type: Object,
    required: true
  },
  callAnalysis: {
    type: Object,
    default: null
  },
  callDetails: {
    type: Object,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  }
});

defineEmits(['analyze-call', 'back-to-calls', 'delete-action', 'update-action-status']);

const activeTab = ref('summary');

const tabs = computed(() => [
  { id: 'summary', label: 'LLM summary', icon: MessageSquareText },
  { id: 'parameters', label: 'Parameters summary', icon: ListChecks },
  { id: 'actions', label: 'Actions', icon: ClipboardCheck, count: props.callDetails.useActions.length },
  { id: 'transcript', label: 'Transcript', icon: FileText, count: props.callDetails.transcriptTurns.length }
]);

const analysis = computed(() => props.callAnalysis ?? {});
const customerActions = computed(() => props.callDetails.useActions.filter((action) => actionCategory(action) === 'customer'));
const systemActions = computed(() => props.callDetails.useActions.filter((action) => actionCategory(action) === 'system'));

function analysisLabel(value) {
  const stage = value?.stage || '';
  const status = value?.status || '';
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

  return labels[stage] || labels[status] || (status ? status.replace(/_/g, ' ') : 'Not analyzed');
}

function analysisClass(value) {
  const stage = value?.stage || '';
  const status = value?.status || '';

  if (status === 'failed' || stage === 'analysis_failed') return 'failed';
  if (status === 'queued' || status === 'running' || status === 'retrying') return 'active';
  if (stage === 'healthy') return 'healthy';
  if (stage === 'human_follow_up' || stage === 'script_training' || stage === 'needs_review') return 'attention';
  if (stage === 'missing_parameters') return 'muted';
  return 'monitor';
}

function analysisScore(value, fallbackScore = null) {
  if (value?.score !== null && value?.score !== undefined) return value.score;
  return fallbackScore;
}

function parameterStatusIcon(status) {
  const icons = {
    passed: CheckCircle2,
    failed: XCircle,
    not_applicable: MinusCircle,
    unknown: CircleHelp
  };

  return icons[status] ?? CircleHelp;
}

function parameterStatusLabel(status) {
  const labels = {
    passed: 'Passed',
    failed: 'Failed',
    not_applicable: 'Not applicable',
    unknown: 'Unknown'
  };

  return labels[status] ?? 'Unknown';
}

function actionTypeLabel(type) {
  const labels = {
    human_review: 'Human review',
    script_training: 'Script training',
    follow_up: 'Follow-up',
    prompt_update: 'Prompt update',
    parameter_update: 'Parameter update'
  };

  return labels[type] ?? type ?? 'Human review';
}

function targetTypeLabel(type) {
  const labels = {
    agent_profile: 'Agent profile',
    observability_parameter: 'Observability parameter',
    human_follow_up: 'Human follow-up'
  };

  return labels[type] ?? 'Human follow-up';
}

function actionCategory(action) {
  if (['customer', 'system'].includes(action?.category)) return action.category;
  if (action?.targetType === 'human_follow_up' || action?.type === 'follow_up') return 'customer';
  return 'system';
}
</script>

<template>
  <section class="call-detail-page">
    <button class="agent-back-button" type="button" @click="$emit('back-to-calls')">
      <ArrowLeft :size="17" />
      <span>Calls</span>
    </button>

    <header class="call-detail-hero">
      <span class="agent-score large" :class="helpers.scoreClass(analysisScore(analysis, call.score))">
        {{ helpers.formatScore(analysisScore(analysis, call.score)) }}
      </span>
      <div class="agent-detail-title">
        <p class="eyebrow">Voice AI call</p>
        <h2>{{ call.contactName }}</h2>
        <small>{{ helpers.displayAgentName(call.agentId, call.agentName) }} - {{ helpers.formatDate(call.createdAt) }}</small>
      </div>
      <button class="text-button compact" type="button" :disabled="analyzing" @click="$emit('analyze-call', call)">
        <RefreshCw :size="15" />
        <span>{{ analyzing ? 'Analyzing' : analysis.status ? 'Analyze again' : 'Analyze call' }}</span>
      </button>
    </header>

    <nav class="agent-page-tabs" aria-label="Call sections">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
        <small v-if="tab.count !== undefined">{{ tab.count }}</small>
      </button>
    </nav>

    <section class="agent-detail-content call-detail-content">
      <section v-if="activeTab === 'summary'" class="call-tab-panel">
        <div class="analysis-detail-block prominent" :class="analysisClass(analysis)">
          <span>{{ analysisLabel(analysis) }}</span>
          <strong>{{ helpers.formatScore(analysisScore(analysis, null)) }}</strong>
          <p>
            {{ call.llmSummary || analysis.summary || analysis.errorMessage || 'Run analysis to generate an LLM review for this call.' }}
          </p>
          <small v-if="analysis.nextRetryAt">
            Next retry {{ helpers.formatDate(analysis.nextRetryAt) }}
          </small>
        </div>

        <div class="call-summary-grid">
          <section class="agent-subsection">
            <p class="eyebrow">Call summary</p>
            <p>{{ call.summary || 'No HighLevel summary available yet.' }}</p>
          </section>

          <section class="agent-subsection">
            <p class="eyebrow">Call metadata</p>
            <div class="agent-detail-list">
              <div>
                <span>Status</span>
                <strong>{{ helpers.formatStatus(call.status) }}</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>{{ helpers.formatDuration(call.durationSeconds) }}</strong>
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
        </div>
      </section>

      <section v-else-if="activeTab === 'parameters'" class="call-tab-panel">
        <div class="call-cell-heading">
          <div>
            <p class="eyebrow">Parameter results</p>
            <h3>Observability checklist</h3>
          </div>
          <span class="section-count-pill">{{ (analysis.parameterResults || []).length }} checks</span>
        </div>

        <div class="parameter-result-list modern">
          <article
            v-for="result in analysis.parameterResults || []"
            :key="result.parameterId"
            :class="result.status"
          >
            <span class="parameter-status-icon">
              <component :is="parameterStatusIcon(result.status)" :size="18" />
            </span>
            <div>
              <div class="parameter-result-title">
                <strong>{{ result.title }}</strong>
                <small>{{ parameterStatusLabel(result.status) }} - {{ result.confidence || 'medium' }} confidence</small>
              </div>
              <p>{{ result.reasoningSummary || result.evidence || 'No reasoning was returned for this parameter.' }}</p>
              <blockquote v-if="result.evidence">{{ result.evidence }}</blockquote>
            </div>
          </article>

          <section v-if="!(analysis.parameterResults || []).length" class="parameter-empty-state compact">
            <span>Not analyzed</span>
            <h4>No parameter results yet</h4>
            <p>Run analysis after attaching observability parameters to this agent.</p>
          </section>
        </div>
      </section>

      <section v-else-if="activeTab === 'actions'" class="call-tab-panel">
        <div class="call-cell-heading">
          <div>
            <p class="eyebrow">Actions & suggestions</p>
            <h3>Review queue</h3>
          </div>
          <span class="section-count-pill">{{ callDetails.useActions.length }} open</span>
        </div>

        <div class="call-action-overview">
          <article>
            <span class="action-lane-icon customer"><UserRound :size="18" /></span>
            <div>
              <strong>{{ customerActions.length }}</strong>
              <small>Customer follow-up</small>
            </div>
          </article>
          <article>
            <span class="action-lane-icon system"><Settings2 :size="18" /></span>
            <div>
              <strong>{{ systemActions.length }}</strong>
              <small>System improvements</small>
            </div>
          </article>
        </div>

        <div v-if="callDetails.useActions.length > 0" class="call-action-lanes">
          <section class="action-lane customer">
            <header>
              <span class="action-lane-icon customer"><UserRound :size="18" /></span>
              <div>
                <h4>Customer follow-up</h4>
                <p>Caller-facing work such as callbacks, unanswered questions, escalations, or requested information.</p>
              </div>
            </header>

            <div class="call-action-list grouped">
              <article v-for="action in customerActions" :key="action.id" class="call-action-card customer">
                <div class="call-action-card-main">
                  <div class="call-action-topline">
                    <span class="severity-dot" :class="action.severity"></span>
                    <strong>{{ action.title || actionTypeLabel(action.type) }}</strong>
                    <small>{{ actionTypeLabel(action.type) }} - {{ targetTypeLabel(action.targetType) }}</small>
                  </div>
                  <p>{{ action.reason }}</p>
                  <div v-if="action.suggestion" class="action-suggestion-box">
                    <span>Suggested customer action</span>
                    <p>{{ action.suggestion }}</p>
                  </div>
                  <blockquote v-if="action.snippet">{{ action.snippet }}</blockquote>
                </div>

                <div class="call-action-buttons">
                  <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'done' })">
                    Done
                  </button>
                  <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'dismissed' })">
                    Ignore
                  </button>
                  <button
                    class="icon-button danger"
                    type="button"
                    :aria-label="`Delete action ${action.title || action.type}`"
                    @click="$emit('delete-action', action)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
              </article>

              <section v-if="customerActions.length === 0" class="lane-empty-state">
                <span>No customer follow-up</span>
                <p>Nothing from this call needs a customer-facing response right now.</p>
              </section>
            </div>
          </section>

          <section class="action-lane system">
            <header>
              <span class="action-lane-icon system"><Settings2 :size="18" /></span>
              <div>
                <h4>System improvements</h4>
                <p>Internal changes such as prompt updates, agent profile edits, script training, or parameter tuning.</p>
              </div>
            </header>

            <div class="call-action-list grouped">
              <article v-for="action in systemActions" :key="action.id" class="call-action-card system">
                <div class="call-action-card-main">
                  <div class="call-action-topline">
                    <span class="severity-dot" :class="action.severity"></span>
                    <strong>{{ action.title || actionTypeLabel(action.type) }}</strong>
                    <small>{{ actionTypeLabel(action.type) }} - {{ targetTypeLabel(action.targetType) }}</small>
                  </div>
                  <p>{{ action.reason }}</p>
                  <div v-if="action.suggestion" class="action-suggestion-box">
                    <span>Suggested system change</span>
                    <p>{{ action.suggestion }}</p>
                  </div>
                  <blockquote v-if="action.snippet">{{ action.snippet }}</blockquote>
                </div>

                <div class="call-action-buttons">
                  <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'done' })">
                    Apply
                  </button>
                  <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'dismissed' })">
                    Ignore
                  </button>
                  <button
                    class="icon-button danger"
                    type="button"
                    :aria-label="`Delete action ${action.title || action.type}`"
                    @click="$emit('delete-action', action)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
              </article>

              <section v-if="systemActions.length === 0" class="lane-empty-state">
                <span>No system changes</span>
                <p>No prompt, agent profile, script, or parameter updates were suggested from this call.</p>
              </section>
            </div>
          </section>
        </div>

        <section v-else class="parameter-empty-state compact">
          <span>No actions</span>
          <h4>No human action suggested for this call</h4>
          <p>If every attached parameter passes, this tab stays empty.</p>
        </section>
      </section>

      <section v-else class="call-tab-panel">
        <div class="panel-heading compact">
          <div>
            <p class="eyebrow">Transcript</p>
            <h2>{{ call.contactName }}</h2>
          </div>
          <span class="panel-meta">{{ callDetails.transcriptTurns.length }} turns</span>
        </div>

        <div class="transcript-list page">
          <article
            v-for="turn in callDetails.transcriptTurns"
            :key="turn.id"
            class="transcript-turn"
            :class="helpers.speakerClass(turn.speaker)"
          >
            <span>{{ helpers.formatSpeaker(turn.speaker) }}</span>
            <p>{{ turn.text }}</p>
          </article>

          <p v-if="callDetails.transcriptTurns.length === 0" class="empty-copy">
            Transcript is not available for this call yet.
          </p>
        </div>
      </section>
    </section>
  </section>
</template>
