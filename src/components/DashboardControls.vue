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
  },
  selectedStatus: {
    type: String,
    required: true
  }
});

defineEmits(['update:selectedAgent', 'update:selectedStatus']);
</script>

<template>
  <section class="controls-row">
    <label v-if="!['calls', 'recommendations'].includes(activeView)">
      Agent
      <select :value="selectedAgent" @change="$emit('update:selectedAgent', $event.target.value)">
        <option value="all">All agents</option>
        <option v-for="agent in dashboard.agents" :key="agent.id" :value="agent.id">
          {{ helpers.displayAgentName(agent.id, agent.name) }}
        </option>
      </select>
    </label>

    <label>
      Status
      <select :value="selectedStatus" @change="$emit('update:selectedStatus', $event.target.value)">
        <option value="all">All statuses</option>
        <option value="attention">Needs attention</option>
        <option value="watch">Watch</option>
        <option value="healthy">Healthy</option>
        <option value="pending">Pending</option>
        <option value="incomplete">Incomplete</option>
      </select>
    </label>
  </section>
</template>
