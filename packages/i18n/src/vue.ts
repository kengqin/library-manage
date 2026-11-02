/**
 * Vue 适配层：全局唯一的语言状态 + 响应式 t()。
 *
 * 语言选择持久化在 localStorage，桌面端多窗口（主窗口、设置窗口、浏览器窗口）
 * 通过 storage 事件保持同步；<html lang> 跟随切换，方便 CSS 与无障碍读屏。
 */
import { computed, readonly, ref } from 'vue'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  detectLocale,
  localeLabel,
  localeDirection,
  normalizeLocale,
  translate,
  type Locale,
  type LocaleOption,
  type MessageKey,
  type TranslateParams
} from './index'

const state = ref<Locale>(DEFAULT_LOCALE)
/** 供 SSR 场景判断是否已经完成浏览器端挂载后的语言恢复 */
const ready = ref(false)
let storageBound = false

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function readStoredLocale(): Locale | undefined {
  if (!isBrowser()) return undefined
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return value ? normalizeLocale(value) : undefined
  } catch {
    return undefined
  }
}

function persistLocale(value: Locale) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, value)
  } catch {
    // 隐私模式等写入失败的场景，只在当前会话内生效
  }
}

function applyDocumentLocale(value: Locale) {
  if (!isBrowser()) return
  document.documentElement.lang = value
  document.documentElement.dataset.locale = value
  // 阿拉伯语等 RTL 语言需要整体翻转书写方向
  document.documentElement.dir = localeDirection(value)
}

/** 语言选择变化时，让其它窗口跟随；同一窗口的 storage 事件不会触发，所以这里只看外部来源 */
function bindStorageSync() {
  if (!isBrowser() || storageBound) return
  storageBound = true
  window.addEventListener('storage', event => {
    if (event.key !== LOCALE_STORAGE_KEY) return
    const next = normalizeLocale(event.newValue)
    if (next === state.value) return
    state.value = next
    applyDocumentLocale(next)
  })
}

/**
 * 应用启动时调用（桌面端在 main.ts，Web 端在挂载后）。
 * 没有保存过选择时按浏览器语言推断并落盘，保证下次启动稳定。
 */
export function initializeLocale(): Locale {
  if (!isBrowser()) return state.value
  const stored = readStoredLocale()
  if (stored) {
    state.value = stored
  } else {
    const detected = detectLocale(window.navigator?.languages ?? (window.navigator?.language ? [window.navigator.language] : []))
    state.value = detected
    persistLocale(detected)
  }
  applyDocumentLocale(state.value)
  bindStorageSync()
  ready.value = true
  return state.value
}

export function setLocale(value: string, options: { persist?: boolean } = {}): Locale {
  const next = normalizeLocale(value)
  if (next === state.value) {
    applyDocumentLocale(next)
    return next
  }
  state.value = next
  applyDocumentLocale(next)
  if (options.persist !== false) persistLocale(next)
  ready.value = true
  return next
}

/** 响应式翻译：在模板、computed 与 watch 中使用，语言切换后会重新渲染 */
export function t(source: MessageKey, params?: TranslateParams): string {
  return translate(state.value, source, params)
}

export function useI18n() {
  return {
    locale: readonly(state),
    localeReady: readonly(ready),
    locales: SUPPORTED_LOCALES as readonly LocaleOption[],
    t,
    setLocale,
    localeLabel,
    listSeparator,
    initializeLocale
  }
}

/** 枚举分隔符：中文与日文用顿号，阿拉伯语用阿拉伯逗号，其余用逗号加空格 */
export function listSeparator(): string {
  if (state.value === 'ja-JP' || state.value.startsWith('zh')) return '、'
  if (state.value === 'ar-SA') return '، '
  return ', '
}

export const currentLocale = computed(() => state.value)

/** 只读语言状态，供服务层做语言相关分支判断 */
export const locale = readonly(state)
