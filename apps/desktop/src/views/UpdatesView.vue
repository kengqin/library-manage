<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, onMounted, ref } from 'vue'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ArrowUpRight, Download, RefreshCw, ShieldAlert } from 'lucide-vue-next'
import {
  availableUpdate,
  openUpdateWindow,
  initializeUpdateEvents,
  compareVersions,
  getCurrentVersion,
  getCachedReleaseManifest,
  isAutoCheckEnabled,
  isAutoDownloadEnabled,
  isBackgroundCheckEnabled,
  latestReadyVersion,
  loadReleaseManifest,
  publishedUpdateVersion,
  setAutoCheckEnabled,
  setAutoDownloadEnabled,
  setBackgroundCheckEnabled,
  updateError,
  updateMessage,
  type ReleaseEntry,
  type ReleaseManifestSource
} from '../services/release-center'
import PageHeader from '../components/ui/PageHeader.vue'
import UiConfirmDialog from '../components/ui/UiConfirmDialog.vue'
import UiSwitch from '../components/ui/UiSwitch.vue'
import { showGlobalMessage } from '../services/global-message'

const initialManifest = getCachedReleaseManifest()
const props = defineProps<{ embedded?: boolean; historyOnly?: boolean }>()
async function openHistoryWindow() {
  try {
    if (isTauri()) await invoke('open_release_history_window')
    else window.open(`${location.origin}${location.pathname}#/settings/history`, '_blank')
  } catch { showGlobalMessage(t('update.historyFailed'), 'error') }
}
const currentVersion = ref('0.0.0')
const releases = ref<ReleaseEntry[]>(initialManifest.manifest.releases)
const manifestSource = ref<ReleaseManifestSource>(initialManifest.source)
const autoCheck = ref(isAutoCheckEnabled())
const backgroundCheck = ref(isBackgroundCheckEnabled())
const autoDownload = ref(isAutoDownloadEnabled())
const historyRefreshing = ref(false)
const checkingFromView = ref(false)
const historicalInstallVersion = ref<string | null>(null)
const downgradeRelease = ref<ReleaseEntry | null>(null)

const visibleReleases = computed(() => {
  const ceiling = latestReadyVersion.value || (currentVersion.value === '0.0.0'
    ? releases.value.find((release) => release.published)?.version || currentVersion.value
    : currentVersion.value)
  return releases.value.filter((release) => release.published && compareVersions(release.version, ceiling) <= 0)
})

function updateAutoCheck() {
  setAutoCheckEnabled(autoCheck.value)
  showGlobalMessage(`自动检查更新已${autoCheck.value ? t('common.enable') : t('common.close')}`)
}

function updateBackgroundCheck() {
  setBackgroundCheckEnabled(backgroundCheck.value)
  showGlobalMessage(`后台定时检查已${backgroundCheck.value ? t('common.enable') : t('common.close')}`)
}

function updateAutoDownload() {
  setAutoDownloadEnabled(autoDownload.value)
  showGlobalMessage(`后台自动下载已${autoDownload.value ? t('common.enable') : t('common.close')}`)
}

async function installHistoricalVersion(release: ReleaseEntry) {
  if (historicalInstallVersion.value) return
  const isDowngrade = compareVersions(release.version, currentVersion.value) < 0
  if (isDowngrade) {
    downgradeRelease.value = release
    return
  }
  await openHistoricalInstaller(release)
}

async function openHistoricalInstaller(release: ReleaseEntry) {
  historicalInstallVersion.value = release.version
  try {
    await openUrl(release.installerUrl)
  } catch {
    showGlobalMessage(t('update.openInstallerFailed', { version: release.version }), 'error', 6000)
  } finally {
    historicalInstallVersion.value = null
  }
}

function confirmHistoricalInstall() {
  const release = downgradeRelease.value
  downgradeRelease.value = null
  if (release) void openHistoricalInstaller(release)
}

async function openRelease(release: ReleaseEntry) {
  try {
    await openUrl(release.releaseUrl)
  } catch {
    showGlobalMessage(t('update.openDetailsFailed', { version: release.version }), 'error', 6000)
  }
}

async function refreshReleaseHistory() {
  historyRefreshing.value = true
  try {
    const result = await loadReleaseManifest()
    releases.value = result.manifest.releases
    manifestSource.value = result.source
  } finally {
    historyRefreshing.value = false
  }
}

async function checkForUpdatesFromView() {
  if (checkingFromView.value) return
  checkingFromView.value = true
  try {
    await openUpdateWindow(true)
  } finally {
    checkingFromView.value = false
  }
}

onMounted(async () => {
  currentVersion.value = await getCurrentVersion()
  if (props.historyOnly) await refreshReleaseHistory()
  else await initializeUpdateEvents()
})
</script>

<template>
  <section class="workspace-view updates-view" :class="{ 'updates-view--embedded': embedded && !historyOnly }">
    <template v-if="!historyOnly">
    <PageHeader v-if="!embedded" :title="t('app.settings.updatesTab')" />

    <section class="update-status-panel">
      <div class="version-identity">
        <strong>{{ t('update.info') }}</strong>
        <span>v{{ currentVersion }}</span>
      </div>
      <div class="header-actions">
        <button type="button" class="secondary-command" :disabled="checkingFromView" @click="checkForUpdatesFromView">{{ t('update.check') }}</button>
      </div>
    </section>
    <p class="update-feedback" role="status"><template v-if="availableUpdate">{{ t('update.available', { version: availableUpdate.version }) }}</template><template v-else-if="publishedUpdateVersion">{{ t('update.released', { version: publishedUpdateVersion }) }}</template><template v-else-if="updateError">{{ t('update.checkUnavailable') }}</template><template v-else>{{ updateMessage }}</template></p>

    <div class="auto-update-list">
      <div class="auto-update-setting">
        <span class="auto-update-copy"><strong>{{ t('update.autoCheck') }}</strong><small>{{ t('update.checkOnLaunch') }}</small></span>
        <UiSwitch v-model="autoCheck" :label="t('update.autoCheck')" @update:model-value="updateAutoCheck" />
      </div>
      <div class="auto-update-setting">
        <span class="auto-update-copy"><strong>{{ t('update.backgroundCheck') }}</strong><small>{{ t('update.hourlyCheck') }}</small></span>
        <UiSwitch v-model="backgroundCheck" :label="t('update.backgroundCheck')" @update:model-value="updateBackgroundCheck" />
      </div>
      <div class="auto-update-setting">
        <span class="auto-update-copy"><strong>{{ t('update.backgroundDownload') }}</strong><small>{{ t('update.backgroundDownloadHint') }}</small></span>
        <UiSwitch v-model="autoDownload" :label="t('update.backgroundDownload')" @update:model-value="updateAutoDownload" />
      </div>
    </div>

    <footer class="update-footer"><button type="button" class="update-history-link" @click="openHistoryWindow">{{ t('update.history') }}</button></footer>
    </template>
    <section v-if="historyOnly" class="release-history">
      <header><small class="manifest-status">{{ historyRefreshing ? t('common.syncing') : manifestSource === 'remote' ? t('online.history') : manifestSource === 'cached' ? t('storage.local.cache') : t('online.records.builtin') }}</small><button type="button" class="text-command" :disabled="historyRefreshing" @click="refreshReleaseHistory"><RefreshCw :size="13" :class="{ spinning: historyRefreshing }" />{{ t('common.refresh') }}</button></header>
      <article v-for="release in visibleReleases" :key="release.version" class="release-entry">
        <div class="release-rail"><span /><i /></div>
        <div class="release-content">
          <header>
            <div><strong>v{{ release.version }}</strong><span v-if="release.version === currentVersion">{{ t('update.current') }}</span><span v-else-if="release.channel === 'preview'">{{ t('editor.preview') }}</span></div>
            <time>{{ release.date }}</time>
          </header>
          <h2>{{ release.title }}</h2>
          <section v-for="section in release.sections" :key="section.title">
            <h3>{{ section.title }}</h3>
            <ul><li v-for="item in section.items" :key="item">{{ item }}</li></ul>
          </section>
          <div v-if="release.published" class="release-actions">
            <button type="button" class="text-command" @click="openRelease(release)"><ArrowUpRight :size="15" />Release</button>
            <button v-if="release.version !== currentVersion" type="button" class="secondary-command" :disabled="historicalInstallVersion !== null" @click="installHistoricalVersion(release)"><Download :size="15" />{{ historicalInstallVersion === release.version ? t('common.opening') : t('update.installVersion') }}</button>
            <code v-if="release.sha256" :title="release.sha256">SHA256 {{ release.sha256.slice(0, 12) }}...</code>
          </div>
          <div v-else-if="release.version !== currentVersion" class="release-pending"><ShieldAlert :size="15" />{{ t('update.manifestSynced') }}</div>
        </div>
      </article>
    </section>
    <UiConfirmDialog :open="Boolean(downgradeRelease)" danger :title="t('update.downgradeTitle')" :description="`将从 ${currentVersion} 降级到 ${downgradeRelease?.version || ''}。旧版本可能无法读取新版数据库，请先在设置中导出完整备份。`" :confirm-label="t('update.continueInstall')" @close="downgradeRelease = null" @confirm="confirmHistoricalInstall" />
  </section>
</template>
<style scoped>
.release-history { margin-top: 0; }
.release-history > header { min-height: 32px; margin-bottom: 4px; }
.release-history > header button { font-size: 12px; }
.release-content { padding-inline: 4px; }
.auto-update-copy small { max-width: 350px; }
.updates-view--embedded { display: flex; flex-direction: column; }
.update-footer { display: flex; justify-content: center; margin-top: auto; padding-top: 28px; }
.update-history-link { margin-top: 0; }
</style>
