<script setup>
import { Pencil } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps({
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

const isEditing = computed(() => props.editingAgentId === props.selectedAgentPanel.id);
const configuredActions = computed(() => props.selectedAgentPanel.actions ?? []);
const objectivePreview = computed(
  () =>
    props.helpers.extractAgentRoleObjective(props.selectedAgentPanel.description) ||
    props.selectedAgentPanel.description ||
    'No HighLevel prompt or objective is available yet.'
);

function actionDescription(action) {
  return (
    action?.actionParameters?.description ||
    action?.actionParameters?.triggerPrompt ||
    action?.actionParameters?.message ||
    'No description configured.'
  );
}

function formatActionType(type) {
  return String(type || 'Action')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">HighLevel agent profile</p>
        <h3>Source configuration</h3>
      </div>
    </header>

    <section class="summary-tab-panel hover-edit-surface profile-editor-surface">
      <button
        v-if="!isEditing"
        class="section-edit-icon"
        type="button"
        aria-label="Edit HighLevel agent profile"
        @click="$emit('start-edit-agent', selectedAgentPanel)"
      >
        <Pencil :size="15" />
      </button>

      <div v-if="isEditing && agentDrafts[selectedAgentPanel.id]" class="highlevel-profile-layout profile-edit-layout">
        <label class="inline-edit-field">
          <span>Agent name</span>
          <input v-model="agentDrafts[selectedAgentPanel.id].agentName" type="text" maxlength="60" />
        </label>

        <label class="inline-edit-field">
          <span>Business name</span>
          <input v-model="agentDrafts[selectedAgentPanel.id].businessName" type="text" />
        </label>

        <label class="inline-edit-field wide">
          <span>Welcome message</span>
          <textarea v-model="agentDrafts[selectedAgentPanel.id].welcomeMessage" rows="3"></textarea>
        </label>

        <label class="inline-edit-field wide">
          <span>Agent prompt</span>
          <textarea v-model="agentDrafts[selectedAgentPanel.id].agentPrompt" rows="10"></textarea>
        </label>

        <p v-if="agentEditError" class="edit-error">{{ agentEditError }}</p>

        <div class="inline-save-bar">
          <button class="text-button compact" type="button" @click="$emit('cancel-edit-agent')">
            Cancel
          </button>
          <button
            class="text-button compact primary"
            type="button"
            :disabled="savingAgentId === selectedAgentPanel.id"
            @click="$emit('save-agent', selectedAgentPanel)"
          >
            {{ savingAgentId === selectedAgentPanel.id ? 'Saving' : 'Save to HighLevel' }}
          </button>
        </div>
      </div>

      <div v-else class="highlevel-profile-layout">
        <div class="profile-summary-main wide">
          <p class="eyebrow">Agent role & objective</p>
          <h4>{{ selectedAgentPanel.displayName }}</h4>
          <p>{{ objectivePreview }}</p>
        </div>

        <div class="profile-field-list">
          <div>
            <span>Business</span>
            <strong>{{ selectedAgentPanel.businessName || 'Not set' }}</strong>
          </div>
          <div>
            <span>Welcome message</span>
            <strong>{{ selectedAgentPanel.welcomeMessage || 'Not set' }}</strong>
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
            <span>Responsiveness</span>
            <strong>{{ selectedAgentPanel.responsiveness ?? 'Not set' }}</strong>
          </div>
          <div>
            <span>Max call duration</span>
            <strong>{{ selectedAgentPanel.maxCallDuration ? `${selectedAgentPanel.maxCallDuration}s` : 'Not set' }}</strong>
          </div>
          <div>
            <span>Voice ID</span>
            <strong>{{ selectedAgentPanel.voiceId || 'Not set' }}</strong>
          </div>
          <div>
            <span>Idle reminder</span>
            <strong>
              {{
                selectedAgentPanel.sendUserIdleReminders
                  ? `${selectedAgentPanel.reminderAfterIdleTimeSeconds || 0}s`
                  : 'Disabled'
              }}
            </strong>
          </div>
        </div>

        <section class="highlevel-action-panel wide">
          <div class="agent-section-head compact">
            <div>
              <p class="eyebrow">HighLevel goals/actions</p>
              <h4>{{ configuredActions.length }} configured</h4>
            </div>
          </div>

          <div v-if="configuredActions.length" class="highlevel-action-list">
            <article v-for="action in configuredActions" :key="action.id">
              <span>{{ formatActionType(action.actionType) }}</span>
              <div>
                <strong>{{ action.name || 'Unnamed action' }}</strong>
                <p>{{ actionDescription(action) }}</p>
              </div>
            </article>
          </div>

          <p v-else class="empty-copy">
            No HighLevel actions are configured for this agent yet.
          </p>
        </section>
      </div>

      <p v-if="agentEditMessage && !isEditing" class="edit-success">{{ agentEditMessage }}</p>
    </section>
  </section>
</template>
