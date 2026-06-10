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

const systemImprovements = computed(() => props.selectedAgentPanel.useActions ?? []);

function improvementTypeLabel(type) {
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
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">System improvements</p>
        <h3>Agent-level review queue</h3>
        <p>
          Prompt, profile, script-training, and observability-parameter changes suggested from analyzed calls.
        </p>
      </div>
      <span class="section-count-pill">{{ systemImprovements.length }} open</span>
    </header>

    <div class="review-action-list">
      <article v-for="action in systemImprovements" :key="action.id" class="agent-action-review-card">
        <span class="severity-dot" :class="action.severity"></span>
        <div>
          <strong>{{ action.title || improvementTypeLabel(action.type) }}</strong>
          <small>
            {{ improvementTypeLabel(action.type) }} - {{ targetTypeLabel(action.targetType) }} -
            {{ action.sourceCallCount || action.sourceCallIds?.length || 1 }} source calls
          </small>
          <p>{{ action.reason }}</p>
          <div v-if="action.suggestion" class="action-suggestion-box">
            <span>Suggested system change</span>
            <p>{{ action.suggestion }}</p>
          </div>
          <p v-if="action.snippet" class="action-snippet">{{ action.snippet }}</p>
          <div class="inline-action-buttons">
            <button v-if="action.callId" class="text-button compact" type="button" @click="$emit('show-call', action.callId)">
              Source call
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
        </div>
      </article>

      <section v-if="systemImprovements.length === 0" class="parameter-empty-state compact">
        <span>No improvements</span>
        <h4>No system improvements suggested yet</h4>
        <p>When repeated call analysis suggests a prompt, profile, or parameter change, it will appear here.</p>
      </section>
    </div>
  </section>
</template>
