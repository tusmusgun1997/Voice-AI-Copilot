<script setup>
import { Lightbulb } from '@lucide/vue';

defineProps({
  helpers: {
    type: Object,
    required: true
  },
  recommendationGroups: {
    type: Array,
    required: true
  },
  selectedRecommendationGroup: {
    type: Object,
    default: null
  }
});

defineEmits(['select-agent', 'show-call']);
</script>

<template>
  <section class="view-stack">
    <section class="recommendations-page">
      <aside class="recommendation-agent-rail">
        <div class="recommendation-agent-rail-heading">
          <div>
            <p class="eyebrow">Agents</p>
            <h2>Recommendation Queue</h2>
          </div>
          <span>{{ recommendationGroups.length }}</span>
        </div>

        <div class="recommendation-agent-list">
          <button
            v-for="group in recommendationGroups"
            :key="group.id"
            class="recommendation-agent-option"
            :class="{ active: selectedRecommendationGroup && group.id === selectedRecommendationGroup.id }"
            type="button"
            @click="$emit('select-agent', group.id)"
          >
            <span class="agent-avatar">{{ helpers.agentInitials(group.displayName) }}</span>
            <span class="recommendation-agent-copy">
              <strong>{{ group.displayName }}</strong>
              <small>{{ group.calls.length }} calls - {{ group.recommendations.length }} fixes</small>
            </span>
            <span class="recommendation-agent-score" :class="helpers.scoreClass(group.averageScore)">
              {{ helpers.formatScore(group.averageScore) }}
            </span>
          </button>
        </div>

        <p v-if="recommendationGroups.length === 0" class="empty-copy">
          No agents match the current filters.
        </p>
      </aside>

      <section v-if="selectedRecommendationGroup" class="recommendation-focus">
        <header class="recommendation-focus-header">
          <div class="agent-recommendation-title">
            <span class="agent-avatar large">{{ helpers.agentInitials(selectedRecommendationGroup.displayName) }}</span>
            <div>
              <p class="eyebrow">Selected agent</p>
              <h2>{{ selectedRecommendationGroup.displayName }}</h2>
              <p>
                {{ selectedRecommendationGroup.calls.length }} calls reviewed -
                {{ selectedRecommendationGroup.issues.length }} issues -
                {{ selectedRecommendationGroup.actions.length }} actions
              </p>
            </div>
          </div>

          <div class="agent-recommendation-stats">
            <span>
              <strong>{{ helpers.formatScore(selectedRecommendationGroup.averageScore) }}</strong>
              <small>Score</small>
            </span>
            <span>
              <strong>{{ selectedRecommendationGroup.recommendations.length }}</strong>
              <small>Fixes</small>
            </span>
            <span>
              <strong>{{ selectedRecommendationGroup.actions.length }}</strong>
              <small>Actions</small>
            </span>
          </div>
        </header>

        <div class="recommendation-focus-grid">
          <section class="recommendation-workbench">
            <div class="recommendation-section-heading">
              <div>
                <p class="eyebrow">Script fixes</p>
                <h3>Recommended updates</h3>
              </div>
              <span
                v-if="selectedRecommendationGroup.topIssue"
                class="severity-pill"
                :class="helpers.severityClass(selectedRecommendationGroup.topIssue.severity)"
              >
                {{ helpers.formatSeverity(selectedRecommendationGroup.topIssue.severity) }}
              </span>
            </div>

            <div class="agent-recommendation-list">
              <article
                v-for="recommendation in selectedRecommendationGroup.recommendations"
                :key="recommendation.id"
                class="agent-recommendation-card"
              >
                <div class="recommendation-card-top">
                  <span class="severity-pill" :class="helpers.severityClass(recommendation.severity)">
                    {{ helpers.formatSeverity(recommendation.severity) }}
                  </span>
                  <small>{{ recommendation.callCount }} calls</small>
                </div>
                <strong>{{ recommendation.title }}</strong>
                <p>{{ recommendation.detail }}</p>
                <div v-if="recommendation.promptPatch" class="prompt-patch">
                  <span>Suggested prompt patch</span>
                  <p>{{ recommendation.promptPatch }}</p>
                </div>
                <div class="recommendation-card-footer">
                  <small v-if="recommendation.contacts.length">
                    Seen in {{ recommendation.contacts.join(', ') }}
                  </small>
                  <button
                    v-if="recommendation.firstCallId"
                    class="text-button compact"
                    type="button"
                    @click="$emit('show-call', recommendation.firstCallId)"
                  >
                    Open call
                  </button>
                </div>
              </article>

              <p v-if="selectedRecommendationGroup.recommendations.length === 0" class="empty-copy">
                No script changes are recommended for this agent under the current filters.
              </p>
            </div>
          </section>

          <aside class="recommendation-side-panel">
            <section>
              <p class="eyebrow">KPI Pressure</p>
              <div class="recommendation-kpi-list">
                <article v-for="kpi in selectedRecommendationGroup.kpis" :key="kpi.id">
                  <div>
                    <strong>{{ kpi.label }}</strong>
                    <small>{{ kpi.failed }} failed - {{ kpi.passed }} passed</small>
                  </div>
                  <span>{{ kpi.failureRate }}%</span>
                </article>
                <p v-if="selectedRecommendationGroup.kpis.length === 0" class="empty-copy">No KPI pressure yet.</p>
              </div>
            </section>

            <section>
              <p class="eyebrow">Use Actions</p>
              <div class="recommendation-action-list">
                <button
                  v-for="action in selectedRecommendationGroup.actions"
                  :key="action.id"
                  type="button"
                  @click="$emit('show-call', action.callId)"
                >
                  <span class="severity-dot" :class="action.severity"></span>
                  <div>
                    <strong>{{ action.type }}</strong>
                    <small>{{ action.contactName }}</small>
                  </div>
                </button>
                <p v-if="selectedRecommendationGroup.actions.length === 0" class="empty-copy">No open actions.</p>
              </div>
            </section>

            <section>
              <p class="eyebrow">Observed failures</p>
              <div class="recommendation-failure-list">
                <button
                  v-for="issue in selectedRecommendationGroup.issues.slice(0, 4)"
                  :key="issue.id"
                  type="button"
                  @click="$emit('show-call', issue.callId)"
                >
                  <strong>{{ issue.label }}</strong>
                  <small>{{ issue.contactName }} - {{ helpers.formatSeverity(issue.severity) }}</small>
                </button>
                <p v-if="selectedRecommendationGroup.issues.length === 0" class="empty-copy">No observed failures.</p>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section v-else class="recommendation-empty-state">
        <Lightbulb :size="26" />
        <h2>No recommendation data</h2>
        <p>Once calls are analyzed, agent recommendations will appear here.</p>
      </section>
    </section>
  </section>
</template>
