<script setup>
import { ArrowRight, CheckCircle2, Search, Settings2, Trash2, UserRound, X } from '@lucide/vue';
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

const activeActionTab = ref('customer');
const searchQuery = ref('');

const actionBuckets = computed(() => {
  const buckets = {
    customer: [],
    system: []
  };

  for (const action of props.actions) {
    buckets[actionCategory(action)].push(action);
  }

  return {
    customer: sortActions(buckets.customer),
    system: sortActions(buckets.system)
  };
});

const selectedActions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const actions = actionBuckets.value[activeActionTab.value] ?? [];
  if (!query) return actions;

  return actions.filter((action) =>
    [
      action.title,
      action.reason,
      action.suggestion,
      action.snippet,
      action.contactName,
      action.agentName,
      action.type,
      action.targetType
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  );
});

const actionStats = computed(() => ({
  critical: props.actions.filter((action) => action.severity === 'critical').length,
  customer: actionBuckets.value.customer.length,
  system: actionBuckets.value.system.length
}));

function normalizeType(type) {
  return String(type || '').toLowerCase();
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

function actionCategory(action) {
  if (['customer', 'system'].includes(action?.category)) return action.category;
  if (action?.targetType === 'human_follow_up' || normalizeType(action?.type).includes('follow')) return 'customer';
  return 'system';
}

function actionCategoryLabel(category) {
  return category === 'customer' ? 'Customer follow-up' : 'System improvements';
}

function actionPrimaryLabel(action) {
  return actionCategory(action) === 'customer' ? 'Done' : 'Apply';
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
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
}
</script>

<template>
  <section class="actions-page">
    <header class="workspace-list-heading">
      <div>
        <p class="eyebrow">Human actions</p>
        <h2>Action queue</h2>
        <p>
          Review customer follow-ups separately from system improvements, so the queue stays usable as call volume grows.
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
        <span>Customer</span>
        <strong>{{ actionStats.customer }}</strong>
        <small>follow-up queue</small>
      </article>
      <article>
        <span>System</span>
        <strong>{{ actionStats.system }}</strong>
        <small>improvement queue</small>
      </article>
      <article>
        <span>Critical</span>
        <strong>{{ actionStats.critical }}</strong>
        <small>needs priority</small>
      </article>
    </section>

    <section class="action-workbench">
      <div class="action-tab-row" role="tablist" aria-label="Action categories">
        <button
          class="action-category-tab"
          :class="{ active: activeActionTab === 'customer' }"
          type="button"
          role="tab"
          :aria-selected="activeActionTab === 'customer'"
          @click="activeActionTab = 'customer'"
        >
          <UserRound :size="17" />
          <span>Customer</span>
          <small>{{ actionBuckets.customer.length }}</small>
        </button>

        <button
          class="action-category-tab"
          :class="{ active: activeActionTab === 'system' }"
          type="button"
          role="tab"
          :aria-selected="activeActionTab === 'system'"
          @click="activeActionTab = 'system'"
        >
          <Settings2 :size="17" />
          <span>System</span>
          <small>{{ actionBuckets.system.length }}</small>
        </button>
      </div>

      <div class="action-queue-panel">
        <div class="action-queue-toolbar">
          <div>
            <p class="eyebrow">{{ actionCategoryLabel(activeActionTab) }}</p>
            <h3>{{ selectedActions.length }} matching actions</h3>
          </div>

          <label class="action-search">
            <Search :size="17" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search contact, agent, action, or suggestion"
              aria-label="Search actions"
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
            class="human-action-row compact"
            :class="actionCategory(action)"
          >
            <span class="severity-dot" :class="action.severity"></span>

            <div class="human-action-main">
              <div class="human-action-topline">
                <span>{{ actionTypeLabel(action.type) }}</span>
                <small>{{ action.source === 'llm' ? 'LLM suggested' : 'Rule suggested' }}</small>
                <small>{{ helpers.formatDate(action.createdAt) }}</small>
              </div>
              <h3>{{ action.title || action.reason }}</h3>
              <p v-if="action.title">{{ action.reason }}</p>
              <div v-if="action.suggestion" class="action-suggestion-box compact">
                <span>{{ actionCategory(action) === 'customer' ? 'Customer action' : 'System change' }}</span>
                <p>{{ action.suggestion }}</p>
              </div>
              <p v-if="action.snippet" class="action-snippet compact">{{ action.snippet }}</p>
              <div class="human-action-meta">
                <span>{{ action.contactName || 'Unknown contact' }}</span>
                <span>{{ helpers.displayAgentName(action.agentId, action.agentName) }}</span>
              </div>
            </div>

            <div class="human-action-buttons">
              <button class="text-button compact" type="button" @click="$emit('show-call', action.callId)">
                Open call
                <ArrowRight :size="14" />
              </button>
              <button class="text-button compact" type="button" @click="$emit('show-agent-review', action.agentId)">
                Agent
              </button>
              <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'done' })">
                {{ actionPrimaryLabel(action) }}
              </button>
              <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'dismissed' })">
                Ignore
              </button>
              <button class="icon-button danger" type="button" :aria-label="`Delete action ${action.id}`" @click="$emit('delete-action', action)">
                <Trash2 :size="15" />
              </button>
            </div>
          </article>

          <section v-if="selectedActions.length === 0" class="empty-directory action-empty-state">
            <CheckCircle2 :size="26" />
            <h3>No {{ activeActionTab }} actions found</h3>
            <p v-if="searchQuery">No open actions match the current search.</p>
            <p v-else>
              {{
                activeActionTab === 'customer'
                  ? 'Customer callbacks, escalations, and requested follow-ups will appear here.'
                  : 'Prompt, agent profile, script training, and parameter updates will appear here.'
              }}
            </p>
          </section>
        </div>
      </div>
    </section>
  </section>
</template>
