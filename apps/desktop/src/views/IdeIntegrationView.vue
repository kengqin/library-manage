<script setup lang="ts">
import { listSeparator, t } from '@novel-library/i18n/vue'
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, ChevronDown, Code2, Download, MousePointer2, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-vue-next'
import { getIdeIntegrationStatus, installIdePlugin, setCodeOssWheelInjection, uninstallIdePlugin, type BundledIdePlugin, type IdeIntegrationStatus, type IdeTarget } from '../services/desktop-library'
import { idePluginUpdateAvailable } from '../services/ide-plugin-update'
import { showGlobalError, showGlobalMessage } from '../services/global-message'
import PageHeader from '../components/ui/PageHeader.vue'
import UiConfirmDialog from '../components/ui/UiConfirmDialog.vue'

const fallbackPlugins: BundledIdePlugin[] = [
  { id: 'vscode', label: t('ide.readerTitle.vscode'), kind: 'vscode', version: '0.4.15', identifier: 'novel-library.novel-library-reader', description: t('ide.plugin.vscodeDescription'), packageType: 'VSIX', supportedIdes: ['Visual Studio Code', 'VS Code Insiders', 'Cursor', 'Trae', 'Qoder', 'Windsurf', 'Kiro', 'VSCodium', 'Void', 'Code - OSS', 'Positron', 'PearAI'], available: false },
  { id: 'intellij', label: t('ide.readerTitle.jetbrains'), kind: 'jetbrains', version: '0.4.15', identifier: 'com.kengqin.novellibrary.reader', description: t('ide.plugin.jetbrainsDescription'), packageType: 'ZIP', supportedIdes: ['IntelliJ IDEA', 'PyCharm', 'WebStorm', 'Android Studio', 'Rider', 'CLion', 'GoLand', 'RubyMine'], available: false },
  { id: 'visual-studio', label: t('ide.readerTitle.visualStudio'), kind: 'visual-studio', version: '0.4.15', identifier: 'NovelLibrary.VisualStudio', description: t('ide.plugin.visualStudioDescription'), packageType: 'VSIX', supportedIdes: ['Visual Studio 2022'], available: false }
]
const status = ref<IdeIntegrationStatus>({ plugins: fallbackPlugins, targets: [] })
const detecting = ref(true)
const busyTarget = ref('')
const busyAction = ref<'install' | 'update' | 'uninstall' | 'wheel' | ''>('')
const error = ref('')
const query = ref('')
type RunningIdeAction = 'install' | 'update' | 'uninstall'
const runningIdeOperation = ref<{ target: IdeTarget, plugin: BundledIdePlugin, action: RunningIdeAction }>()
const ideActionLabel = (action: RunningIdeAction) => ({ install: t('common.install'), update: t('common.update'), uninstall: t('common.uninstall') })[action]
const runningIdeActionLabel = computed(() => ideActionLabel(runningIdeOperation.value?.action || 'update'))
const runningIdeWillReopen = computed(() => runningIdeOperation.value?.action !== 'uninstall')
// 关闭 IDE 的说明文案含有条件句，拼好整句再交给 t()，保证英文语序正确
const runningIdeDescription = computed(() => t(
  'ide.jetbrains.inUse',
  {
    ide: runningIdeOperation.value?.target.label || 'JetBrains IDE',
    action: runningIdeActionLabel.value,
    reopen: runningIdeWillReopen.value ? t('ide.jetbrains.reopenHint', { action: runningIdeActionLabel.value }) : ''
  }
))
const pendingWheelTarget = ref<IdeTarget>()
const collapsedPluginIds = ref(new Set<string>())
let refreshGeneration = 0
const visiblePlugins = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase()
  if (!keyword) return status.value.plugins
  return status.value.plugins.filter(plugin => `${plugin.label} ${plugin.identifier}`.toLocaleLowerCase().includes(keyword))
})

function targetsFor(plugin: BundledIdePlugin) {
  return status.value.targets.filter(target => target.kind === plugin.kind)
}

function pluginIsCollapsed(pluginId: string) {
  return collapsedPluginIds.value.has(pluginId)
}

function togglePlugin(pluginId: string) {
  const next = new Set(collapsedPluginIds.value)
  if (next.has(pluginId)) next.delete(pluginId)
  else next.add(pluginId)
  collapsedPluginIds.value = next
}

async function refresh() {
  const generation = ++refreshGeneration
  detecting.value = true
  error.value = ''
  try {
    const nextStatus = await getIdeIntegrationStatus()
    if (generation === refreshGeneration) status.value = nextStatus
  } catch (cause) {
    if (generation === refreshGeneration) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      showGlobalError(cause, t('ide.detectFailed'))
    }
  } finally {
    if (generation === refreshGeneration) detecting.value = false
  }
}

async function install(target: IdeTarget, plugin: BundledIdePlugin, closeRunningIde = false) {
  const updating = idePluginUpdateAvailable(target, plugin)
  busyTarget.value = target.id
  busyAction.value = updating ? 'update' : 'install'
  error.value = ''
  try {
    const result = await installIdePlugin(target.id, plugin.id, closeRunningIde)
    if (!result.installed || !result.verified) throw new Error(t('ide.plugin.installUnconfirmed', { plugin: result.plugin }))
    const version = result.installedVersion ? ` · v${result.installedVersion}` : ''
    showGlobalMessage(updating
      ? t('ide.plugin.updatedTo', { plugin: result.plugin, target: result.target, version })
      : t('ide.plugin.installedTo', { plugin: result.plugin, target: result.target, version }))
    await refresh()
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    if (!closeRunningIde && detail.startsWith('IDE_RUNNING:')) {
      runningIdeOperation.value = { target, plugin, action: updating ? 'update' : 'install' }
    } else {
      error.value = detail.replace(/^IDE_(?:RUNNING|CLOSE_PENDING):\s*/, '')
      showGlobalError(error.value, updating ? t('ide.plugin.updateFailed') : t('ide.plugin.installFailed'))
    }
  } finally {
    busyTarget.value = ''
    busyAction.value = ''
  }
}

function chooseManualIdeClose() {
  const pending = runningIdeOperation.value
  runningIdeOperation.value = undefined
  if (pending) showGlobalMessage(t('ide.jetbrains.closeHint', { ide: pending.target.label, action: ideActionLabel(pending.action) }), 'info', 6000)
}

async function closeIdeAndContinue() {
  const pending = runningIdeOperation.value
  if (!pending) return
  runningIdeOperation.value = undefined
  if (pending.action === 'uninstall') {
    await uninstall(pending.target, pending.plugin, true)
  } else {
    await install(pending.target, pending.plugin, true)
  }
}

async function uninstall(target: IdeTarget, plugin: BundledIdePlugin, closeRunningIde = false) {
  if (!target.canUninstall) return
  busyTarget.value = target.id
  busyAction.value = 'uninstall'
  error.value = ''
  try {
    const result = await uninstallIdePlugin(target.id, plugin.id, closeRunningIde)
    if (result.installed || !result.verified) throw new Error(t('ide.plugin.uninstallUnconfirmed', { plugin: result.plugin }))
    target.installed = false
    target.installedVersion = undefined
    target.wheelInjectionEnabled = false
    target.wheelInjectionNeedsRepair = false
    showGlobalMessage(t('ide.plugin.removedFrom', { plugin: result.plugin, target: result.target }))
    await refresh()
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    if (!closeRunningIde && detail.startsWith('IDE_RUNNING:')) {
      runningIdeOperation.value = { target, plugin, action: 'uninstall' }
    } else {
      error.value = detail.replace(/^IDE_(?:RUNNING|CLOSE_PENDING):\s*/, '')
      showGlobalError(error.value, t('ide.plugin.uninstallFailed'))
    }
  } finally {
    busyTarget.value = ''
    busyAction.value = ''
  }
}

async function changeWheelInjection(target: IdeTarget, enabled: boolean) {
  busyTarget.value = target.id
  busyAction.value = 'wheel'
  error.value = ''
  try {
    const result = await setCodeOssWheelInjection(target.id, enabled)
    showGlobalMessage(`${result.target} 的增强滚轮已${result.enabled ? t('common.enable') : t('common.close')}，重启编辑器后生效`)
    await refresh()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
    showGlobalError(cause, t('reader.enhancedWheel.failed'))
  } finally {
    busyTarget.value = ''
    busyAction.value = ''
  }
}

function requestWheelToggle(target: IdeTarget) {
  if (target.wheelInjectionEnabled || target.wheelInjectionNeedsRepair) {
    void changeWheelInjection(target, false)
  } else {
    pendingWheelTarget.value = target
  }
}

async function confirmWheelInjection() {
  const target = pendingWheelTarget.value
  pendingWheelTarget.value = undefined
  if (target) await changeWheelInjection(target, true)
}

onMounted(refresh)
</script>

<template>
  <section class="workspace-view ide-integration-view">
    <PageHeader :title="t('ide.title')">
      <template #actions><button type="button" class="icon-button" :title="t('ide.detectRetry')" :disabled="detecting" @click="refresh"><RefreshCw :size="18" :class="{ spinning: detecting }" /></button></template>
    </PageHeader>
    <div class="ide-plugin-toolbar">
      <label class="ide-plugin-search"><Search :size="16" /><input v-model="query" type="search" :placeholder="t('ide.search')" /></label>
      <span>{{ detecting ? t('ide.verifying') : error ? t('common.detectFailed') : `${visiblePlugins.length} 个插件包` }}</span>
    </div>

    <div class="ide-plugin-catalog" :aria-label="t('ide.plugin.folder')">
      <article v-for="plugin in visiblePlugins" :key="plugin.id" class="ide-plugin-card">
        <header>
          <span class="ide-target-icon"><Code2 :size="20" /></span>
          <div class="ide-plugin-heading"><div class="ide-plugin-title"><strong>{{ plugin.label }}</strong><span>v{{ plugin.version }}</span></div><small>{{ plugin.description }}</small></div>
          <span class="ide-package-state" :class="{ ready: plugin.available }">{{ plugin.available ? `安装包已内置 · ${plugin.packageType}` : detecting ? t('update.verifying') : t('update.installerMissing') }}</span>
        </header>
        <div class="ide-plugin-supported">
          <div class="ide-plugin-supported-copy"><span>{{ t('ide.plugin.supported') }}</span>{{ plugin.supportedIdes.join(listSeparator()) }}</div>
          <button v-if="targetsFor(plugin).length" type="button" class="ide-plugin-collapse" :aria-expanded="!pluginIsCollapsed(plugin.id)" :aria-controls="`ide-targets-${plugin.id}`" @click="togglePlugin(plugin.id)"><ChevronDown :size="15" :class="{ collapsed: pluginIsCollapsed(plugin.id) }" />{{ pluginIsCollapsed(plugin.id) ? t('common.expand') : t('common.collapse') }} · {{ targetsFor(plugin).length }} {{ t('unit.instances') }}</button>
        </div>
        <div v-if="targetsFor(plugin).length && !pluginIsCollapsed(plugin.id)" :id="`ide-targets-${plugin.id}`" class="ide-target-list">
          <div v-for="target in targetsFor(plugin)" :key="target.id" class="ide-target-row">
            <div><strong>{{ target.label }}</strong><small>{{ t('update.installLocation') }}{{ target.path }}</small><span v-if="idePluginUpdateAvailable(target, plugin)">{{ t('ide.plugin.installedVersion') }}{{ target.installedVersion }}{{ t('update.availablePrefix') }}{{ plugin.version }}</span><span v-else-if="target.installed">{{ t('ide.plugin.installed') }}{{ target.installedVersion ? ` · v${target.installedVersion}` : '' }}</span><span v-else>{{ t('ide.plugin.notInstalled') }}</span><span v-if="target.installed && target.wheelInjectionNeedsRepair">{{ t('reader.enhancedWheel.incomplete') }}</span><span v-else-if="target.installed && target.wheelInjectionEnabled">{{ t('reader.enhancedWheel.enabled') }}</span></div>
            <div class="ide-target-actions">
              <button v-if="busyTarget === target.id && busyAction !== 'wheel'" type="button" class="secondary-command" disabled><RotateCcw :size="15" class="spinning" />{{ busyAction === 'uninstall' ? t('common.uninstalling') : busyAction === 'update' ? t('common.updating') : t('common.installing') }}</button>
              <button v-else-if="idePluginUpdateAvailable(target, plugin)" type="button" class="primary-command" :disabled="!plugin.available" @click="install(target, plugin)"><RefreshCw :size="15" />{{ t('common.update') }}</button>
              <button v-else-if="target.installed && target.canUninstall" type="button" class="secondary-command" @click="uninstall(target, plugin)"><Trash2 :size="15" />{{ t('common.uninstall') }}</button>
              <button v-else-if="target.installed" type="button" class="secondary-command" disabled><CheckCircle2 :size="15" />{{ t('common.installed') }}</button>
              <button v-else type="button" class="primary-command" :disabled="!plugin.available" @click="install(target, plugin)"><Download :size="15" />{{ t('common.install') }}</button>
              <button v-if="target.installed && target.kind === 'vscode' && target.wheelInjectionAvailable" type="button" role="switch" class="secondary-command ide-wheel-switch" :class="{ active: target.wheelInjectionEnabled, warning: target.wheelInjectionNeedsRepair }" :aria-checked="target.wheelInjectionEnabled" :disabled="busyTarget === target.id" @click="requestWheelToggle(target)"><RotateCcw v-if="busyTarget === target.id && busyAction === 'wheel'" :size="14" class="spinning" /><MousePointer2 v-else :size="14" />{{ t('reader.enhancedWheel') }}{{ target.wheelInjectionNeedsRepair ? t('storage.backup.restoreShort') : target.wheelInjectionEnabled ? t('common.on') : t('common.off') }}</button>
            </div>
          </div>
        </div>
        <div v-else-if="!targetsFor(plugin).length" class="ide-plugin-empty">{{ detecting ? t('ide.detecting') : t('ide.detectNone', { ides: plugin.supportedIdes.join(listSeparator()) }) }}</div>
      </article>
    </div>
    <UiConfirmDialog
      :open="Boolean(runningIdeOperation)"
      :title="t('ide.jetbrains.needClose', { action: runningIdeActionLabel })"
      :description="runningIdeDescription"
      :confirm-label="t('ide.jetbrains.closeAndAction', { action: runningIdeActionLabel })"
      :cancel-label="t('ide.jetbrains.selfClose')"
      @close="chooseManualIdeClose"
      @confirm="closeIdeAndContinue"
    />
    <UiConfirmDialog
      :open="Boolean(pendingWheelTarget)"
      :title="t('reader.enhancedWheel.confirm')"
      :description="`这会修改 ${pendingWheelTarget?.label || t('ide.family.vscode')} 的 Monaco 工作台文件，并同步更新完整性校验。桌面端会保留备份并支持关闭恢复，但编辑器升级后可能需要重新启用。功能默认关闭，启用后请完全退出并重新打开编辑器。`"
      :confirm-label="t('ide.injection.enable')"
      :cancel-label="t('window.closeBehavior.keepClosed')"
      @close="pendingWheelTarget = undefined"
      @confirm="confirmWheelInjection"
    />
  </section>
</template>
