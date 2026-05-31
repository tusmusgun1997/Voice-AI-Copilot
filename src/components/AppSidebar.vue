<script setup>
import { Activity, PanelLeftClose, PanelLeftOpen } from '@lucide/vue';

defineProps({
  activeView: {
    type: String,
    required: true
  },
  collapsed: {
    type: Boolean,
    default: false
  },
  navItems: {
    type: Array,
    required: true
  }
});

defineEmits(['set-view', 'toggle-sidebar']);
</script>

<template>
  <aside class="app-sidebar" :class="{ collapsed }" aria-label="Observability navigation">
    <div class="sidebar-top-row">
      <div class="sidebar-brand">
        <span class="brand-mark"><Activity :size="18" /></span>
        <div>
          <strong>Voice AI Copilot</strong>
          <small>v0.1</small>
        </div>
      </div>

      <button
        class="sidebar-toggle"
        type="button"
        :aria-label="collapsed ? 'Expand navigation' : 'Collapse navigation'"
        :title="collapsed ? 'Expand navigation' : 'Collapse navigation'"
        @click="$emit('toggle-sidebar')"
      >
        <PanelLeftOpen v-if="collapsed" :size="17" />
        <PanelLeftClose v-else :size="17" />
      </button>
    </div>

    <p class="sidebar-section-label">General</p>
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: activeView === item.id }"
        type="button"
        :title="collapsed ? item.label : ''"
        @click="$emit('set-view', item.id)"
      >
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

  </aside>
</template>
