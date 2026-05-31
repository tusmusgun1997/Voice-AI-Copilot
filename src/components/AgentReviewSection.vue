<script setup>
import { computed, ref, watch } from 'vue';

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

defineEmits(['open-agent-section', 'show-call']);

const activeGroupId = ref('observability_parameter');

const reviewGroups = computed(() => {
  const groups = [
    {
      id: 'agent_profile',
      label: 'Agent profile',
      description: 'Role, objective, welcome message, or prompt guidance that should be reviewed.',
      section: 'details',
      items: []
    },
    {
      id: 'highlevel_goal',
      label: 'HighLevel goals',
      description: 'Actions or data extraction goals that may need to be added or updated in HighLevel.',
      section: 'details',
      items: []
    },
    {
      id: 'observability_parameter',
      label: 'Observability parameters',
      description: 'Evaluation checks that may need to be added or clarified for future LLM review.',
      section: 'observability-parameters',
      items: []
    }
  ];
  const byId = new Map(groups.map((group) => [group.id, group]));

  for (const recommendation of props.selectedAgentPanel.recommendations ?? []) {
    const targetType = recommendation.targetType || 'observability_parameter';
    const group = byId.get(targetType) ?? byId.get('observability_parameter');
    group.items.push(recommendation);
  }

  return groups;
});

const activeReviewGroup = computed(
  () =>
    reviewGroups.value.find((group) => group.id === activeGroupId.value) ??
    reviewGroups.value.find((group) => group.items.length > 0) ??
    reviewGroups.value[0]
);

watch(
  reviewGroups,
  (groups) => {
    if (!groups.some((group) => group.id === activeGroupId.value)) {
      activeGroupId.value = groups.find((group) => group.items.length > 0)?.id ?? groups[0]?.id ?? '';
    }
  },
  { immediate: true }
);

function targetActionLabel(recommendation) {
  const action = recommendation.targetAction === 'add' ? 'Add' : 'Update';
  return `${action} ${targetTypeLabel(recommendation.targetType)}`;
}

function targetTypeLabel(type) {
  const labels = {
    agent_profile: 'agent profile',
    highlevel_goal: 'HighLevel goal',
    observability_parameter: 'observability parameter'
  };

  return labels[type] ?? 'review item';
}
</script>

<template>
  <section class="agent-section agent-review-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">Recommendations</p>
        <h3>Call-linked improvement queue</h3>
        <p>
          Each recommendation is tied to a call and should be reviewed before changing the agent setup.
        </p>
      </div>
      <span class="section-count-pill">{{ selectedAgentPanel.recommendations.length }} items</span>
    </header>

    <div class="review-workspace">
      <aside class="review-lane-list" aria-label="Recommendation groups">
        <button
          v-for="group in reviewGroups"
          :key="group.id"
          type="button"
          :class="{ active: activeReviewGroup?.id === group.id }"
          @click="activeGroupId = group.id"
        >
          <div>
            <strong>{{ group.label }}</strong>
            <small>{{ group.description }}</small>
          </div>
          <span>{{ group.items.length }}</span>
        </button>
      </aside>

      <section v-if="activeReviewGroup" class="review-detail-panel">
        <div class="review-detail-head">
          <div>
            <p class="eyebrow">{{ activeReviewGroup.label }}</p>
            <h4>{{ activeReviewGroup.items.length }} suggested {{ activeReviewGroup.items.length === 1 ? 'change' : 'changes' }}</h4>
            <p>{{ activeReviewGroup.description }}</p>
          </div>
          <button
            class="text-button compact"
            type="button"
            @click="$emit('open-agent-section', { agentId: selectedAgentPanel.id, section: activeReviewGroup.section })"
          >
            Open section
          </button>
        </div>

        <div class="review-item-list focused">
          <article v-for="recommendation in activeReviewGroup.items" :key="recommendation.id" class="review-item-card">
            <div class="review-item-top">
              <div>
                <strong>{{ recommendation.title }}</strong>
                <small>{{ targetActionLabel(recommendation) }}</small>
              </div>
              <span class="severity-pill" :class="helpers.severityClass(recommendation.severity)">
                {{ helpers.formatSeverity(recommendation.severity) }}
              </span>
            </div>
            <p>{{ recommendation.detail }}</p>
            <div v-if="recommendation.suggestedChange || recommendation.promptPatch" class="review-suggestion">
              <span>Suggested change</span>
              <p>{{ recommendation.suggestedChange || recommendation.promptPatch }}</p>
            </div>
            <div class="review-item-footer">
              <span>Needs human review</span>
              <button class="text-button compact" type="button" @click="$emit('show-call', recommendation.callId)">
                Open call
              </button>
            </div>
          </article>

          <p v-if="activeReviewGroup.items.length === 0" class="empty-copy review-empty-copy">
            No {{ activeReviewGroup.label.toLowerCase() }} changes suggested yet.
          </p>
        </div>
      </section>
    </div>
  </section>
</template>
