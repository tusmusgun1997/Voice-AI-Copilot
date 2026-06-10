<script setup>
import { ArrowLeft, BarChart3, ClipboardCheck, SlidersHorizontal } from '@lucide/vue';
import AgentActionsSection from './AgentActionsSection.vue';
import AgentDetailsSection from './AgentDetailsSection.vue';
import ObservabilityParametersSection from './ObservabilityParametersSection.vue';

defineProps({
  activeAgentSection: {
    type: String,
    default: 'details'
  },
  agentDrafts: {
    type: Object,
    required: true
  },
  agentEditError: {
    type: String,
    default: ''
  },
  agentEditMessage: {
    type: String,
    default: ''
  },
  editingAgentId: {
    type: String,
    default: ''
  },
  editingObservabilityStage: {
    type: String,
    default: ''
  },
  editingProfileAgentId: {
    type: String,
    default: ''
  },
  helpers: {
    type: Object,
    required: true
  },
  loadingProfileAgentId: {
    type: String,
    default: ''
  },
  observabilityProfileDrafts: {
    type: Object,
    required: true
  },
  parameterVersions: {
    type: Array,
    default: () => []
  },
  profileEditError: {
    type: String,
    default: ''
  },
  profileEditMessage: {
    type: String,
    default: ''
  },
  savingAgentId: {
    type: String,
    default: ''
  },
  savingProfileAgentId: {
    type: String,
    default: ''
  },
  selectedAgentPanel: {
    type: Object,
    required: true
  },
  selectedObservabilityProfile: {
    type: Object,
    default: null
  }
});

defineEmits([
  'add-observability-criterion',
  'apply-parameter-version',
  'back-to-agents',
  'cancel-edit-agent',
  'cancel-edit-observability-profile',
  'open-agent-section',
  'open-llm-parameters',
  'remove-observability-criterion',
  'save-agent',
  'save-observability-profile',
  'show-agent-calls',
  'show-call',
  'start-edit-agent',
  'start-edit-observability-profile',
  'update-action-status',
  'delete-action'
]);

const detailTabs = [
  { id: 'details', label: 'Info', icon: BarChart3 },
  { id: 'observability-parameters', label: 'Observability parameters', icon: SlidersHorizontal },
  { id: 'actions', label: 'System improvements', icon: ClipboardCheck }
];
</script>

<template>
  <section class="agent-detail-page">
    <button class="agent-back-button" type="button" @click="$emit('back-to-agents')">
      <ArrowLeft :size="17" />
      <span>Agents</span>
    </button>

    <header class="agent-detail-hero">
      <span class="agent-avatar large">{{ helpers.agentInitials(selectedAgentPanel.displayName) }}</span>
      <div class="agent-detail-title">
        <p class="eyebrow">Voice AI agent</p>
        <h2>{{ selectedAgentPanel.displayName }}</h2>
        <small>{{ selectedAgentPanel.businessName || 'HighLevel voice agent' }}</small>
      </div>

    </header>

    <nav class="agent-page-tabs" aria-label="Agent sections">
      <button
        v-for="tab in detailTabs"
        :key="tab.id"
        type="button"
        :class="{ active: activeAgentSection === tab.id }"
        @click="$emit('open-agent-section', { agentId: selectedAgentPanel.id, section: tab.id })"
      >
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <section class="agent-detail-content">
      <AgentDetailsSection
        v-if="activeAgentSection === 'details'"
        :agent-drafts="agentDrafts"
        :agent-edit-error="agentEditError"
        :agent-edit-message="agentEditMessage"
        :editing-agent-id="editingAgentId"
        :helpers="helpers"
        :saving-agent-id="savingAgentId"
        :selected-agent-panel="selectedAgentPanel"
        @cancel-edit-agent="$emit('cancel-edit-agent')"
        @save-agent="$emit('save-agent', $event)"
        @show-agent-calls="$emit('show-agent-calls', $event)"
        @show-call="$emit('show-call', $event)"
        @start-edit-agent="$emit('start-edit-agent', $event)"
      />

      <ObservabilityParametersSection
        v-else-if="activeAgentSection === 'observability-parameters'"
        :loading-profile-agent-id="loadingProfileAgentId"
        :parameter-versions="parameterVersions"
        :profile-edit-error="profileEditError"
        :profile-edit-message="profileEditMessage"
        :saving-profile-agent-id="savingProfileAgentId"
        :selected-agent-panel="selectedAgentPanel"
        :selected-observability-profile="selectedObservabilityProfile"
        @apply-parameter-version="$emit('apply-parameter-version', $event)"
        @open-llm-parameters="$emit('open-llm-parameters', $event)"
      />

      <AgentActionsSection
        v-else
        :helpers="helpers"
        :selected-agent-panel="selectedAgentPanel"
        @delete-action="$emit('delete-action', $event)"
        @show-call="$emit('show-call', $event)"
        @update-action-status="$emit('update-action-status', $event)"
      />
    </section>
  </section>
</template>

