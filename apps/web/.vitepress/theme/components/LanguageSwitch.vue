<script setup lang="ts">
import { t, useI18n } from '@novel-library/i18n/vue'

const { locale, locales, setLocale } = useI18n()

function onChange(event: Event) {
  setLocale((event.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="language-switch">
    <span class="language-switch-icon" aria-hidden="true">文A</span>
    <select class="language-switch-select" :aria-label="t('settings.language')" :value="locale" @change="onChange">
      <option v-for="option in locales" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.language-switch { position: fixed; bottom: 18px; left: 18px; z-index: 30; display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 10px; border: 1px solid var(--vp-c-divider); border-radius: 999px; background: color-mix(in srgb, var(--vp-c-bg) 88%, transparent); box-shadow: 0 6px 18px rgb(0 0 0 / 8%); backdrop-filter: blur(10px); }
.language-switch-icon { color: var(--vp-c-text-3); font-size: 11px; letter-spacing: -0.5px; }
.language-switch-select { max-width: 40vw; padding: 3px 2px; border: 0; color: var(--vp-c-text-1); background: transparent; font-size: 12px; line-height: 18px; cursor: pointer; appearance: none; }
.language-switch-select:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; border-radius: 6px; }
@media (max-width: 520px) { .language-switch-icon { display: none; } .language-switch-select { max-width: 52vw; } }
</style>
