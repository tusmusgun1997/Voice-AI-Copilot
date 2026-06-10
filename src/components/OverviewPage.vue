<script setup>
const props = defineProps({
  criticalIssueCount: {
    type: Number,
    required: true
  },
  dashboard: {
    type: Object,
    required: true
  },
  filteredUseActions: {
    type: Array,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  },
  latestCalls: {
    type: Array,
    required: true
  },
  overviewActions: {
    type: Array,
    required: true
  },
  overviewAgents: {
    type: Array,
    required: true
  },
  overviewHealthLabel: {
    type: String,
    required: true
  },
  overviewIssues: {
    type: Array,
    required: true
  },
  overviewKpis: {
    type: Array,
    required: true
  },
  selectedAgentName: {
    type: String,
    required: true
  }
});

defineEmits(['set-view', 'show-agent', 'show-call']);

function setupMessage() {
  const missingCount = props.overviewAgents.filter((agent) => agent.needsParameterVersion).length;
  if (missingCount > 0) {
    return `${missingCount} agent${missingCount === 1 ? '' : 's'} need LLM parameters attached.`;
  }

  return 'Agent setup is ready for transcript analysis.';
}
</script>

<template>
  <section class="overview-page simple">
    <section class="overview-brief">
      <div>
        <p class="eyebrow">Overview</p>
        <h2>{{ overviewHealthLabel }}</h2>
        <p>
          {{ dashboard.summary.totalCalls }} calls across {{ dashboard.summary.monitoredAgents }} agents.
          {{ criticalIssueCount }} critical issues and {{ filteredUseActions.length }} system improvements need review.
        </p>
      </div>
      <button class="detail-button" type="button" @click="$emit('set-view', 'calls')">
        Review calls
      </button>
    </section>

    <section class="overview-grid primary simple">
      <article class="overview-panel">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">Latest Calls</p>
            <h2>Recent activity</h2>
          </div>
          <button class="text-button compact" type="button" @click="$emit('set-view', 'calls')">
            View all
          </button>
        </div>
        <div class="overview-call-list">
          <button v-for="call in latestCalls" :key="call.id" type="button" @click="$emit('show-call', call.id)">
            <span class="mini-score" :class="helpers.scoreClass(call.score)">{{ helpers.formatScore(call.score) }}</span>
            <div>
              <strong>{{ call.contactName }}</strong>
              <small>{{ helpers.displayAgentName(call.agentId, call.agentName) }} - {{ helpers.formatDate(call.createdAt) }}</small>
            </div>
            <span class="status-badge" :class="call.status">{{ helpers.formatStatus(call.status) }}</span>
          </button>
          <p v-if="latestCalls.length === 0" class="empty-copy">No calls match the current filters.</p>
        </div>
      </article>

      <aside class="overview-panel compact">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">Setup</p>
            <h2>Agent readiness</h2>
          </div>
          <button class="text-button compact" type="button" @click="$emit('set-view', 'agents')">
            Agents
          </button>
        </div>
        <p>{{ setupMessage() }}</p>
        <div class="overview-agent-list">
          <button v-for="agent in overviewAgents" :key="agent.id" type="button" @click="$emit('show-agent', agent.id)">
            <span class="agent-avatar">{{ helpers.agentInitials(agent.displayName) }}</span>
            <div>
              <strong>{{ agent.displayName }}</strong>
              <small>
                {{ agent.needsParameterVersion ? 'Attach LLM parameters' : agent.parameterVersionName || 'Ready' }}
              </small>
            </div>
            <span v-if="agent.needsParameterVersion" class="setup-status needs">Needs setup</span>
            <span v-else class="setup-status ready">Ready</span>
          </button>
        </div>
      </aside>
    </section>

    <section class="overview-grid secondary simple">
      <article class="overview-panel">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">Attention</p>
            <h2>Top issues</h2>
          </div>
        </div>
        <div class="signal-list">
          <button v-for="issue in overviewIssues" :key="issue.id" type="button" @click="$emit('show-call', issue.callId)">
            <span class="severity-pill" :class="helpers.severityClass(issue.severity)">
              {{ helpers.formatSeverity(issue.severity) }}
            </span>
            <div>
              <strong>{{ issue.label }}</strong>
              <small>{{ helpers.displayAgentName(issue.agentId, issue.agentName) }} - {{ issue.contactName }}</small>
            </div>
          </button>
          <p v-if="overviewIssues.length === 0" class="empty-copy">No critical signals for the current filters.</p>
        </div>
      </article>

      <article class="overview-panel">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">System improvements</p>
            <h2>Agent setup queue</h2>
          </div>
          <button class="text-button compact" type="button" @click="$emit('set-view', 'actions')">
            View all
          </button>
        </div>
        <div class="overview-action-list">
          <button v-for="action in overviewActions" :key="action.id" type="button" @click="action.callId && $emit('show-call', action.callId)">
            <span class="severity-dot" :class="action.severity"></span>
            <div>
              <strong>{{ action.title || action.type }}</strong>
              <small>{{ helpers.displayAgentName(action.agentId, action.agentName) }}</small>
            </div>
          </button>
          <p v-if="overviewActions.length === 0" class="empty-copy">No open system improvements for the current filters.</p>
        </div>
      </article>
    </section>
  </section>
</template>

