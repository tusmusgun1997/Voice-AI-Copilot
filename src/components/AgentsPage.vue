<script setup>
import { ClipboardCheck, Info, Lightbulb, MoreVertical, SlidersHorizontal } from '@lucide/vue';
import { ref } from 'vue';

defineProps({
  agentDirectory: {
    type: Array,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  }
});

const emit = defineEmits([
  'open-agent-page',
  'show-agent-recommendations'
]);

const openMenuAgentId = ref('');

function toggleAgentMenu(agentId) {
  openMenuAgentId.value = openMenuAgentId.value === agentId ? '' : agentId;
}

function openAgentSection(agentId, section) {
  openMenuAgentId.value = '';
  emit('open-agent-page', { agentId, section });
}

function openAgentRecommendations(agentId) {
  openMenuAgentId.value = '';
  emit('show-agent-recommendations', agentId);
}
</script>

<template>
  <section class="agents-page">
    <header class="agents-page-header">
      <div>
        <p class="eyebrow">Directory</p>
        <h2>Voice AI Agents</h2>
      </div>
      <span>{{ agentDirectory.length }} agents</span>
    </header>

    <div class="agent-directory clean-list">
      <article
        v-for="agent in agentDirectory"
        :key="agent.id"
        class="agent-list-row"
        :class="{ 'requires-setup': agent.needsParameterVersion }"
      >
        <button class="agent-list-main" type="button" @click="openAgentSection(agent.id, 'details')">
          <span class="agent-avatar">{{ helpers.agentInitials(agent.displayName) }}</span>
          <span class="agent-title">
            <strong>{{ agent.displayName }}</strong>
            <small>{{ agent.goalProfileName || agent.businessName || 'Voice AI agent' }}</small>
            <span v-if="agent.needsParameterVersion" class="agent-setup-pill">Attach LLM parameters</span>
            <span v-else-if="agent.parameterVersionName" class="agent-version-pill">{{ agent.parameterVersionName }}</span>
          </span>
          <span class="agent-row-insights">
            <span>
              <strong :class="helpers.scoreClass(agent.averageScore)">
                {{ helpers.formatScore(agent.averageScore) }}
              </strong>
              <small>Score</small>
            </span>
            <span>
              <strong>{{ agent.callCount }}</strong>
              <small>Calls</small>
            </span>
            <span>
              <strong>{{ agent.issueCount }}</strong>
              <small>Issues</small>
            </span>
          </span>
        </button>

        <div class="agent-row-menu" @keydown.esc="openMenuAgentId = ''">
          <button
            class="icon-button agent-menu-trigger"
            type="button"
            :aria-expanded="openMenuAgentId === agent.id"
            :aria-label="`Open actions for ${agent.displayName}`"
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
            <button type="button" role="menuitem" @click="openAgentRecommendations(agent.id)">
              <Lightbulb :size="16" />
              <span>Recommendations</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'actions')">
              <ClipboardCheck :size="16" />
              <span>Actions</span>
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
    </div>
  </section>
</template>
