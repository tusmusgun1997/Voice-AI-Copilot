<script setup>
import { ArrowRight, CheckCircle2, Search, Settings2, Trash2, X } from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps({
  actions: {
    type: Array,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  },
  selectedAgentName: {
    type: String,
    required: true
  }
});

defineEmits(['delete-action', 'show-agent-review', 'show-call', 'update-action-status']);

const searchQuery = ref('');

const selectedActions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const actions = sortActions(props.actions);
  if (!query) return actions;

  return actions.filter((action) =>
    [
      action.title,
      action.reason,
      action.suggestion,
      action.snippet,
      action.agentName,
      action.type,
      action.targetType,
      ...(action.sourceCalls ?? []).map((call) => call.contactName)
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  );
});

const actionStats = computed(() => ({
  critical: props.actions.filter((action) => action.severity === 'critical').length,
  prompt: props.actions.filter((action) => ['prompt_update', 'agent_profile_update'].includes(action.type)).length,
  parameters: props.actions.filter((action) => ['parameter_update', 'parameter_create', 'parameter_version_change'].includes(action.type)).length
}));

function actionTypeLabel(type) {
  const labels = {
    prompt_update: 'Prompt update',
    agent_profile_update: 'Agent profile update',
    script_training: 'Script training',
    parameter_update: 'Parameter update',
    parameter_create: 'New parameter',
    parameter_version_change: 'Parameter version change'
  };

  return labels[type] ?? type ?? 'System improvement';
}

function targetTypeLabel(type) {
  const labels = {
    agent_profile: 'Agent profile',
    observability_parameter: 'Observability parameter'
  };

  return labels[type] ?? 'Agent setup';
}

function sortActions(actions) {
  const severityOrder = {
    critical: 0,
    warning: 1,
    info: 2
  };

  return actions
    .slice()
    .sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3) ||
        new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    );
}
</script>

<template>
  <section class="actions-page">
    <header class="workspace-list-heading">
      <div>
        <p class="eyebrow">Agent system improvements</p>
        <h2>Improvement queue</h2>
        <p>
          Review prompt, profile, script-training, and observability-parameter changes suggested from analyzed calls.
        </p>
      </div>
      <span>{{ actions.length }} open</span>
    </header>

    <section class="action-summary-strip">
      <article>
        <span>Total</span>
        <strong>{{ actions.length }}</strong>
        <small>{{ selectedAgentName }}</small>
      </article>
      <article>
        <span>Prompt/Profile</span>
        <strong>{{ actionStats.prompt }}</strong>
        <small>agent setup</small>
      </article>
      <article>
        <span>Parameters</span>
        <strong>{{ actionStats.parameters }}</strong>
        <small>observability setup</small>
      </article>
      <article>
        <span>Critical</span>
        <strong>{{ actionStats.critical }}</strong>
        <small>needs priority</small>
      </article>
    </section>

    <section class="action-workbench single">
      <div class="action-queue-panel">
        <div class="action-queue-toolbar">
          <div>
            <p class="eyebrow">System improvements</p>
            <h3>{{ selectedActions.length }} matching items</h3>
          </div>

          <label class="action-search">
            <Search :size="17" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search agent, improvement, or suggestion"
              aria-label="Search system improvements"
            />
            <button v-if="searchQuery" type="button" aria-label="Clear search" @click="searchQuery = ''">
              <X :size="15" />
            </button>
          </label>
        </div>

        <div class="human-action-list compact">
          <article
            v-for="action in selectedActions"
            :key="action.id"
            class="human-action-row compact system"
          >
            <span class="severity-dot" :class="action.severity"></span>

            <div class="human-action-main">
              <div class="human-action-topline">
                <span>{{ actionTypeLabel(action.type) }}</span>
                <small>{{ targetTypeLabel(action.targetType) }}</small>
                <small>{{ action.sourceCallCount || action.sourceCallIds?.length || 1 }} source calls</small>
                <small>{{ helpers.formatDate(action.updatedAt || action.createdAt) }}</small>
              </div>
              <h3>{{ action.title || action.reason }}</h3>
              <p v-if="action.title">{{ action.reason }}</p>
              <div v-if="action.suggestion" class="action-suggestion-box compact">
                <span>Suggested system change</span>
                <p>{{ action.suggestion }}</p>
              </div>
              <p v-if="action.snippet" class="action-snippet compact">{{ action.snippet }}</p>
              <div class="human-action-meta">
                <span>{{ helpers.displayAgentName(action.agentId, action.agentName) }}</span>
                <span>{{ action.parameterId || 'Agent-level' }}</span>
              </div>
            </div>

            <div class="human-action-buttons">
              <button v-if="action.callId" class="text-button compact" type="button" @click="$emit('show-call', action.callId)">
                Source call
                <ArrowRight :size="14" />
              </button>
              <button class="text-button compact" type="button" @click="$emit('show-agent-review', action.agentId)">
                Agent
              </button>
              <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'done' })">
                Apply
              </button>
              <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'dismissed' })">
                Ignore
              </button>
              <button class="icon-button danger" type="button" :aria-label="`Delete system improvement ${action.id}`" @click="$emit('delete-action', action)">
                <Trash2 :size="15" />
              </button>
            </div>
          </article>

          <section v-if="selectedActions.length === 0" class="empty-directory action-empty-state">
            <CheckCircle2 :size="26" />
            <h3>No system improvements found</h3>
            <p v-if="searchQuery">No open improvements match the current search.</p>
            <p v-else>Prompt, agent profile, script-training, and parameter improvements will appear here after call analysis.</p>
          </section>
        </div>
      </div>
    </section>
  </section>
</template>
