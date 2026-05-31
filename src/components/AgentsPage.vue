<script setup>
import { FileText, Info, Lightbulb, MoreVertical, PhoneCall, SlidersHorizontal, Target, UserRoundCog } from '@lucide/vue';
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
  'show-agent-calls',
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

function openAgentCalls(agentId) {
  openMenuAgentId.value = '';
  emit('show-agent-calls', agentId);
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
      <article v-for="agent in agentDirectory" :key="agent.id" class="agent-list-row">
        <button class="agent-list-main" type="button" @click="openAgentSection(agent.id, 'details')">
          <span class="agent-avatar">{{ helpers.agentInitials(agent.displayName) }}</span>
          <span class="agent-title">
            <strong>{{ agent.displayName }}</strong>
            <small>{{ agent.goalProfileName || agent.businessName || 'Voice AI agent' }}</small>
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
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'agent-profile')">
              <UserRoundCog :size="16" />
              <span>Agent profile</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'highlevel-goals')">
              <Target :size="16" />
              <span>HighLevel goals</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'observability-parameters')">
              <SlidersHorizontal :size="16" />
              <span>Observability parameters</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentSection(agent.id, 'prompt')">
              <FileText :size="16" />
              <span>Prompt</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentCalls(agent.id)">
              <PhoneCall :size="16" />
              <span>Calls</span>
            </button>
            <button type="button" role="menuitem" @click="openAgentRecommendations(agent.id)">
              <Lightbulb :size="16" />
              <span>Recommendations</span>
            </button>
          </div>
        </div>
      </article>

      <section v-if="agentDirectory.length === 0" class="empty-directory">
        <p class="eyebrow">No agents</p>
        <h3>No Voice AI agents found yet</h3>
        <p>Create or sync an agent in the HighLevel sandbox and it will appear here.</p>
      </section>
    </div>
  </section>
</template>
