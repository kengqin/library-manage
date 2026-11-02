import { locale, t } from '@novel-library/i18n/vue'
import { readonly, ref } from 'vue'

export type GlobalMessageType = 'success' | 'info' | 'warning' | 'error'

export interface GlobalMessageState {
  id: number
  text: string
  type: GlobalMessageType
}

const message = ref<GlobalMessageState>()
let nextId = Date.now() * 1000 + Math.floor(Math.random() * 1000)
let dismissTimer: number | undefined

export const globalMessage = readonly(message)
export function acceptFloatingMessage(value?: GlobalMessageState) { message.value = value }

export function dismissGlobalMessage(id?: number) {
  if (id !== undefined && message.value?.id !== id) return
  if (dismissTimer !== undefined) window.clearTimeout(dismissTimer)
  dismissTimer = undefined
  message.value = undefined
}

export function showGlobalMessage(text: string, type: GlobalMessageType = 'success', duration = 3600) {
  const normalized = text.trim()
  if (!normalized) return
  dismissGlobalMessage()
  const id = ++nextId
  message.value = { id, text: normalized, type }
  if (duration > 0) {
    dismissTimer = window.setTimeout(() => dismissGlobalMessage(id), duration)
  }
}

export function userFacingError(cause: unknown, fallback = t('common.actionIncomplete')) {
  const raw = (cause instanceof Error ? cause.message : String(cause)).trim()
  const firstLine = raw.split(/\r?\n/u, 1)[0].replace(/^Error:\s*/iu, '').trim()
  // 中文界面只透出中文原因；其它语言界面直接展示原文（底层报错多为英文工具链输出）
  const chineseReason = /[\u3400-\u9fff]/u.test(firstLine)
  const chineseUi = locale.value.startsWith('zh')
  const readable = chineseReason ? chineseUi : !chineseUi
  return readable && firstLine.length <= 160 ? firstLine : fallback
}

export function showGlobalError(cause: unknown, fallback = t('common.actionIncomplete'), duration = 6000) {
  showGlobalMessage(userFacingError(cause, fallback), 'error', duration)
}
