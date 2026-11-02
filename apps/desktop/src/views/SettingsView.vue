<script setup lang="ts">
import { t, useI18n } from '@novel-library/i18n/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useRoute } from 'vue-router'
import { open, save } from '@tauri-apps/plugin-dialog'
import { ArrowRight, Database, Download, Settings } from 'lucide-vue-next'
import UpdatesView from './UpdatesView.vue'
import { changeDesktopDatabaseFile, changeDesktopDataDirectory, exportDesktopBackup, getCloseBehavior, getDesktopStorageStatus, importDesktopBackup, resetDesktopDataDirectory, setCloseBehavior, type CloseBehavior, type DesktopStorageStatus } from '../services/desktop-library'
import { availableUpdate, getCurrentVersion, publishedUpdateVersion } from '../services/release-center'
import PageHeader from '../components/ui/PageHeader.vue'
import UiConfirmDialog from '../components/ui/UiConfirmDialog.vue'
import UiSelect, { type UiSelectOption } from '../components/ui/UiSelect.vue'
import { useAppearance } from '../composables/useAppearance'
import { showGlobalError, showGlobalMessage } from '../services/global-message'

interface PendingSettingAction {
  title: string
  description: string
  confirmLabel: string
  run: () => Promise<void>
}

const status = ref<DesktopStorageStatus>()
const busy = ref(false)
const currentVersion = ref('')
const closeBehavior = ref<CloseBehavior>('ask')
const pendingSettingAction = ref<PendingSettingAction | null>(null)
const { appearance, setAppearance } = useAppearance()
const props = defineProps<{ windowed?: boolean }>()
const route = useRoute()
const selectedSection = (value: unknown): 'general' | 'storage' | 'updates' => value === 'storage' || value === 'updates' ? value : 'general'
const activeSection = ref(selectedSection(route.query.section))
watch(() => route.query.section, value => { if (props.windowed) activeSection.value = selectedSection(value) })
watch(() => route.path, path => { if (props.windowed && path.endsWith('/updates')) activeSection.value = 'updates' })
let unlistenSection: UnlistenFn | undefined
const notifyDataChange = () => props.windowed && isTauri() ? emitTo('main', 'settings-data-changed') : Promise.resolve()

const { locale, locales, setLocale } = useI18n()

// 选项文案要跟随语言切换，必须用 computed，不能是 setup 期算好的常量
const appearanceOptions = computed<UiSelectOption[]>(() => [
  { value: 'system', label: t('app.appearance.system') },
  { value: 'light', label: t('app.appearance.light') },
  { value: 'dark', label: t('app.appearance.dark') }
])

const closeBehaviorOptions = computed<UiSelectOption[]>(() => [
  { value: 'ask', label: t('window.closeBehavior.ask') },
  { value: 'minimizeToTray', label: t('window.closeBehavior.tray') },
  { value: 'quit', label: t('window.closeBehavior.quit') }
])

const languageOptions = computed<UiSelectOption[]>(() => locales.map(option => ({ value: option.value, label: option.label })))

function updateLocale(value: string) {
  const next = setLocale(value)
  const label = locales.find(option => option.value === next)?.label || next
  showGlobalMessage(t('settings.language.changed', { language: label }))
}

function queueSettingAction(action: PendingSettingAction) {
  pendingSettingAction.value = action
}

function showError(cause: unknown, fallback = t('app.settings.saveFailed')) {
  showGlobalError(cause, fallback)
}

function updateAppearance(value: 'system' | 'light' | 'dark') {
  setAppearance(value)
  const label = appearanceOptions.value.find(option => option.value === value)?.label || t('app.appearance.selected')
  showGlobalMessage(t('app.appearance.switched', { label }))
}

async function confirmSettingAction() {
  const action = pendingSettingAction.value
  if (!action || busy.value) return
  busy.value = true
  try {
    await action.run()
    await notifyDataChange()
    pendingSettingAction.value = null
  } catch (cause) {
    showError(cause)
  } finally {
    busy.value = false
  }
}

async function refreshStatus() {
  try {
    status.value = await getDesktopStorageStatus()
  } catch (cause) {
    showError(cause, t('storage.database.statusFailed'))
  }
}

async function exportBackup() {
  const target = await save({
    defaultPath: `NovelLibrary-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: t('storage.backup.fileName'), extensions: ['json'] }]
  })
  if (!target) return
  busy.value = true
  try {
    const result = await exportDesktopBackup(target)
    showGlobalMessage(t('storage.backup.exportedSummary', { books: result.books, chapters: result.chapters, notes: result.notes }))
  } catch (cause) {
    showError(cause, t('storage.backup.exportFailed'))
  } finally {
    busy.value = false
  }
}

async function importBackup() {
  const source = await open({
    multiple: false,
    filters: [{ name: t('storage.backup.fileName'), extensions: ['json'] }]
  })
  if (!source || Array.isArray(source)) return
  busy.value = true
  try {
    const result = await importDesktopBackup(source)
    await notifyDataChange()
    showGlobalMessage(t('storage.backup.restoredSummary', { books: result.books, chapters: result.chapters, notes: result.notes }))
  } catch (cause) {
    showError(cause, t('storage.backup.restoreFailed'))
  } finally {
    busy.value = false
  }
}

async function chooseDataDirectory() {
  const directory = await open({ directory: true, multiple: false, title: t('storage.folder.pick'), defaultPath: status.value?.dataDirectory })
  if (!directory || Array.isArray(directory)) return
  queueSettingAction({
    title: t('storage.folder.switchConfirm'),
    description: t('storage.folder.switchHint'),
    confirmLabel: t('storage.folder.switch'),
    run: async () => {
      status.value = await changeDesktopDataDirectory(directory)
      showGlobalMessage(t('storage.folder.switched'))
    }
  })
}

async function resetDataDirectory() {
  queueSettingAction({
    title: t('storage.folder.resetConfirm'),
    description: t('storage.folder.resetHint'),
    confirmLabel: t('storage.folder.reset'),
    run: async () => {
      status.value = await resetDesktopDataDirectory()
      showGlobalMessage(t('storage.folder.resetDone'))
    }
  })
}

async function chooseDatabaseFile() {
  const databasePath = await save({
    title: t('storage.database.pick'),
    defaultPath: status.value?.databasePath || 'library.db',
    filters: [{ name: t('storage.database.sqlite'), extensions: ['db', 'sqlite', 'sqlite3'] }]
  })
  if (!databasePath) return
  queueSettingAction({
    title: t('storage.database.switchConfirm'),
    description: t('storage.database.switchHint'),
    confirmLabel: t('storage.database.switch'),
    run: async () => {
      status.value = await changeDesktopDatabaseFile(databasePath)
      showGlobalMessage(t('storage.database.switched'))
    }
  })
}

async function saveCloseBehavior() {
  busy.value = true
  try {
    closeBehavior.value = await setCloseBehavior(closeBehavior.value)
    showGlobalMessage(t('window.closeBehavior.saved'))
  } catch (cause) {
    showError(cause, t('window.closeBehavior.saveFailed'))
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  if (props.windowed && isTauri()) unlistenSection = await listen<string>('settings-section', event => { activeSection.value = selectedSection(event.payload) })
  await Promise.all([
    refreshStatus(),
    getCurrentVersion().then(version => { currentVersion.value = version }).catch(cause => showError(cause, t('update.readCurrentFailed'))),
    getCloseBehavior().then(behavior => { closeBehavior.value = behavior }).catch(cause => showError(cause, t('window.closeBehavior.readFailed')))
  ])
})
onBeforeUnmount(() => unlistenSection?.())
</script>

<template>
  <section class="workspace-view settings-view" :class="{ 'settings-view--windowed': windowed }">
    <PageHeader v-if="!windowed" :title="t('app.settings.title')" />
    <nav class="settings-tabs" :aria-label="t('app.settings.categories')">
      <button type="button" :class="{ active: activeSection === 'general' }" @click="activeSection = 'general'"><Settings v-if="windowed" :size="17" /><span class="settings-tab-label">{{ t('app.settings.general') }}</span></button>
      <button type="button" :class="{ active: activeSection === 'storage' }" @click="activeSection = 'storage'"><Database v-if="windowed" :size="17" /><span class="settings-tab-label">{{ windowed ? t('app.settings.storageTab') : t('app.settings.data') }}</span></button>
      <button type="button" :class="{ active: activeSection === 'updates' }" @click="activeSection = 'updates'"><Download v-if="windowed" :size="17" /><span class="settings-tab-label">{{ windowed ? t('app.settings.updatesTab') : t('common.update') }}</span></button>
    </nav>

    <div v-if="activeSection === 'general'" class="settings-section">
      <p class="settings-group-label">{{ t('settings.group.application') }}</p>
      <div class="settings-panel">
        <section class="setting-row">
          <div class="setting-copy"><strong>{{ t('app.appearance.title') }}</strong><span>{{ t('app.appearance.description') }}</span></div>
          <UiSelect :model-value="appearance" :options="appearanceOptions" :label="t('app.appearance.title')" @update:model-value="updateAppearance($event as 'system' | 'light' | 'dark')" />
        </section>
        <section class="setting-row">
          <div class="setting-copy"><strong>{{ t('settings.language') }}</strong><span>{{ t('settings.language.description') }}</span></div>
          <UiSelect :model-value="locale" :options="languageOptions" :label="t('settings.language')" @update:model-value="updateLocale(String($event))" />
        </section>
        <section class="setting-row">
          <div class="setting-copy"><strong>{{ t('window.closeBehavior') }}</strong><span>{{ t('window.closeBehavior.description') }}</span></div>
          <UiSelect v-model="closeBehavior" :options="closeBehaviorOptions" :label="t('window.closeBehavior.label')" :disabled="busy" @change="saveCloseBehavior" />
        </section>
        <section class="setting-row setting-row-status">
          <div class="setting-copy"><strong>{{ t('storage.database.local') }}</strong><span>{{ status?.databaseReady ? t('common.ready') : t('common.waitingInit') }}</span></div>
          <span class="setting-state" :class="{ ready: status?.databaseReady }">{{ status?.databaseReady ? t('common.ok') : t('common.preparing') }}</span>
        </section>
      </div>
    </div>

    <div v-else-if="activeSection === 'storage'" class="settings-section">
      <p class="settings-group-label">{{ t('storage.local.data') }}</p>
      <div class="settings-panel">
        <section class="setting-row setting-row-wide data-directory-setting">
          <div class="setting-copy"><strong>{{ t('storage.folder') }}</strong><span :title="status?.dataDirectory">{{ status?.dataDirectory || t('library.progress.none') }}</span></div>
          <div class="header-actions"><button type="button" class="secondary-command" :disabled="busy" @click="resetDataDirectory">{{ t('common.default') }}</button><button type="button" class="primary-command" :disabled="busy" @click="chooseDataDirectory">{{ t('common.change') }}</button></div>
        </section>
        <section class="setting-row setting-row-wide database-file-setting">
          <div class="setting-copy"><strong>{{ t('storage.database.file') }}</strong><span :title="status?.databasePath">{{ status?.databasePath || t('library.progress.none') }}</span></div>
          <button type="button" class="primary-command" :disabled="busy" @click="chooseDatabaseFile">{{ t('common.change') }}</button>
        </section>
        <section class="setting-row setting-row-wide backup-setting">
          <div class="setting-copy"><strong>{{ t('storage.backup.fullData') }}</strong><span>{{ t('storage.backup.contents') }}</span></div>
          <div class="header-actions"><button type="button" class="secondary-command" :disabled="busy" @click="importBackup">{{ t('storage.backup.restoreShort') }}</button><button type="button" class="primary-command" :disabled="busy" @click="exportBackup">{{ t('common.export') }}</button></div>
        </section>
      </div>
    </div>

    <UpdatesView v-else-if="windowed" embedded class="settings-window-updates" />
    <div v-else class="settings-section">
      <p class="settings-group-label">{{ t('update.version') }}</p>
      <div class="settings-panel settings-update-panel">
        <section class="setting-row setting-row-wide">
          <div class="setting-copy"><strong>{{ t('app.settings.updatesTab') }}</strong><span v-if="availableUpdate">{{ t('update.available', { version: availableUpdate.version }) }}</span><span v-else-if="publishedUpdateVersion">{{ t('update.releasedShort', { version: publishedUpdateVersion }) }}</span><span v-else>{{ t('update.currentVersion', { version: currentVersion || '...' }) }}</span></div>
          <RouterLink to="/settings/updates" class="primary-command">{{ t('update.open') }}<ArrowRight :size="15" /></RouterLink>
        </section>
      </div>
    </div>
    <UiConfirmDialog :open="Boolean(pendingSettingAction)" :busy="busy" :title="pendingSettingAction?.title || t('settings.confirmChange')" :description="pendingSettingAction?.description || ''" :confirm-label="pendingSettingAction?.confirmLabel || t('common.confirm')" @close="pendingSettingAction = null" @confirm="confirmSettingAction" />
  </section>
</template>

<style scoped>
.settings-view--windowed { display: grid; grid-template-columns: 202px minmax(0,1fr); gap: 0; width: 100%; max-width: none; height: 100%; min-height: 0; padding: 0; margin: 0; }
.settings-view--windowed .settings-tabs { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; width: 100%; gap: 3px; padding: 24px 9px; margin: 0; border: 0; border-right: 1px solid var(--ui-border); border-radius: 0; background: var(--ui-surface-2); }
.settings-view--windowed .settings-tabs > button { display: flex; align-items: center; gap: 11px; min-height: 40px; padding: 0 15px; border: 0; border-radius: 6px; text-align: left; font-size: 13px; color: var(--ui-text-2); background: transparent; }
/* 选中态字重变粗会让标签变宽，这里禁止折行，超长时省略而不是挤成两行 */
.settings-view--windowed .settings-tab-label { flex: 1; min-width: 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.settings-view--windowed .settings-tabs > button.active { color: var(--ui-text); background: var(--ui-selected); font-weight: 500; }
.settings-view--windowed .settings-tabs > button:hover { background: var(--ui-hover); }
.settings-view--windowed > .settings-section,.settings-view--windowed > .settings-window-updates { grid-column: 2; grid-row: 1; overflow: auto; min-height: 0; padding: 27px 32px; margin: 0; }
.settings-view--windowed .settings-panel { padding: 0 14px; border: 1px solid color-mix(in srgb, var(--ui-text-2) 14%, transparent); border-radius: 14px; background: transparent; box-shadow: none; }
.settings-view--windowed .setting-row { grid-template-columns: minmax(0, 1fr) auto; gap: 20px; padding: 14px 0; border-bottom: 1px solid color-mix(in srgb, var(--ui-text-2) 11%, transparent); border-radius: 0; }
.settings-view--windowed .setting-row:last-child { border-bottom: 0; }
.settings-view--windowed .setting-row > .ui-select,.settings-view--windowed .setting-row > .setting-state,.settings-view--windowed .setting-row > .primary-command,.settings-view--windowed .setting-row > .header-actions { grid-column: 2; justify-self: end; width: auto; }
.settings-view--windowed .setting-row > .ui-select { width: 158px; }
.settings-view--windowed .settings-group-label { margin-top: 2px; margin-bottom: 12px; font-size: 13px; color: var(--ui-text); }
.settings-view--windowed .setting-copy strong { font-weight: 500; }
.settings-view--windowed .setting-copy span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.settings-view--windowed .setting-row > .ui-select { min-width: 0; width: max-content; }
.settings-view--windowed :deep(.ui-select-trigger) { min-width: 128px; height: 28px; border-radius: 9px; }
.settings-view--windowed :deep(.ui-select-menu) { min-width: 158px; }
.settings-view--windowed .setting-copy > span { font-size: 11px; }
.settings-view--windowed :deep(.workspace-header h1) { font-size: 21px; }
</style>
