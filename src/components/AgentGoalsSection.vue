<script setup>
import { ExternalLink } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps({
  selectedAgentPanel: {
    type: Object,
    required: true
  }
});

const goals = computed(() => props.selectedAgentPanel.actions ?? []);

function formatGoalType(type) {
  return String(type || 'Goal')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function goalDescription(goal) {
  return (
    goal?.actionParameters?.description ||
    goal?.actionParameters?.triggerPrompt ||
    goal?.actionParameters?.message ||
    goal?.actionParameters?.stopBotTriggerCondition ||
    'No goal description is configured in HighLevel.'
  );
}

function goalExamples(goal) {
  const parameters = goal?.actionParameters ?? {};
  return [
    ...(Array.isArray(parameters.examples) ? parameters.examples : []),
    ...(Array.isArray(parameters.stopBotExamples) ? parameters.stopBotExamples : []),
    ...(Array.isArray(parameters.contactUpdateExamples) ? parameters.contactUpdateExamples : [])
  ].filter(Boolean);
}

function formatBoolean(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not set';
}
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">HighLevel goals</p>
        <h3>Agent goals configured in HighLevel</h3>
      </div>
      <span class="section-count-pill">{{ goals.length }} goals</span>
    </header>

    <div v-if="goals.length" class="highlevel-goal-list">
      <article v-for="goal in goals" :key="goal.id" class="highlevel-goal-card">
        <div class="highlevel-goal-card-head">
          <div>
            <span>{{ formatGoalType(goal.actionType) }}</span>
            <h4>{{ goal.name || 'Unnamed goal' }}</h4>
          </div>
          <small>{{ goal.id }}</small>
        </div>

        <p>{{ goalDescription(goal) }}</p>

        <div class="goal-detail-grid">
          <div v-if="goal.actionParameters?.contactFieldId">
            <span>Contact field</span>
            <strong>{{ goal.actionParameters.contactFieldId }}</strong>
          </div>
          <div v-if="goal.actionParameters?.calendarId">
            <span>Calendar</span>
            <strong>{{ goal.actionParameters.calendarId }}</strong>
          </div>
          <div v-if="'overwriteExistingValue' in (goal.actionParameters ?? {})">
            <span>Overwrite existing value</span>
            <strong>{{ formatBoolean(goal.actionParameters.overwriteExistingValue) }}</strong>
          </div>
          <div v-if="'triggerWorkflow' in (goal.actionParameters ?? {})">
            <span>Trigger workflow</span>
            <strong>{{ formatBoolean(goal.actionParameters.triggerWorkflow) }}</strong>
          </div>
          <div v-if="goal.actionParameters?.workflowIds?.length">
            <span>Workflows</span>
            <strong>{{ goal.actionParameters.workflowIds.join(', ') }}</strong>
          </div>
        </div>

        <div v-if="goalExamples(goal).length" class="goal-example-row">
          <span>Examples</span>
          <div>
            <small v-for="example in goalExamples(goal)" :key="example">{{ example }}</small>
          </div>
        </div>
      </article>
    </div>

    <section v-else class="parameter-empty-state compact">
      <ExternalLink :size="18" />
      <span>None found</span>
      <h4>No HighLevel goals returned for this agent</h4>
      <p>Add goals/actions in HighLevel Voice AI, then refresh this page.</p>
    </section>
  </section>
</template>
