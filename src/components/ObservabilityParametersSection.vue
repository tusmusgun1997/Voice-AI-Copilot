<script setup>
import { Plus, Trash2, Pencil } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps({
  editingObservabilityStage: {
    type: String,
    default: ''
  },
  editingProfileAgentId: {
    type: String,
    default: ''
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

const emit = defineEmits([
  'add-observability-criterion',
  'cancel-edit-observability-profile',
  'remove-observability-criterion',
  'save-observability-profile',
  'start-edit-observability-profile'
]);

const selectedParameterId = ref('');

const activeDraft = computed(() => props.observabilityProfileDrafts?.[props.selectedAgentPanel.id] ?? null);
const draftParameters = computed(() => activeDraft.value?.parameters ?? []);
const summaryParameters = computed(() => props.selectedObservabilityProfile?.parameters ?? []);
const isEditing = computed(
  () =>
    props.editingProfileAgentId === props.selectedAgentPanel.id &&
    props.editingObservabilityStage.startsWith('parameter')
);
const activeParameters = computed(() => (isEditing.value ? draftParameters.value : summaryParameters.value));
const selectedParameter = computed(
  () => activeParameters.value.find((parameter) => parameter.id === selectedParameterId.value) ?? activeParameters.value[0] ?? null
);
const selectedDraftParameter = computed(
  () => draftParameters.value.find((parameter) => parameter.id === selectedParameter.value?.id) ?? draftParameters.value[0] ?? null
);
const isLoading = computed(() => props.loadingProfileAgentId === props.selectedAgentPanel.id);

watch(
  () => activeParameters.value.map((parameter) => parameter.id).join('|'),
  () => {
    const stillExists = activeParameters.value.some((parameter) => parameter.id === selectedParameterId.value);
    if (!stillExists) {
      selectedParameterId.value = activeParameters.value[0]?.id ?? '';
    }
  },
  { immediate: true }
);

function parameterCount(profile) {
  return profile?.parameters?.length ?? 0;
}

function parameterTitle(parameter, index = 0) {
  return parameter?.title?.trim() || `Parameter ${index + 1}`;
}

function parameterPreview(parameter) {
  return parameter?.description?.trim() || 'No evaluation description added yet.';
}

function splitValues(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function selectParameter(parameter) {
  selectedParameterId.value = parameter.id;
}

function startEditParameter(parameter = selectedParameter.value) {
  emit('start-edit-observability-profile', {
    agent: props.selectedAgentPanel,
    stage: `parameter:${parameter?.id || 'new'}`
  });
}

async function addParameter() {
  if (!isEditing.value) {
    startEditParameter({ id: 'new' });
    await nextTick();
  }

  emit('add-observability-criterion', props.selectedAgentPanel.id);
  await nextTick();
  selectedParameterId.value = draftParameters.value[draftParameters.value.length - 1]?.id ?? selectedParameterId.value;
}

function removeParameter(parameter) {
  if (!parameter) return;

  const nextParameter = draftParameters.value.find((item) => item.id !== parameter.id);
  selectedParameterId.value = nextParameter?.id ?? '';
  emit('remove-observability-criterion', props.selectedAgentPanel.id, parameter.id);
}
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">Observability parameters</p>
        <h3>Transcript review checks</h3>
      </div>
      <button class="text-button compact" type="button" :disabled="!selectedObservabilityProfile" @click="addParameter">
        <Plus :size="15" />
        Add parameter
      </button>
    </header>

    <p v-if="isLoading" class="empty-copy">
      Loading observability parameters.
    </p>

    <section v-else class="summary-tab-panel parameter-edit-shell">
      <div class="parameter-count-line">
        <span>{{ parameterCount(selectedObservabilityProfile) }} parameters</span>
        <p>These checks are used by the analysis layer to judge each call transcript.</p>
      </div>

      <div v-if="activeParameters.length === 0" class="parameter-empty-state compact">
        <span>Not configured</span>
        <h4>No observability parameters yet</h4>
        <p>Add the first check to define exactly what the analysis should evaluate in each call.</p>
        <div v-if="isEditing" class="inline-save-bar empty-inline-actions">
          <button class="text-button compact" type="button" @click="$emit('cancel-edit-observability-profile')">
            Cancel
          </button>
          <button
            class="text-button compact primary"
            type="button"
            :disabled="savingProfileAgentId === selectedAgentPanel.id"
            @click="$emit('save-observability-profile', selectedAgentPanel)"
          >
            {{ savingProfileAgentId === selectedAgentPanel.id ? 'Saving' : 'Save changes' }}
          </button>
        </div>
      </div>

      <div v-else class="parameter-read-workbench">
        <aside class="parameter-rail readonly" aria-label="Saved observability parameters">
          <button
            v-for="(parameter, index) in activeParameters"
            :key="parameter.id"
            class="parameter-rail-item"
            :class="{ active: selectedParameter?.id === parameter.id, disabled: parameter.enabled === false }"
            type="button"
            @click="selectParameter(parameter)"
          >
            <span>{{ index + 1 }}</span>
            <strong>{{ parameterTitle(parameter, index) }}</strong>
            <small>{{ parameterPreview(parameter) }}</small>
          </button>
        </aside>

        <article v-if="selectedParameter && !isEditing" class="parameter-read-detail hover-edit-surface">
          <button
            class="section-edit-icon"
            type="button"
            aria-label="Edit selected observability parameter"
            @click="startEditParameter(selectedParameter)"
          >
            <Pencil :size="15" />
          </button>

          <div class="parameter-read-top">
            <div>
              <p class="eyebrow">Selected check</p>
              <h4>{{ selectedParameter.title || 'Untitled parameter' }}</h4>
            </div>
            <span v-if="selectedParameter.requiresHumanReview">Human review</span>
            <span v-else>Transcript check</span>
          </div>

          <p>{{ selectedParameter.description || 'No evaluation description added yet.' }}</p>

          <div class="parameter-read-grid">
            <section>
              <span>Success signals</span>
              <p v-if="splitValues(selectedParameter.successSignals).length === 0">No hints added.</p>
              <div v-else class="mini-chip-row">
                <span v-for="signal in selectedParameter.successSignals" :key="signal">{{ signal }}</span>
              </div>
            </section>

            <section>
              <span>Failure signals</span>
              <p v-if="splitValues(selectedParameter.failureSignals).length === 0">No hints added.</p>
              <div v-else class="mini-chip-row risk">
                <span v-for="signal in selectedParameter.failureSignals" :key="signal">{{ signal }}</span>
              </div>
            </section>
          </div>

          <section v-if="selectedParameter.recommendation" class="parameter-read-note">
            <span>Recommendation when missed</span>
            <p>{{ selectedParameter.recommendation }}</p>
          </section>

          <section v-if="selectedParameter.promptGuidance" class="parameter-read-note">
            <span>Prompt/script guidance</span>
            <p>{{ selectedParameter.promptGuidance }}</p>
          </section>
        </article>

        <article v-else-if="selectedDraftParameter" class="parameter-read-detail parameter-inline-editor">
          <div class="parameter-read-top">
            <div>
              <p class="eyebrow">Selected check</p>
              <h4>{{ selectedDraftParameter.title || 'Untitled parameter' }}</h4>
            </div>
            <label class="parameter-toggle">
              <input v-model="selectedDraftParameter.enabled" type="checkbox" />
              Enabled
            </label>
          </div>

          <label class="inline-edit-field">
            <span>Title</span>
            <input v-model="selectedDraftParameter.title" type="text" placeholder="Example: Project need captured" />
          </label>

          <label class="inline-edit-field">
            <span>Description for analysis</span>
            <textarea
              v-model="selectedDraftParameter.description"
              rows="5"
              placeholder="Describe what should be evaluated in the transcript and what counts as success."
            ></textarea>
          </label>

          <div class="parameter-read-grid">
            <label class="inline-edit-field">
              <span>Success signal hints</span>
              <textarea
                v-model="selectedDraftParameter.successSignalsText"
                rows="4"
                placeholder="Optional words or phrases that suggest this passed."
              ></textarea>
            </label>
            <label class="inline-edit-field">
              <span>Failure signal hints</span>
              <textarea
                v-model="selectedDraftParameter.failureSignalsText"
                rows="4"
                placeholder="Optional words or phrases that suggest this needs review."
              ></textarea>
            </label>
          </div>

          <div class="parameter-read-grid">
            <label class="inline-edit-field">
              <span>Recommendation when missed</span>
              <textarea
                v-model="selectedDraftParameter.recommendation"
                rows="4"
                placeholder="What should the dashboard recommend if this check fails?"
              ></textarea>
            </label>
            <label class="inline-edit-field">
              <span>Prompt/script guidance</span>
              <textarea
                v-model="selectedDraftParameter.promptGuidance"
                rows="4"
                placeholder="Optional prompt change or script coaching note."
              ></textarea>
            </label>
          </div>

          <div class="parameter-human-review">
            <label class="parameter-toggle">
              <input v-model="selectedDraftParameter.requiresHumanReview" type="checkbox" />
              Create human review action when missed
            </label>
            <label v-if="selectedDraftParameter.requiresHumanReview" class="inline-edit-field compact">
              <span>Action type</span>
              <input
                v-model="selectedDraftParameter.useActionType"
                type="text"
                placeholder="Example: QA review or Human handoff"
              />
            </label>
          </div>

          <p v-if="profileEditError" class="edit-error">{{ profileEditError }}</p>

          <div class="inline-save-bar">
            <button class="text-button compact danger" type="button" @click="removeParameter(selectedDraftParameter)">
              <Trash2 :size="14" />
              Remove
            </button>
            <span></span>
            <button class="text-button compact" type="button" @click="$emit('cancel-edit-observability-profile')">
              Cancel
            </button>
            <button
              class="text-button compact primary"
              type="button"
              :disabled="savingProfileAgentId === selectedAgentPanel.id"
              @click="$emit('save-observability-profile', selectedAgentPanel)"
            >
              {{ savingProfileAgentId === selectedAgentPanel.id ? 'Saving' : 'Save parameter' }}
            </button>
          </div>
        </article>
      </div>

      <p v-if="profileEditMessage && !isEditing" class="edit-success">{{ profileEditMessage }}</p>
    </section>
  </section>
</template>
