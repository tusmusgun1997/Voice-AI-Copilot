<script setup>
import { ArrowLeft, BarChart3, FileText, Lightbulb, PhoneCall, SlidersHorizontal, Target, UserRoundCog } from '@lucide/vue';
import AgentDetailsSection from './AgentDetailsSection.vue';
import AgentGoalsSection from './AgentGoalsSection.vue';
import AgentProfileSection from './AgentProfileSection.vue';
import AgentPromptSection from './AgentPromptSection.vue';
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
  'back-to-agents',
  'cancel-edit-agent',
  'cancel-edit-observability-profile',
  'open-agent-section',
  'remove-observability-criterion',
  'save-agent',
  'save-observability-profile',
  'show-agent-calls',
  'show-agent-recommendations',
  'show-call',
  'start-edit-agent',
  'start-edit-observability-profile'
]);

const detailTabs = [
  { id: 'details', label: 'Info', icon: BarChart3 },
  { id: 'agent-profile', label: 'Agent profile', icon: UserRoundCog },
  { id: 'highlevel-goals', label: 'HighLevel goals', icon: Target },
  { id: 'observability-parameters', label: 'Observability parameters', icon: SlidersHorizontal },
  { id: 'prompt', label: 'Prompt', icon: FileText }
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
        <p class="eyebrow">{{ selectedAgentPanel.goalProfileName || 'Voice AI agent' }}</p>
        <h2>{{ selectedAgentPanel.displayName }}</h2>
        <small>{{ selectedAgentPanel.businessName || 'HighLevel voice agent' }}</small>
      </div>

      <div class="agent-detail-actions">
        <button class="text-button compact" type="button" @click="$emit('show-agent-calls', selectedAgentPanel.id)">
          <PhoneCall :size="15" />
          Calls
        </button>
        <button class="text-button compact" type="button" @click="$emit('show-agent-recommendations', selectedAgentPanel.id)">
          <Lightbulb :size="15" />
          Recommendations
        </button>
      </div>
    </header>

    <div class="agent-detail-stat-strip">
      <div>
        <span>Average score</span>
        <strong :class="helpers.scoreClass(selectedAgentPanel.averageScore)">
          {{ helpers.formatScore(selectedAgentPanel.averageScore) }}
        </strong>
      </div>
      <div>
        <span>Calls</span>
        <strong>{{ selectedAgentPanel.callCount }}</strong>
      </div>
      <div>
        <span>Issues</span>
        <strong>{{ selectedAgentPanel.issueCount }}</strong>
      </div>
      <div>
        <span>Human actions</span>
        <strong>{{ selectedAgentPanel.useActionCount }}</strong>
      </div>
    </div>

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
        :helpers="helpers"
        :selected-agent-panel="selectedAgentPanel"
        @show-agent-calls="$emit('show-agent-calls', $event)"
        @show-call="$emit('show-call', $event)"
      />

      <AgentProfileSection
        v-else-if="activeAgentSection === 'agent-profile'"
        :agent-drafts="agentDrafts"
        :agent-edit-error="agentEditError"
        :agent-edit-message="agentEditMessage"
        :editing-agent-id="editingAgentId"
        :helpers="helpers"
        :saving-agent-id="savingAgentId"
        :selected-agent-panel="selectedAgentPanel"
        @cancel-edit-agent="$emit('cancel-edit-agent')"
        @save-agent="$emit('save-agent', $event)"
        @start-edit-agent="$emit('start-edit-agent', $event)"
      />

      <AgentGoalsSection
        v-else-if="activeAgentSection === 'highlevel-goals'"
        :selected-agent-panel="selectedAgentPanel"
      />

      <ObservabilityParametersSection
        v-else-if="activeAgentSection === 'observability-parameters'"
        :editing-observability-stage="editingObservabilityStage"
        :editing-profile-agent-id="editingProfileAgentId"
        :loading-profile-agent-id="loadingProfileAgentId"
        :observability-profile-drafts="observabilityProfileDrafts"
        :profile-edit-error="profileEditError"
        :profile-edit-message="profileEditMessage"
        :saving-profile-agent-id="savingProfileAgentId"
        :selected-agent-panel="selectedAgentPanel"
        :selected-observability-profile="selectedObservabilityProfile"
        @add-observability-criterion="$emit('add-observability-criterion', $event)"
        @cancel-edit-observability-profile="$emit('cancel-edit-observability-profile')"
        @remove-observability-criterion="$emit('remove-observability-criterion', $event.agentId, $event.parameterId)"
        @save-observability-profile="$emit('save-observability-profile', $event)"
        @start-edit-observability-profile="$emit('start-edit-observability-profile', $event)"
      />

      <AgentPromptSection
        v-else
        :agent-drafts="agentDrafts"
        :agent-edit-error="agentEditError"
        :agent-edit-message="agentEditMessage"
        :editing-agent-id="editingAgentId"
        :helpers="helpers"
        :saving-agent-id="savingAgentId"
        :selected-agent-panel="selectedAgentPanel"
        @cancel-edit-agent="$emit('cancel-edit-agent')"
        @save-agent="$emit('save-agent', $event)"
        @start-edit-agent="$emit('start-edit-agent', $event)"
      />
    </section>
  </section>
</template>
