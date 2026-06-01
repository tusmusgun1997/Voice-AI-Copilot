<script setup>
defineProps({
  activeView: {
    type: String,
    required: true
  },
  dashboard: {
    type: Object,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  },
  selectedAgent: {
    type: String,
    required: true
  }
});

defineEmits(['update:selectedAgent']);
</script>

<template>
  <section v-if="activeView === 'actions'" class="controls-row">
    <label>
      Agent
      <select :value="selectedAgent" @change="$emit('update:selectedAgent', $event.target.value)">
        <option value="all">All agents</option>
        <option v-for="agent in dashboard.agents" :key="agent.id" :value="agent.id">
          {{ helpers.displayAgentName(agent.id, agent.name) }}
        </option>
      </select>
    </label>
  </section>
</template>
