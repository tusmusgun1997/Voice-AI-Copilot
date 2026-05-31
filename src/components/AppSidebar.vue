<script setup>
import { Activity, BookOpen, ExternalLink, Settings } from '@lucide/vue';

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

    <div class="sidebar-footer">
      <button class="sidebar-footer-link" type="button">
        <Settings :size="18" />
        <span>Settings</span>
      </button>
      <button class="sidebar-footer-link" type="button">
        <BookOpen :size="18" />
        <span>Documentation</span>
      </button>
      <button class="sidebar-footer-link" type="button">
        <ExternalLink :size="18" />
        <span>Open in browser</span>
      </button>
    </div>
  </aside>
</template>
