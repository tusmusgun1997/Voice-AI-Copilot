<script setup>
defineProps({
  helpers: {
    type: Object,
    required: true
  },
  selectedAgentPanel: {
    type: Object,
    required: true
  }
});

defineEmits(['show-agent-calls', 'show-call']);
</script>

<template>
  <section class="agent-section">
    <header class="agent-section-head">
      <div>
        <p class="eyebrow">Details</p>
        <h3>Operational snapshot</h3>
      </div>
      <button class="text-button compact" type="button" @click="$emit('show-agent-calls', selectedAgentPanel.id)">
        View calls
      </button>
    </header>

    <div class="agent-stats-line">
      <div>
        <span>Score</span>
        <strong :class="helpers.scoreClass(selectedAgentPanel.averageScore)">
          {{ helpers.formatScore(selectedAgentPanel.averageScore) }}
        </strong>
      </div>
      <div>
        <span>Calls</span>
        <strong>{{ selectedAgentPanel.callCount }}</strong>
      </div>
      <div>
        <span>Issues</span>
        <strong>{{ selectedAgentPanel.issueCount }}</strong>
      </div>
      <div>
        <span>Actions</span>
        <strong>{{ selectedAgentPanel.useActionCount }}</strong>
      </div>
    </div>

    <div class="agent-detail-columns">
      <section class="agent-subsection">
        <p class="eyebrow">Current focus</p>
        <div class="agent-health-line">
          <span class="agent-score" :class="helpers.scoreClass(selectedAgentPanel.averageScore)">
            {{ helpers.formatScore(selectedAgentPanel.averageScore) }}
          </span>
          <div>
            <strong>{{ selectedAgentPanel.topFailedKpi }}</strong>
            <p>{{ selectedAgentPanel.topRecommendation }}</p>
          </div>
        </div>
      </section>

      <section class="agent-subsection">
        <p class="eyebrow">Configuration</p>
        <div class="agent-detail-list">
          <div>
            <span>Business</span>
            <strong>{{ selectedAgentPanel.businessName || 'Not set' }}</strong>
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
            <span>Inbound number</span>
            <strong>{{ selectedAgentPanel.inboundNumber || 'Not assigned' }}</strong>
          </div>
          <div>
            <span>Voice ID</span>
            <strong>{{ selectedAgentPanel.voiceId || 'Not set' }}</strong>
          </div>
          <div>
            <span>HighLevel agent ID</span>
            <strong>{{ selectedAgentPanel.id }}</strong>
          </div>
        </div>
      </section>

      <section class="agent-subsection wide">
        <div class="agent-section-head compact">
          <div>
            <p class="eyebrow">Latest Calls</p>
            <h4>Recent activity</h4>
          </div>
          <button class="text-button compact" type="button" @click="$emit('show-agent-calls', selectedAgentPanel.id)">
            View all
          </button>
        </div>
        <div class="agent-mini-list">
          <button
            v-for="call in selectedAgentPanel.recentCalls"
            :key="call.id"
            type="button"
            @click="$emit('show-call', call.id)"
          >
            <span>{{ call.contactName }}</span>
            <small>{{ helpers.formatStatus(call.status) }} - {{ helpers.formatDate(call.createdAt) }}</small>
          </button>
          <p v-if="selectedAgentPanel.recentCalls.length === 0">No calls analyzed yet.</p>
        </div>
      </section>
    </div>
  </section>
</template>
