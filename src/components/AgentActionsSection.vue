<script setup>
import { Trash2 } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps({
  helpers: {
    type: Object,
    required: true
  },
  selectedAgentPanel: {
    type: Object,
    required: true
  }
});

defineEmits(['delete-action', 'show-call', 'update-action-status']);

const humanActions = computed(() =>
  (props.selectedAgentPanel.useActions ?? []).filter((action) => action.source === 'llm')
);

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
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">Actions</p>
        <h3>Human follow-up queue</h3>
        <p>
          Caller requests, callbacks, escalations, and script-training actions suggested by the LLM.
        </p>
      </div>
      <span class="section-count-pill">{{ humanActions.length }} open</span>
    </header>

    <div class="review-action-list">
      <article v-for="action in humanActions" :key="action.id" class="agent-action-review-card">
        <span class="severity-dot" :class="action.severity"></span>
        <div>
          <strong>{{ action.title || actionTypeLabel(action.type) }}</strong>
          <small>
            {{ actionTypeLabel(action.type) }} - {{ action.contactName || 'Call review' }} - {{ helpers.formatDate(action.createdAt) }}
          </small>
          <p>{{ action.reason }}</p>
          <div v-if="action.suggestion" class="action-suggestion-box">
            <span>Suggestion for human decision</span>
            <p>{{ action.suggestion }}</p>
          </div>
          <p v-if="action.snippet" class="action-snippet">{{ action.snippet }}</p>
          <div class="inline-action-buttons">
            <button class="text-button compact" type="button" @click="$emit('show-call', action.callId)">
              Open call
            </button>
            <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'done' })">
              Apply
            </button>
            <button class="text-button compact" type="button" @click="$emit('update-action-status', { action, status: 'dismissed' })">
              Ignore
            </button>
            <button class="icon-button danger" type="button" :aria-label="`Delete action ${action.id}`" @click="$emit('delete-action', action)">
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
      </article>

      <section v-if="humanActions.length === 0" class="parameter-empty-state compact">
        <span>No actions</span>
        <h4>No LLM-suggested human actions yet</h4>
        <p>When a call needs a callback, escalation, or training follow-up, it will appear here.</p>
      </section>
    </div>
  </section>
</template>
