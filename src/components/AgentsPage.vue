<script setup>
import { ClipboardCheck, Info, MoreVertical, Search, SlidersHorizontal, X } from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps({
  agentDirectory: {
    type: Array,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['open-agent-page']);

const openMenuAgentId = ref('');
const searchQuery = ref('');

const filteredAgents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.agentDirectory;

  return props.agentDirectory.filter((agent) =>
    [
      agent.displayName,
      agent.name,
      agent.businessName,
      agent.parameterVersionName,
      agent.id
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  );
});

function toggleAgentMenu(agentId) {
  openMenuAgentId.value = openMenuAgentId.value === agentId ? '' : agentId;
}

function openAgentSection(agentId, section) {
  openMenuAgentId.value = '';
  emit('open-agent-page', { agentId, section });
}

function passRateLabel(agent) {
  const analyzed = Number(agent.totalAnalyzedCalls || agent.analyzedCallCount || 0);
  if (!analyzed) return 'Not analyzed';
  return `${agent.passRate || 0}%`;
}
</script>

<template>
  <section class="agents-page">
    <header class="agents-page-header">
      <div>
        <p class="eyebrow">Directory</p>
        <h2>Voice AI Agents</h2>
      </div>
      <span>{{ filteredAgents.length }} of {{ agentDirectory.length }} agents</span>
    </header>

    <div class="agent-search-bar">
      <Search :size="18" />
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search agents by name, business, version, or ID"
        aria-label="Search agents"
      />
      <button
        v-if="searchQuery"
        class="agent-search-clear"
        type="button"
        aria-label="Clear search"
        @click="searchQuery = ''"
      >
        <X :size="16" />
      </button>
    </div>

    <div class="agent-directory clean-list">
      <article
        v-for="agent in filteredAgents"
        :key="agent.id"
        class="agent-list-row"
        :class="{ 'requires-setup': agent.needsParameterVersion }"
      >
        <button class="agent-list-main" type="button" @click="openAgentSection(agent.id, 'details')">
          <span class="agent-avatar">{{ helpers.agentInitials(agent.displayName) }}</span>
          <span class="agent-title">
            <strong>{{ agent.displayName }}</strong>
            <small>{{ agent.businessName || 'Voice AI agent' }}</small>
            <span v-if="agent.needsParameterVersion" class="agent-setup-pill">Attach LLM parameters</span>
            <span v-else-if="agent.parameterVersionName" class="agent-version-pill">{{ agent.parameterVersionName }}</span>
          </span>
          <span class="agent-row-insights expanded">
            <span>
              <strong :class="helpers.scoreClass(agent.averageScore)">
                {{ helpers.formatScore(agent.averageScore) }}
              </strong>
              <small>Avg score</small>
            </span>
            <span>
              <strong>{{ passRateLabel(agent) }}</strong>
              <small>Pass rate</small>
            </span>
            <span>
              <strong class="score-good">{{ agent.passedCallCount || 0 }}</strong>
              <small>Passed</small>
            </span>
            <span>
              <strong class="score-risk">{{ agent.failedCallCount || 0 }}</strong>
              <small>Failed</small>
            </span>
            <span>
              <strong>{{ agent.systemImprovementCount || 0 }}</strong>
              <small>Improvements</small>
            </span>
          </span>
        </button>

        <div class="agent-row-menu" @keydown.esc="openMenuAgentId = ''">
          <button
            class="icon-button agent-menu-trigger"
            type="button"
            :aria-expanded="openMenuAgentId === agent.id"
            :aria-label="`Open options for ${agent.displayName}`"
            @click.stop="toggleAgentMenu(agent.id)"
          >
            <MoreVertical :size="18" />
          </button>

          <div v-if="openMenuAgentId === agent.id" class="agent-menu-popover" role="menu">
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'details')">
              <Info :size="16" />
              <span>Check info</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'observability-parameters')">
              <SlidersHorizontal :size="16" />
              <span>Observability parameters</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'actions')">
              <ClipboardCheck :size="16" />
              <span>System improvements</span>
            </button>
          </div>
        </div>

        <button
          v-if="agent.needsParameterVersion"
          class="agent-required-banner"
          type="button"
          @click="openAgentSection(agent.id, 'observability-parameters')"
        >
          <SlidersHorizontal :size="16" />
          <span>
            <strong>Attach LLM parameters</strong>
            <small>This agent needs a reusable checklist before LLM call review can run.</small>
          </span>
        </button>
      </article>

      <section v-if="agentDirectory.length === 0" class="empty-directory">
        <p class="eyebrow">No agents</p>
        <h3>No Voice AI agents found yet</h3>
        <p>Create or sync an agent in the HighLevel sandbox and it will appear here.</p>
      </section>

      <section v-else-if="filteredAgents.length === 0" class="empty-directory">
        <p class="eyebrow">No matches</p>
        <h3>No agents match this search</h3>
        <p>Try searching by agent name, business name, attached parameter version, or HighLevel agent ID.</p>
      </section>
    </div>
  </section>
</template>
