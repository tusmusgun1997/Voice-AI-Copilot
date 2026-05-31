<script setup>
defineProps({
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
  },
  topRecommendation: {
    type: Object,
    default: null
  }
});

defineEmits(['set-view', 'show-agent', 'show-call']);
</script>

<template>
  <section class="overview-page">
    <section class="overview-hero" aria-label="Observability summary">
      <div class="overview-hero-main">
        <p class="eyebrow">Live observability</p>
        <h2>{{ overviewHealthLabel }}</h2>
        <p>
          {{ dashboard.summary.totalCalls }} calls monitored across {{ dashboard.summary.monitoredAgents }} agents.
          {{ criticalIssueCount }} critical issues and {{ filteredUseActions.length }} open actions are in queue.
        </p>
        <div class="overview-hero-actions">
          <button class="detail-button" type="button" @click="$emit('set-view', 'recommendations')">
            Review recommendations
          </button>
          <button class="detail-button secondary" type="button" @click="$emit('set-view', 'calls')">
            Open call queue
          </button>
        </div>
      </div>

      <aside class="overview-score-panel">
        <span>Average score</span>
        <strong :class="helpers.scoreClass(dashboard.summary.averageScore)">
          {{ helpers.formatScore(dashboard.summary.averageScore) }}
        </strong>
        <small>{{ dashboard.summary.analyzedCalls }} analyzed calls</small>
      </aside>
    </section>

    <section class="overview-metric-strip">
      <article>
        <span>Calls</span>
        <strong>{{ dashboard.summary.totalCalls }}</strong>
        <small>{{ dashboard.summary.pendingCalls }} pending</small>
      </article>
      <article>
        <span>Agents</span>
        <strong>{{ dashboard.summary.monitoredAgents }}</strong>
        <small>{{ selectedAgentName }}</small>
      </article>
      <article>
        <span>Critical</span>
        <strong>{{ criticalIssueCount }}</strong>
        <small>{{ dashboard.summary.topFailedKpi }}</small>
      </article>
      <article>
        <span>Actions</span>
        <strong>{{ filteredUseActions.length }}</strong>
        <small>open review items</small>
      </article>
    </section>

    <section class="loop-strip" aria-label="Observability workflow">
      <button type="button" @click="$emit('set-view', 'calls')">
        <span>1</span>
        <div>
          <strong>Raw logs</strong>
          <small>Call transcript timeline</small>
        </div>
      </button>
      <button type="button" @click="$emit('set-view', 'calls')">
        <span>2</span>
        <div>
          <strong>Risk review</strong>
          <small>Critical issues and KPI misses</small>
        </div>
      </button>
      <button type="button" @click="$emit('set-view', 'recommendations')">
        <span>3</span>
        <div>
          <strong>Agent fixes</strong>
          <small>Recommended prompt/script updates</small>
        </div>
      </button>
      <button type="button" @click="$emit('set-view', 'recommendations')">
        <span>4</span>
        <div>
          <strong>Use actions</strong>
          <small>Human follow-up and training queue</small>
        </div>
      </button>
    </section>

    <section class="overview-grid primary">
      <article class="overview-panel priority">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">Priority</p>
            <h2>{{ topRecommendation?.title || 'No urgent recommendation' }}</h2>
          </div>
          <button class="detail-button secondary" type="button" @click="$emit('set-view', 'recommendations')">
            View recommendations
          </button>
        </div>
        <p>{{ topRecommendation?.detail || 'Current calls are meeting the configured observability checks.' }}</p>

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

      <aside class="overview-panel compact">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">Agents</p>
            <h2>Snapshot</h2>
          </div>
        </div>
        <div class="overview-agent-list">
          <button v-for="agent in overviewAgents" :key="agent.id" type="button" @click="$emit('show-agent', agent.id)">
            <span class="agent-avatar">{{ helpers.agentInitials(agent.displayName) }}</span>
            <div>
              <strong>{{ agent.displayName }}</strong>
              <small>{{ agent.callCount }} calls - {{ agent.issueCount }} issues</small>
            </div>
            <span class="mini-score" :class="helpers.scoreClass(agent.averageScore)">
              {{ helpers.formatScore(agent.averageScore) }}
            </span>
          </button>
        </div>
      </aside>
    </section>

    <section class="overview-grid secondary">
      <article class="overview-panel">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">KPI Pressure</p>
            <h2>Failure rate</h2>
          </div>
        </div>
        <div class="overview-kpi-list">
          <article v-for="kpi in overviewKpis" :key="kpi.id">
            <div>
              <strong>{{ kpi.label }}</strong>
              <small>{{ kpi.failed }} failed - {{ kpi.passed }} passed</small>
            </div>
            <span>{{ kpi.failureRate }}%</span>
            <div class="kpi-bar">
              <i :style="{ width: `${kpi.failureRate}%` }"></i>
            </div>
          </article>
        </div>
      </article>

      <article class="overview-panel">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">Recent Calls</p>
            <h2>Timeline</h2>
          </div>
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

      <article class="overview-panel">
        <div class="overview-panel-heading">
          <div>
            <p class="eyebrow">Use Actions</p>
            <h2>Open queue</h2>
          </div>
        </div>
        <div class="overview-action-list">
          <button v-for="action in overviewActions" :key="action.id" type="button" @click="$emit('show-call', action.callId)">
            <span class="severity-dot" :class="action.severity"></span>
            <div>
              <strong>{{ action.type }}</strong>
              <small>{{ action.contactName }} - {{ helpers.displayAgentName(action.agentId, action.agentName) }}</small>
            </div>
          </button>
          <p v-if="overviewActions.length === 0" class="empty-copy">No open actions for the current filters.</p>
        </div>
      </article>
    </section>
  </section>
</template>
