<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { X } from 'lucide-vue-next'
import { cancelCloseBehaviorPrompt, resolveCloseBehavior, type CloseBehavior } from '../services/desktop-library'
import { showGlobalError } from '../services/global-message'

const visible = ref(false)
const remember = ref(false)
const busy = ref(false)
const dialog = ref<HTMLElement>()
let unlisten: UnlistenFn | undefined

async function choose(behavior: Exclude<CloseBehavior, 'ask'>) {
  if (busy.value) return
  busy.value = true
  try {
    await resolveCloseBehavior(behavior, remember.value)
    visible.value = false
  } catch (cause) {
    showGlobalError(cause, t('window.closeBehavior.saveFailed'))
  } finally {
    busy.value = false
  }
}

async function cancel() {
  if (busy.value) return
  try {
    await cancelCloseBehaviorPrompt()
    visible.value = false
  } catch (cause) {
    showGlobalError(cause, t('window.closeBehavior.cancelFailed'))
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') void cancel()
}

onMounted(async () => {
  if (!isTauri()) return
  unlisten = await listen('close-behavior-requested', async () => {
    remember.value = false
    visible.value = true
    await nextTick()
    dialog.value?.focus()
  })
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  unlisten?.()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="close-dialog-backdrop" role="presentation">
      <section ref="dialog" class="close-dialog" role="dialog" aria-modal="true" aria-labelledby="close-dialog-title" tabindex="-1">
        <header>
          <h2 id="close-dialog-title">{{ t('window.closeBehavior.dialogTitle') }}</h2>
          <button type="button" class="icon-button" :title="t('window.closeBehavior.cancel')" :disabled="busy" @click="cancel"><X :size="20" /></button>
        </header>
        <p>{{ t('window.trayHint') }}</p>
        <label class="remember-close-choice"><input v-model="remember" type="checkbox" /><span>{{ t('window.closeBehavior.remember') }}</span></label>
        <footer>
          <button type="button" class="secondary-command danger-command" :disabled="busy" @click="choose('quit')">{{ t('window.closeBehavior.quit') }}</button>
          <button type="button" class="primary-command" :disabled="busy" @click="choose('minimizeToTray')">{{ t('window.closeBehavior.tray') }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
