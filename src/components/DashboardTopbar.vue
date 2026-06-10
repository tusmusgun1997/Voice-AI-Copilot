<script setup>
import { RefreshCw } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps({
  activeViewTitle: {
    type: String,
    required: true
  },
  dashboard: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  sourceLabel: {
    type: String,
    required: true
  }
});

defineEmits(['refresh']);

const descriptions = {
  Overview: 'Track the full loop from call transcripts to agent-level system improvements.',
  Agents: 'Manage Voice AI agents, prompts, observability parameters, and operating details.',
  Calls: 'Review transcript logs, scoring signals, and pass/fail outcomes by agent.',
  Actions: 'Review agent-level prompt, profile, script-training, and observability improvements.',
  'LLM Parameters': 'Create reusable, versioned transcript evaluation checklists for agents.'
};

const subtitle = computed(() => descriptions[props.activeViewTitle] ?? 'Monitor Voice AI performance inside HighLevel.');
</script>

<template>
  <header class="topbar">
    <div class="workspace-heading">
      <div class="breadcrumb-row">
        <span class="breadcrumb-mark"></span>
        <span>HighLevel</span>
        <span>/</span>
        <strong>{{ activeViewTitle }}</strong>
      </div>

      <h1>{{ activeViewTitle }}</h1>
      <p>{{ subtitle }}</p>
    </div>

    <div class="topbar-actions">
      <span v-if="dashboard" class="source-pill" :class="dashboard.dataSource">
        {{ sourceLabel }}
      </span>
      <button class="icon-button" type="button" title="Refresh dashboard" @click="$emit('refresh')">
        <RefreshCw :size="18" :class="{ spinning: loading }" />
      </button>
      <span class="user-chip" title="Current user">TY</span>
    </div>
  </header>
</template>

