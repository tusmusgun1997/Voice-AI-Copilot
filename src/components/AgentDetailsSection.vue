<script setup>
defineProps({
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
  helpers: {
    type: Object,
    required: true
  },
  savingAgentId: {
    type: String,
    default: ''
  },
  selectedAgentPanel: {
    type: Object,
    required: true
  }
});

defineEmits(['cancel-edit-agent', 'save-agent', 'show-agent-calls', 'show-call', 'start-edit-agent']);
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">Details</p>
        <h3>Operational snapshot</h3>
      </div>
      <button class="text-button compact" type="button" @click="$emit('show-agent-calls', selectedAgentPanel.id)">
        View calls
      </button>
    </header>

    <div class="agent-stats-line">
      <div>
        <span>Score</span>
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
        <span>Actions</span>
        <strong>{{ selectedAgentPanel.useActionCount }}</strong>
      </div>
    </div>

    <div class="agent-detail-columns">
      <section class="agent-subsection prompt-subsection">
        <div class="agent-section-head compact">
          <div>
            <p class="eyebrow">Prompt</p>
            <h4>Agent role & objective</h4>
          </div>
          <button
            v-if="editingAgentId !== selectedAgentPanel.id"
            class="text-button compact"
            type="button"
            @click="$emit('start-edit-agent', selectedAgentPanel)"
          >
            Edit prompt
          </button>
        </div>

        <p v-if="editingAgentId !== selectedAgentPanel.id" class="agent-description">
          {{
            helpers.extractAgentRoleObjective(selectedAgentPanel.description) ||
            'No AGENT ROLE & OBJECTIVE section is available from HighLevel yet.'
          }}
        </p>

        <div v-else class="prompt-inline-editor">
          <label class="inline-edit-field">
            <span>Agent prompt</span>
            <textarea v-model="agentDrafts[selectedAgentPanel.id].agentPrompt" rows="8"></textarea>
          </label>

          <p v-if="agentEditError" class="edit-error">{{ agentEditError }}</p>

          <div class="inline-save-bar">
            <span></span>
            <button class="text-button compact" type="button" @click="$emit('cancel-edit-agent')">
              Cancel
            </button>
            <button
              class="text-button compact primary"
              type="button"
              :disabled="savingAgentId === selectedAgentPanel.id"
              @click="$emit('save-agent', selectedAgentPanel)"
            >
              {{ savingAgentId === selectedAgentPanel.id ? 'Saving' : 'Save prompt' }}
            </button>
          </div>
        </div>
      </section>

      <section class="agent-subsection">
        <p class="eyebrow">Configuration</p>
        <div class="agent-detail-list">
          <div>
            <span>Business</span>
            <strong>{{ selectedAgentPanel.businessName || 'Not set' }}</strong>
          </div>
          <div>
            <span>Language</span>
            <strong>{{ selectedAgentPanel.language || 'Not set' }}</strong>
          </div>
          <div>
            <span>Timezone</span>
            <strong>{{ selectedAgentPanel.timezone || 'Not set' }}</strong>
          </div>
          <div>
            <span>Inbound number</span>
            <strong>{{ selectedAgentPanel.inboundNumber || 'Not assigned' }}</strong>
          </div>
          <div>
            <span>Voice ID</span>
            <strong>{{ selectedAgentPanel.voiceId || 'Not set' }}</strong>
          </div>
          <div>
            <span>HighLevel agent ID</span>
            <strong>{{ selectedAgentPanel.id }}</strong>
          </div>
        </div>
      </section>

      <section class="agent-subsection">
        <p class="eyebrow">Greeting</p>
        <h4>Welcome message</h4>
        <p class="agent-note">
          {{ selectedAgentPanel.welcomeMessage || 'No welcome message configured.' }}
        </p>
      </section>

      <section class="agent-subsection">
        <p class="eyebrow">HighLevel goals</p>
        <h4>{{ selectedAgentPanel.configuredActionCount || 0 }} configured</h4>
        <div class="mini-chip-row">
          <span v-for="goal in (selectedAgentPanel.actions || []).slice(0, 4)" :key="goal.id">
            {{ goal.name || goal.actionType || 'Goal' }}
          </span>
        </div>
        <p v-if="!(selectedAgentPanel.actions || []).length" class="agent-note">
          No HighLevel goals/actions returned for this agent.
        </p>
      </section>

      <section class="agent-subsection wide">
        <div class="agent-section-head compact">
          <div>
            <p class="eyebrow">Latest Calls</p>
            <h4>Recent activity</h4>
          </div>
          <button class="text-button compact" type="button" @click="$emit('show-agent-calls', selectedAgentPanel.id)">
            View all
          </button>
        </div>
        <div class="agent-mini-list">
          <button
            v-for="call in selectedAgentPanel.recentCalls"
            :key="call.id"
            type="button"
            @click="$emit('show-call', call.id)"
          >
            <span>{{ call.contactName }}</span>
            <small>{{ helpers.formatStatus(call.status) }} - {{ helpers.formatDate(call.createdAt) }}</small>
          </button>
          <p v-if="selectedAgentPanel.recentCalls.length === 0">No calls analyzed yet.</p>
        </div>
      </section>

      <p v-if="agentEditMessage && editingAgentId !== selectedAgentPanel.id" class="edit-success inline-message">
        {{ agentEditMessage }}
      </p>
    </div>
  </section>
</template>
