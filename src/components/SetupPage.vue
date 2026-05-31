<script setup>
defineProps({
  dashboard: {
    type: Object,
    required: true
  },
  helpers: {
    type: Object,
    required: true
  },
  sourceLabel: {
    type: String,
    required: true
  }
});
</script>

<template>
  <section class="setup-page">
    <div class="workspace-list-heading">
      <div>
        <p class="eyebrow">Setup</p>
        <h2>Runtime status</h2>
      </div>
      <span>{{ sourceLabel }}</span>
    </div>

    <div class="settings-table">
      <div>
        <span>Data source</span>
        <strong>{{ sourceLabel }}</strong>
      </div>
      <div>
        <span>Location ID</span>
        <strong>{{ dashboard.locationId || 'Not configured' }}</strong>
      </div>
      <div>
        <span>Live records</span>
        <strong>{{ dashboard.liveRecordCount }}</strong>
      </div>
      <div>
        <span>Generated at</span>
        <strong>{{ helpers.formatDate(dashboard.generatedAt) }}</strong>
      </div>
      <div>
        <span>Analyzed</span>
        <strong>{{ dashboard.dataStates.analyzed || 0 }}</strong>
      </div>
      <div>
        <span>Pending transcripts</span>
        <strong>{{ dashboard.dataStates.transcript_missing || 0 }}</strong>
      </div>
    </div>

    <section class="setup-checks flat">
      <div class="workspace-list-heading compact">
        <div>
          <p class="eyebrow">Scoring logic</p>
          <h2>What the Copilot checks</h2>
        </div>
        <span>{{ dashboard.goalProfiles.length }} profiles</span>
      </div>

      <div class="profile-table">
        <article v-for="profile in dashboard.goalProfiles" :key="profile.id">
          <div>
            <strong>{{ profile.name }}</strong>
            <p>{{ profile.scriptSummary }}</p>
          </div>
          <span>{{ profile.callCount }} calls</span>
        </article>
      </div>
    </section>

    <section v-if="dashboard.liveError" class="error-band inline">
      <span>{{ dashboard.liveError.message }}</span>
    </section>
  </section>
</template>
