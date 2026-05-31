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

defineEmits(['cancel-edit-agent', 'save-agent', 'start-edit-agent']);
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">Prompt</p>
        <h3>Agent role & objective</h3>
      </div>
      <button
        v-if="editingAgentId !== selectedAgentPanel.id"
        class="detail-button secondary"
        type="button"
        @click="$emit('start-edit-agent', selectedAgentPanel)"
      >
        Edit prompt
      </button>
    </header>

    <div class="agent-section-grid">
      <section class="agent-subsection wide">
        <p class="agent-description">
          {{
            helpers.extractAgentRoleObjective(selectedAgentPanel.description) ||
            'No AGENT ROLE & OBJECTIVE section is available from HighLevel yet.'
          }}
        </p>
      </section>

      <section class="agent-subsection">
        <p class="eyebrow">Greeting</p>
        <h4>Welcome message</h4>
        <p class="agent-note">
          {{ selectedAgentPanel.welcomeMessage || 'No welcome message configured.' }}
        </p>
      </section>
    </div>

    <section v-if="editingAgentId === selectedAgentPanel.id" class="agent-edit-surface">
      <div class="agent-edit-heading">
        <div>
          <p class="eyebrow">Edit Agent</p>
          <h2>Name, greeting, and prompt</h2>
        </div>
      </div>

      <div class="agent-edit-form single">
        <label>
          Agent name
          <input v-model="agentDrafts[selectedAgentPanel.id].agentName" type="text" maxlength="40" />
        </label>
        <label>
          Business name
          <input v-model="agentDrafts[selectedAgentPanel.id].businessName" type="text" />
        </label>
        <label>
          Welcome message
          <textarea v-model="agentDrafts[selectedAgentPanel.id].welcomeMessage" rows="3"></textarea>
        </label>
        <label>
          Agent prompt
          <textarea v-model="agentDrafts[selectedAgentPanel.id].agentPrompt" rows="8"></textarea>
        </label>

        <p v-if="agentEditError" class="edit-error">{{ agentEditError }}</p>

        <div class="agent-edit-actions">
          <button class="text-button compact" type="button" @click="$emit('cancel-edit-agent')">
            Cancel
          </button>
          <button
            class="text-button compact primary"
            type="button"
            :disabled="savingAgentId === selectedAgentPanel.id"
            @click="$emit('save-agent', selectedAgentPanel)"
          >
            {{ savingAgentId === selectedAgentPanel.id ? 'Saving' : 'Save changes' }}
          </button>
        </div>
      </div>
    </section>

    <p v-if="agentEditMessage && editingAgentId !== selectedAgentPanel.id" class="edit-success inline-message">
      {{ agentEditMessage }}
    </p>
  </section>
</template>
