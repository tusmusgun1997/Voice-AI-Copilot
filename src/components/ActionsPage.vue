<script setup>
import { ArrowRight, CheckCircle2 } from '@lucide/vue';
import { computed } from 'vue';

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

defineEmits(['show-agent-review', 'show-call']);

const actionStats = computed(() => {
  const critical = props.actions.filter((action) => action.severity === 'critical').length;
  const followUps = props.actions.filter((action) => normalizeType(action.type).includes('follow')).length;
  const training = props.actions.filter((action) => normalizeType(action.type).includes('training')).length;

  return {
    critical,
    followUps,
    training
  };
});

function normalizeType(type) {
  return String(type || '').toLowerCase();
}
</script>

<template>
  <section class="actions-page">
    <header class="workspace-list-heading">
      <div>
        <p class="eyebrow">Human actions</p>
        <h2>Action queue</h2>
        <p>
          LLM-suggested follow-ups, caller requests, callbacks, and training actions that need a person to review.
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
        <span>Critical</span>
        <strong>{{ actionStats.critical }}</strong>
        <small>needs priority</small>
      </article>
      <article>
        <span>Follow-up</span>
        <strong>{{ actionStats.followUps }}</strong>
        <small>caller-facing</small>
      </article>
      <article>
        <span>Training</span>
        <strong>{{ actionStats.training }}</strong>
        <small>script coaching</small>
      </article>
    </section>

    <div class="human-action-list">
      <article v-for="action in actions" :key="action.id" class="human-action-row">
        <span class="severity-dot" :class="action.severity"></span>

        <div class="human-action-main">
          <div class="human-action-topline">
            <span>{{ action.type || 'Human review' }}</span>
            <small>{{ action.source === 'llm' ? 'LLM suggested' : 'Rule suggested' }}</small>
          </div>
          <h3>{{ action.reason }}</h3>
          <p v-if="action.snippet">{{ action.snippet }}</p>
          <div class="human-action-meta">
            <span>{{ action.contactName || 'Unknown contact' }}</span>
            <span>{{ helpers.displayAgentName(action.agentId, action.agentName) }}</span>
            <span>{{ helpers.formatDate(action.createdAt) }}</span>
          </div>
        </div>

        <div class="human-action-buttons">
          <button class="text-button compact" type="button" @click="$emit('show-call', action.callId)">
            Open call
            <ArrowRight :size="14" />
          </button>
          <button class="text-button compact" type="button" @click="$emit('show-agent-review', action.agentId)">
            Agent review
          </button>
        </div>
      </article>

      <section v-if="actions.length === 0" class="empty-directory action-empty-state">
        <CheckCircle2 :size="26" />
        <h3>No human actions right now</h3>
        <p>When the LLM finds a caller request, callback need, escalation, or script training item, it will appear here.</p>
      </section>
    </div>
  </section>
</template>
