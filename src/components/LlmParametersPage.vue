<script setup>
import { Check, CopyPlus, Plus, Save, Trash2, X } from '@lucide/vue';
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
  focusVersionId: {
    type: String,
    default: ''
  }
});

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const message = ref('');
const versions = ref([]);
const templates = ref([]);
const selectedVersionId = ref('');
const editingVersionId = ref('');
const selectedParameterId = ref('');
const versionDrafts = ref({});
const createModalOpen = ref(false);
const createForm = ref(defaultCreateForm());
const emit = defineEmits(['versions-changed']);

const selectedVersion = computed(
  () => versions.value.find((version) => version.id === selectedVersionId.value) ?? versions.value[0] ?? null
);
const selectedDraft = computed(() => versionDrafts.value[editingVersionId.value] ?? null);
const activeParameters = computed(() =>
  selectedDraft.value && editingVersionId.value === selectedVersion.value?.id
    ? selectedDraft.value.parameters
    : selectedVersion.value?.parameters ?? []
);
const selectedParameter = computed(
  () => activeParameters.value.find((parameter) => parameter.id === selectedParameterId.value) ?? activeParameters.value[0] ?? null
);
const selectedTemplate = computed(
  () => templates.value.find((template) => template.id === createForm.value.sourceTemplateId) ?? templates.value[0] ?? null
);

onMounted(loadVersions);

watch(
  () => props.focusVersionId,
  (versionId) => {
    focusVersion(versionId);
  }
);

async function loadVersions() {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('/api/llm-parameter-versions');
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || 'Unable to load LLM parameter versions');
    }

    versions.value = body.versions ?? [];
    templates.value = body.templates ?? [];
    const focusedVersionId = versions.value.some((version) => version.id === props.focusVersionId)
      ? props.focusVersionId
      : '';
    selectedVersionId.value = focusedVersionId || selectedVersionId.value || body.defaultVersion?.id || versions.value[0]?.id || '';
    ensureSelectedParameter();
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    loading.value = false;
  }
}

function defaultCreateForm(overrides = {}) {
  return {
    sourceTemplateId: 'default-lead-qualification-v1',
    name: '',
    versionLabel: '',
    description: '',
    includeTemplateParameters: true,
    editAfterCreate: true,
    ...overrides
  };
}

function openCreateModal(overrides = {}) {
  createForm.value = defaultCreateForm({
    sourceTemplateId: templates.value[0]?.id || 'default-lead-qualification-v1',
    ...overrides
  });
  error.value = '';
  message.value = '';
  createModalOpen.value = true;
}

function closeCreateModal() {
  if (saving.value) return;
  createModalOpen.value = false;
}

async function createVersion() {
  saving.value = true;
  error.value = '';
  message.value = '';

  try {
    const form = createForm.value;
    const sourceTemplateId = form.sourceTemplateId;
    const source = templates.value.find((template) => template.id === sourceTemplateId) ?? selectedTemplate.value;
    const name = form.name || source?.name || 'Custom LLM parameters';
    const versionLabel = form.versionLabel || '';
    const description = form.description || source?.description || '';
    const response = await fetch('/api/llm-parameter-versions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceTemplateId,
        name,
        versionLabel,
        description,
        includeTemplateParameters: Boolean(form.includeTemplateParameters)
      })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || 'Unable to create parameter version');
    }

    await loadVersions();
    selectedVersionId.value = body.version.id;
    if (form.editAfterCreate) {
      startEditVersion(body.version);
    } else {
      editingVersionId.value = '';
    }
    emit('versions-changed');
    message.value = form.includeTemplateParameters
      ? 'Version created with starter parameters.'
      : 'Blank version created. Add parameters when ready.';
    createModalOpen.value = false;
    createForm.value = defaultCreateForm();
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    saving.value = false;
  }
}

function createCustomCopy(version) {
  if (!version) return;

  openCreateModal({
    sourceTemplateId: version.id,
    name: `${version.name} copy`,
    versionLabel: '',
    description: version.description || '',
    includeTemplateParameters: true,
    editAfterCreate: true
  });
}

function selectVersion(version) {
  selectedVersionId.value = version.id;
  editingVersionId.value = '';
  ensureSelectedParameter();
}

function focusVersion(versionId) {
  if (!versionId || versions.value.length === 0) return;

  const versionExists = versions.value.some((version) => version.id === versionId);
  if (!versionExists) return;

  selectedVersionId.value = versionId;
  editingVersionId.value = '';
  ensureSelectedParameter();
}

function startEditVersion(version = selectedVersion.value) {
  if (!version || version.locked) return;

  editingVersionId.value = version.id;
  versionDrafts.value = {
    ...versionDrafts.value,
    [version.id]: versionToDraft(version)
  };
  ensureSelectedParameter();
}

function cancelEdit() {
  editingVersionId.value = '';
  error.value = '';
}

async function saveVersion() {
  const draft = selectedDraft.value;
  if (!draft) return;

  saving.value = true;
  error.value = '';
  message.value = '';

  try {
    const response = await fetch(`/api/llm-parameter-versions/${draft.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(draftToVersion(draft))
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || 'Unable to save parameter version');
    }

    await loadVersions();
    selectedVersionId.value = body.version.id;
    editingVersionId.value = '';
    emit('versions-changed');
    message.value = 'LLM parameter version saved.';
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    saving.value = false;
  }
}

function addParameter() {
  if (!selectedDraft.value) return;

  const parameter = {
    id: `parameter-${Date.now()}`,
    title: '',
    description: '',
    category: 'custom',
    successSignalsText: '',
    failureSignalsText: '',
    recommendation: '',
    promptGuidance: '',
    requiresHumanReview: false,
    useActionType: '',
    enabled: true
  };

  selectedDraft.value.parameters.push(parameter);
  selectedParameterId.value = parameter.id;
}

function addFirstParameter() {
  if (!selectedDraft.value && selectedVersion.value && !selectedVersion.value.locked) {
    startEditVersion(selectedVersion.value);
  }

  addParameter();
}

function removeParameter(parameter) {
  if (!selectedDraft.value || !parameter) return;

  selectedDraft.value.parameters = selectedDraft.value.parameters.filter((item) => item.id !== parameter.id);
  selectedParameterId.value = selectedDraft.value.parameters[0]?.id ?? '';
}

function ensureSelectedParameter() {
  const parameters = activeParameters.value;
  if (!parameters.some((parameter) => parameter.id === selectedParameterId.value)) {
    selectedParameterId.value = parameters[0]?.id ?? '';
  }
}

function versionToDraft(version) {
  return {
    id: version.id,
    name: version.name || '',
    versionLabel: version.versionLabel || '',
    description: version.description || '',
    parameters: (version.parameters ?? []).map(parameterToDraft)
  };
}

function draftToVersion(draft) {
  return {
    name: draft.name,
    versionLabel: draft.versionLabel,
    description: draft.description,
    parameters: draft.parameters
      .map((parameter) => ({
        id: parameter.id,
        title: parameter.title,
        description: parameter.description,
        category: parameter.category || 'custom',
        successSignals: splitList(parameter.successSignalsText),
        failureSignals: splitList(parameter.failureSignalsText),
        recommendation: parameter.recommendation,
        promptGuidance: parameter.promptGuidance,
        requiresHumanReview: Boolean(parameter.requiresHumanReview),
        useActionType: parameter.useActionType,
        enabled: parameter.enabled !== false
      }))
      .filter((parameter) => parameter.title || parameter.description)
  };
}

function parameterToDraft(parameter) {
  return {
    id: parameter.id,
    title: parameter.title || '',
    description: parameter.description || '',
    category: parameter.category || 'custom',
    successSignalsText: (parameter.successSignals ?? []).join(', '),
    failureSignalsText: (parameter.failureSignals ?? []).join(', '),
    recommendation: parameter.recommendation || '',
    promptGuidance: parameter.promptGuidance || '',
    requiresHumanReview: Boolean(parameter.requiresHumanReview),
    useActionType: parameter.useActionType || '',
    enabled: parameter.enabled !== false
  };
}

function parameterPreview(parameter) {
  return parameter?.description || 'No analysis description added yet.';
}

function splitList(value) {
  return String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
</script>

<template>
  <section class="llm-parameters-page">
    <header class="workspace-list-heading">
      <div>
        <p class="eyebrow">LLM parameters</p>
        <h2>Reusable parameter versions</h2>
        <p>
          Build transcript evaluation checklists once, version them, and attach the right version to each agent.
        </p>
      </div>
      <div class="workspace-heading-actions">
        <span>{{ versions.length }} versions</span>
        <button class="text-button compact primary" type="button" @click="openCreateModal()">
          <Plus :size="15" />
          New version
        </button>
      </div>
    </header>

    <teleport to="body">
      <div v-if="createModalOpen" class="parameter-create-backdrop" @click.self="closeCreateModal">
        <section class="parameter-create-modal" aria-modal="true" role="dialog">
          <header class="parameter-create-header">
            <div>
              <p class="eyebrow">New parameter version</p>
              <h3>Create an LLM checklist</h3>
              <p>
                Start blank or copy a starter template. You can edit the parameter set immediately or come back later.
              </p>
            </div>
            <button class="icon-button" type="button" aria-label="Close modal" @click="closeCreateModal">
              <X :size="18" />
            </button>
          </header>

          <section v-if="error" class="error-band inline parameter-create-error">
            <span>{{ error }}</span>
          </section>

          <div class="parameter-create-form">
            <label class="wide">
              Name
              <input v-model="createForm.name" type="text" placeholder="Example: Home renovation intake" />
            </label>
            <label>
              Version
              <input v-model="createForm.versionLabel" type="text" placeholder="Example: v1" />
            </label>
            <label>
              Starter template
              <select v-model="createForm.sourceTemplateId">
                <option v-for="template in templates" :key="template.id" :value="template.id">
                  {{ template.name }} {{ template.versionLabel }}
                </option>
              </select>
            </label>
            <label class="wide">
              Basic details
              <textarea
                v-model="createForm.description"
                rows="3"
                placeholder="What kind of calls or agents should use this version?"
              ></textarea>
            </label>
          </div>

          <div class="parameter-create-options">
            <button
              type="button"
              :class="{ active: createForm.includeTemplateParameters }"
              @click="createForm.includeTemplateParameters = true"
            >
              <strong>Copy starter parameters</strong>
              <span>Best when you want a ready checklist and will tune it.</span>
            </button>
            <button
              type="button"
              :class="{ active: !createForm.includeTemplateParameters }"
              @click="createForm.includeTemplateParameters = false"
            >
              <strong>Start blank</strong>
              <span>Best when you want to define every check yourself.</span>
            </button>
          </div>

          <label class="parameter-create-checkbox">
            <input v-model="createForm.editAfterCreate" type="checkbox" />
            Open this version in edit mode after creating it
          </label>

          <footer class="parameter-create-footer">
            <button class="text-button compact" type="button" @click="closeCreateModal">
              Cancel
            </button>
            <button class="text-button compact primary" type="button" :disabled="saving" @click="createVersion">
              <CopyPlus :size="15" />
              {{ saving ? 'Creating' : 'Create version' }}
            </button>
          </footer>
        </section>
      </div>
    </teleport>

    <section v-if="error" class="error-band inline">
      <span>{{ error }}</span>
    </section>
    <section v-if="message" class="edit-success">
      {{ message }}
    </section>

    <section v-if="loading" class="loading-state inline">
      Loading LLM parameter versions
    </section>

    <section v-else class="parameter-version-workbench">
      <aside class="parameter-version-rail">
        <button
          v-for="version in versions"
          :key="version.id"
          type="button"
          :class="{ active: selectedVersion?.id === version.id }"
          @click="selectVersion(version)"
        >
          <span>{{ version.locked ? 'Default' : 'Custom' }}</span>
          <strong>{{ version.name }}</strong>
          <small>{{ version.versionLabel }} - {{ version.parameters.length }} parameters</small>
        </button>
      </aside>

      <article v-if="selectedVersion" class="parameter-version-detail">
        <header class="parameter-version-header">
          <div>
            <p class="eyebrow">{{ selectedVersion.locked ? 'Default version' : 'Custom version' }}</p>
            <h3>{{ selectedVersion.name }} {{ selectedVersion.versionLabel }}</h3>
            <p>{{ selectedVersion.description }}</p>
          </div>
          <div class="parameter-version-actions">
            <button
              v-if="!selectedVersion.locked && editingVersionId !== selectedVersion.id"
              class="text-button compact"
              type="button"
              @click="startEditVersion(selectedVersion)"
            >
              Edit version
            </button>
            <button
              v-if="selectedVersion.locked"
              class="text-button compact primary"
              type="button"
              :disabled="saving"
              @click="createCustomCopy(selectedVersion)"
            >
              <CopyPlus :size="15" />
              Create custom copy
            </button>
          </div>
        </header>

        <div v-if="selectedDraft" class="version-meta-editor">
          <label>
            Version name
            <input v-model="selectedDraft.name" type="text" />
          </label>
          <label>
            Version label
            <input v-model="selectedDraft.versionLabel" type="text" />
          </label>
          <label class="wide">
            Description
            <textarea v-model="selectedDraft.description" rows="3"></textarea>
          </label>
        </div>

        <div class="parameter-version-body" :class="{ empty: activeParameters.length === 0 }">
          <aside v-if="activeParameters.length > 0" class="parameter-rail readonly">
            <button
              v-for="(parameter, index) in activeParameters"
              :key="parameter.id"
              class="parameter-rail-item"
              :class="{ active: selectedParameter?.id === parameter.id, disabled: parameter.enabled === false }"
              type="button"
              @click="selectedParameterId = parameter.id"
            >
              <span>{{ index + 1 }}</span>
              <strong>{{ parameter.title || `Parameter ${index + 1}` }}</strong>
              <small>{{ parameterPreview(parameter) }}</small>
            </button>

            <button
              v-if="selectedDraft"
              class="text-button compact add-version-parameter"
              type="button"
              @click="addParameter"
            >
              <Plus :size="15" />
              Add parameter
            </button>
          </aside>

          <section v-if="selectedParameter && !selectedDraft" class="parameter-read-detail">
            <div class="parameter-read-top">
              <div>
                <p class="eyebrow">Selected check</p>
                <h4>{{ selectedParameter.title }}</h4>
              </div>
              <span>{{ selectedParameter.requiresHumanReview ? 'Human action' : 'Transcript check' }}</span>
            </div>
            <p>{{ selectedParameter.description }}</p>
            <section v-if="selectedParameter.recommendation" class="parameter-read-note">
              <span>Recommendation when missed</span>
              <p>{{ selectedParameter.recommendation }}</p>
            </section>
            <section v-if="selectedParameter.promptGuidance" class="parameter-read-note">
              <span>Prompt/script guidance</span>
              <p>{{ selectedParameter.promptGuidance }}</p>
            </section>
          </section>

          <section v-else-if="selectedParameter && selectedDraft" class="parameter-read-detail parameter-inline-editor">
            <div class="parameter-read-top">
              <div>
                <p class="eyebrow">Version parameter</p>
                <h4>{{ selectedParameter.title || 'Untitled parameter' }}</h4>
              </div>
              <label class="parameter-toggle">
                <input v-model="selectedParameter.enabled" type="checkbox" />
                Enabled
              </label>
            </div>

            <label class="inline-edit-field">
              <span>Title</span>
              <input v-model="selectedParameter.title" type="text" />
            </label>
            <label class="inline-edit-field">
              <span>Description for analysis</span>
              <textarea v-model="selectedParameter.description" rows="5"></textarea>
            </label>

            <div class="parameter-read-grid">
              <label class="inline-edit-field">
                <span>Success signal hints</span>
                <textarea v-model="selectedParameter.successSignalsText" rows="4"></textarea>
              </label>
              <label class="inline-edit-field">
                <span>Failure signal hints</span>
                <textarea v-model="selectedParameter.failureSignalsText" rows="4"></textarea>
              </label>
            </div>

            <div class="parameter-read-grid">
              <label class="inline-edit-field">
                <span>Recommendation when missed</span>
                <textarea v-model="selectedParameter.recommendation" rows="4"></textarea>
              </label>
              <label class="inline-edit-field">
                <span>Prompt/script guidance</span>
                <textarea v-model="selectedParameter.promptGuidance" rows="4"></textarea>
              </label>
            </div>

            <div class="parameter-human-review">
              <label class="parameter-toggle">
                <input v-model="selectedParameter.requiresHumanReview" type="checkbox" />
                Create human action when missed
              </label>
              <label v-if="selectedParameter.requiresHumanReview" class="inline-edit-field compact">
                <span>Action type</span>
                <input v-model="selectedParameter.useActionType" type="text" />
              </label>
            </div>

            <div class="inline-save-bar">
              <button class="text-button compact danger" type="button" @click="removeParameter(selectedParameter)">
                <Trash2 :size="14" />
                Remove
              </button>
              <span></span>
              <button class="text-button compact" type="button" @click="cancelEdit">
                Cancel
              </button>
              <button class="text-button compact primary" type="button" :disabled="saving" @click="saveVersion">
                <Save :size="14" />
                {{ saving ? 'Saving' : 'Save version' }}
              </button>
            </div>
          </section>

          <section v-else class="parameter-empty-state compact">
            <Check :size="22" />
            <h4>No parameters in this version yet</h4>
            <p>Add at least one parameter so agents can use this version for call analysis.</p>
            <button
              v-if="selectedDraft || !selectedVersion.locked"
              class="text-button compact primary"
              type="button"
              @click="addFirstParameter"
            >
              <Plus :size="15" />
              Add parameter
            </button>
          </section>
        </div>
      </article>
    </section>
  </section>
</template>
