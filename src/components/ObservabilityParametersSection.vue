<script setup>
import { ExternalLink } from '@lucide/vue';
import { computed, ref, watch } from 'vue';

const props = defineProps({
  loadingProfileAgentId: {
    type: String,
    default: ''
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

const emit = defineEmits(['apply-parameter-version', 'open-llm-parameters']);

const selectedParameterId = ref('');
const selectedVersionId = ref('');

const attachedVersionId = computed(() => props.selectedObservabilityProfile?.parameterVersionId || '');
const attachedVersion = computed(() =>
  props.parameterVersions.find((version) => version.id === attachedVersionId.value) ?? null
);
const attachedVersionName = computed(() => {
  if (props.selectedObservabilityProfile?.parameterVersionName) {
    return props.selectedObservabilityProfile.parameterVersionName;
  }

  return attachedVersion.value ? `${attachedVersion.value.name} ${attachedVersion.value.versionLabel}`.trim() : '';
});
const summaryParameters = computed(() => {
  const savedParameters = props.selectedObservabilityProfile?.parameters ?? [];
  if (savedParameters.length > 0) return savedParameters;
  return attachedVersion.value?.parameters ?? [];
});
const selectedParameter = computed(
  () => summaryParameters.value.find((parameter) => parameter.id === selectedParameterId.value) ?? summaryParameters.value[0] ?? null
);
const isLoading = computed(() => props.loadingProfileAgentId === props.selectedAgentPanel.id);
const isVersionManaged = computed(() => Boolean(attachedVersionId.value));

watch(
  () => summaryParameters.value.map((parameter) => parameter.id).join('|'),
  () => {
    const stillExists = summaryParameters.value.some((parameter) => parameter.id === selectedParameterId.value);
    if (!stillExists) {
      selectedParameterId.value = summaryParameters.value[0]?.id ?? '';
    }
  },
  { immediate: true }
);

watch(
  () => attachedVersionId.value,
  (versionId) => {
    selectedVersionId.value = versionId || props.parameterVersions[0]?.id || '';
  },
  { immediate: true }
);

watch(
  () => props.parameterVersions.map((version) => version.id).join('|'),
  () => {
    const selectedExists = props.parameterVersions.some((version) => version.id === selectedVersionId.value);
    if (!selectedExists) {
      selectedVersionId.value = attachedVersionId.value || props.parameterVersions[0]?.id || '';
    }
  }
);

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

function applySelectedVersion() {
  if (!selectedVersionId.value) return;

  emit('apply-parameter-version', {
    agent: props.selectedAgentPanel,
    versionId: selectedVersionId.value
  });
}

function openLlmParameters(versionId = attachedVersionId.value || selectedVersionId.value) {
  emit('open-llm-parameters', versionId || '');
}
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">Observability parameters</p>
        <h3>Transcript review checks</h3>
      </div>
      <button class="text-button compact" type="button" @click="openLlmParameters()">
        <ExternalLink :size="15" />
        {{ isVersionManaged ? 'Manage version' : 'Manage LLM parameters' }}
      </button>
    </header>

    <p v-if="isLoading" class="empty-copy">
      Loading observability parameters.
    </p>

    <section v-else class="summary-tab-panel parameter-edit-shell">
      <section class="parameter-version-selector" :class="{ 'needs-attachment': !isVersionManaged }">
        <div>
          <p class="eyebrow">{{ isVersionManaged ? 'Selected version' : 'Action required' }}</p>
          <h4>{{ attachedVersionName || 'Attach LLM parameters' }}</h4>
          <p>
            {{
              isVersionManaged
                ? 'This reusable checklist is attached to this agent and will be used for transcript analysis.'
                : 'Select a reusable checklist so the LLM knows how to judge this agent.'
            }}
          </p>
        </div>
        <label>
          Version
          <select v-model="selectedVersionId" :disabled="parameterVersions.length === 0">
            <option v-if="parameterVersions.length === 0" value="">No parameter versions available</option>
            <option v-for="version in parameterVersions" :key="version.id" :value="version.id">
              {{ version.name }} {{ version.versionLabel }}
            </option>
          </select>
        </label>
        <button
          class="text-button compact primary"
          type="button"
          :disabled="!selectedVersionId || savingProfileAgentId === selectedAgentPanel.id"
          @click="applySelectedVersion"
        >
          {{ savingProfileAgentId === selectedAgentPanel.id ? 'Saving' : isVersionManaged ? 'Switch version' : 'Attach version' }}
        </button>
      </section>

      <div class="parameter-count-line">
        <span>{{ summaryParameters.length }} parameters</span>
        <p>
          These checks are managed in the LLM Parameters section. Agents only attach and read the selected version here.
        </p>
      </div>

      <div v-if="summaryParameters.length === 0" class="parameter-empty-state compact">
        <span>{{ isVersionManaged ? 'Version empty' : 'Action required' }}</span>
        <h4>{{ isVersionManaged ? 'This version has no parameters yet' : 'Attach LLM parameters' }}</h4>
        <p>
          {{
            isVersionManaged
              ? 'Open the selected LLM parameter version to add reusable transcript checks.'
              : 'Attach an LLM parameter version above, or create one in the LLM Parameters section.'
          }}
        </p>
        <button class="text-button compact" type="button" @click="openLlmParameters()">
          <ExternalLink :size="15" />
          Open LLM Parameters
        </button>
      </div>

      <div v-else class="parameter-read-workbench">
        <aside class="parameter-rail readonly" aria-label="Attached observability parameters">
          <button
            v-for="(parameter, index) in summaryParameters"
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

        <article v-if="selectedParameter" class="parameter-read-detail">
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
            <span>Action suggestion when missed</span>
            <p>{{ selectedParameter.recommendation }}</p>
          </section>

          <section v-if="selectedParameter.promptGuidance" class="parameter-read-note">
            <span>Prompt/script guidance</span>
            <p>{{ selectedParameter.promptGuidance }}</p>
          </section>

          <section class="parameter-read-note parameter-managed-note">
            <span>Managed by version</span>
            <p>Edit this reusable checklist from the LLM Parameters section. Any agent attached to this version will use the updated checks.</p>
            <button class="text-button compact" type="button" @click="openLlmParameters(attachedVersionId)">
              <ExternalLink :size="15" />
              Manage this version
            </button>
          </section>
        </article>
      </div>

      <p v-if="profileEditError" class="edit-error">{{ profileEditError }}</p>
      <p v-if="profileEditMessage" class="edit-success">{{ profileEditMessage }}</p>
    </section>
  </section>
</template>
