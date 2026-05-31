<script setup>
import { Activity } from '@lucide/vue';

defineProps({
  activeView: {
    type: String,
    required: true
  },
  navItems: {
    type: Array,
    required: true
  }
});

defineEmits(['set-view']);
</script>

<template>
  <aside class="app-sidebar" aria-label="Observability navigation">
    <div class="sidebar-brand">
      <span class="brand-mark"><Activity :size="18" /></span>
      <div>
        <strong>Voice AI Copilot</strong>
        <small>v0.1</small>
      </div>
    </div>

    <p class="sidebar-section-label">General</p>
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: activeView === item.id }"
        type="button"
        @click="$emit('set-view', item.id)"
      >
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

  </aside>
</template>
