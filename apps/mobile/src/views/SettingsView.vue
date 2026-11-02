<script setup lang="ts">
import { t, useI18n } from '@novel-library/i18n/vue'
import { computed, onMounted, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { DatabaseBackup, Download, ExternalLink, HardDrive, Languages, RefreshCw, Trash2, Upload } from 'lucide-vue-next'
import type { AvailableMobileUpdate, MobileUpdatePlatform } from '@novel-library/reader-protocol'
import { clearLibrary, exportLibrary, getLibraryStats, importLibraryBackup } from '../services/mobile-library'
import { exportAndShareJson, readBackupFile } from '../services/backup-transfer'
import { checkMobileUpdate, openMobileStore } from '../services/mobile-update'

const stats = ref({ books: 0, chapters: 0, usage: 0, quota: 0 })
const currentVersion = ref('0.1.0')
const busy = ref(false)
const message = ref('')
const error = ref('')
const update = ref<AvailableMobileUpdate | null>(null)
const backupInput = ref<HTMLInputElement>()
const platform = computed<MobileUpdatePlatform>(() => Capacitor.getPlatform() === 'android' ? 'android' : 'ios')
const { locale, locales, setLocale } = useI18n()

function changeLocale(value: string) {
  const next = setLocale(value)
  const label = locales.find(option => option.value === next)?.label || next
  message.value = t('settings.language.changed', { language: label })
}

function size(value: number) {
  if (!value) return '0 MB'
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

async function refresh() {
  stats.value = await getLibraryStats()
  if (Capacitor.isNativePlatform()) currentVersion.value = (await NativeApp.getInfo()).version
}

async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  message.value = ''
  try { await action() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { busy.value = false }
}

async function exportAll() {
  await run(async () => { await exportAndShareJson(await exportLibrary(), `小说书库-完整备份-${new Date().toISOString().slice(0, 10)}`, t('storage.backup.exportFull')); message.value = t('storage.backup.created'); await refresh() })
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await run(async () => { await importLibraryBackup(await readBackupFile(file)); await refresh(); message.value = t('storage.backup.restored') })
  input.value = ''
}

async function removeAll() {
  if (!window.confirm(t('library.clear.confirm'))) return
  await run(async () => { await clearLibrary(); await refresh(); message.value = t('library.clear.done') })
}

async function checkUpdate() {
  await run(async () => { update.value = await checkMobileUpdate({ currentVersion: currentVersion.value, platform: platform.value }); message.value = update.value ? t('update.found', { version: update.value.version }) : t('update.latest') })
}

onMounted(refresh)
</script>

<template>
  <section class="page settings-page">
    <header class="page-header"><div><span class="eyebrow">PREFERENCES</span><h1>{{ t('app.settings.title') }}</h1></div></header>
    <p v-if="message" class="success-card">{{ message }}</p><p v-if="error" class="error-card">{{ error }}</p>
    <section class="settings-section"><h2>{{ t('settings.language') }}</h2><div class="setting-card"><Languages :size="22" /><div><strong>{{ t('settings.language') }}</strong><p>{{ t('common.appliesImmediately') }}</p></div></div><div class="language-choices"><button v-for="option in locales" :key="option.value" type="button" :class="{ active: locale === option.value }" @click="changeLocale(option.value)">{{ option.label }}</button></div></section>
    <section class="settings-section"><h2>{{ t('storage.local.data') }}</h2><div class="setting-card"><HardDrive :size="22" /><div><strong>{{ t('stats.booksChapters', { books: stats.books, chapters: stats.chapters }) }}</strong><p>{{ stats.quota ? t('storage.usage.usedOfQuota', { usage: size(stats.usage), quota: size(stats.quota) }) : t('storage.usage.usedValue', { usage: size(stats.usage) }) }}</p></div></div><button type="button" :disabled="busy" @click="exportAll"><Download :size="20" /><span><strong>{{ t('storage.backup.full') }}</strong><small>{{ t('storage.backup.exportDescription') }}</small></span></button><button type="button" :disabled="busy" @click="backupInput?.click()"><Upload :size="20" /><span><strong>{{ t('storage.backup.restore') }}</strong><small>{{ t('storage.backup.supported') }}</small></span></button><input ref="backupInput" hidden type="file" accept="application/json,.json" @change="importBackup" /><button class="danger-setting" type="button" :disabled="busy" @click="removeAll"><Trash2 :size="20" /><span><strong>{{ t('library.clear.library') }}</strong><small>{{ t('library.clear.description') }}</small></span></button></section>
    <section class="settings-section"><h2>{{ t('app.settings.updatesTab') }}</h2><div class="setting-card"><DatabaseBackup :size="22" /><div><strong>{{ t('app.version', { version: currentVersion }) }}</strong><p>{{ platform === 'android' ? t('update.androidApk') : t('update.iosStore') }}</p></div></div><button type="button" :disabled="busy" @click="checkUpdate"><RefreshCw :size="20" :class="{ spinning: busy }" /><span><strong>{{ t('update.check') }}</strong><small>{{ t('update.verifyDetail') }}</small></span></button><button v-if="update" type="button" @click="openMobileStore(update)"><ExternalLink :size="20" /><span><strong>{{ t('update.to', { version: update.version }) }}</strong><small>{{ t('update.channel') }}</small></span></button></section>
  </section>
</template>
