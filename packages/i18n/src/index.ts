/**
 * 多语言核心（与框架无关）。
 *
 * 约定：文案以语义 key 组织（`common.save`、`library.shelf.empty`），
 * 每门语言一份 `messages/<locale>.ts`，key 集合完全一致；
 * 简体中文也在字典里（`messages/zh-CN.ts`），因此调整措辞只改字典、不动组件。
 * 缺少译文时回退到 key 本身，`npm run i18n:check` 会在测试链里拦下缺失。
 */
import { arSA } from './messages/ar-SA'
import { csCZ } from './messages/cs-CZ'
import { deDE } from './messages/de-DE'
import { enUS } from './messages/en-US'
import { esES } from './messages/es-ES'
import { frFR } from './messages/fr-FR'
import { idID } from './messages/id-ID'
import { itIT } from './messages/it-IT'
import { jaJP } from './messages/ja-JP'
import { koKR } from './messages/ko-KR'
import { plPL } from './messages/pl-PL'
import { ptBR } from './messages/pt-BR'
import { ruRU } from './messages/ru-RU'
import { trTR } from './messages/tr-TR'
import { viVN } from './messages/vi-VN'
import { zhCN } from './messages/zh-CN'
import { zhTW } from './messages/zh-TW'

export type Locale =
  | 'zh-CN'
  | 'zh-TW'
  | 'en-US'
  | 'ja-JP'
  | 'ko-KR'
  | 'ar-SA'
  | 'cs-CZ'
  | 'de-DE'
  | 'es-ES'
  | 'fr-FR'
  | 'id-ID'
  | 'it-IT'
  | 'pl-PL'
  | 'pt-BR'
  | 'ru-RU'
  | 'tr-TR'
  | 'vi-VN'

/** 由简体中文（源语言）字典推导出的合法 key，写错 key 会在类型检查阶段报错 */
export type MessageKey = keyof typeof zhCN

export interface LocaleOption {
  /** 写入 localStorage 与 <html lang> 的语言标记 */
  value: Locale
  /** 用该语言自称的名称，切换列表里始终显示自称 */
  label: string
}

export type TranslateParams = Record<string, string | number>

export const DEFAULT_LOCALE: Locale = 'zh-CN'
export const LOCALE_STORAGE_KEY = 'novel-library:locale'

/**
 * 切换列表的显示顺序：中文（简/繁）、英语、日韩排在前面，
 * 其余按语言标记字母序补齐，方便不懂该语言的用户在长列表里定位。
 * 只影响排序，不影响任何取值逻辑。
 */
export const SUPPORTED_LOCALES: readonly LocaleOption[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'ar-SA', label: 'العربية' },
  { value: 'cs-CZ', label: 'Čeština' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'id-ID', label: 'Bahasa Indonesia' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'pl-PL', label: 'Polski' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'tr-TR', label: 'Türkçe' },
  { value: 'vi-VN', label: 'Tiếng Việt' }
]

/** 每种受支持语言的字典；key 与 zh-CN 完全一致 */
export const MESSAGES: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'ar-SA': arSA,
  'cs-CZ': csCZ,
  'de-DE': deDE,
  'es-ES': esES,
  'fr-FR': frFR,
  'id-ID': idID,
  'it-IT': itIT,
  'pl-PL': plPL,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'tr-TR': trTR,
  'vi-VN': viVN
}

/**
 * 语言标记前缀 → 受支持语言，**按顺序匹配**。
 * 繁体必须排在 `zh` 之前，否则 `zh-Hant`、`zh-TW` 会被大陆中文先吃掉；
 * `pt` 归到巴西葡语、`in` 是印尼语的旧标记，一并收进来。
 */
const LOCALE_PREFIXES: readonly (readonly [string, Locale])[] = [
  ['ar', 'ar-SA'],
  ['cs', 'cs-CZ'],
  ['de', 'de-DE'],
  ['en', 'en-US'],
  ['es', 'es-ES'],
  ['fr', 'fr-FR'],
  ['id', 'id-ID'],
  ['in', 'id-ID'],
  ['it', 'it-IT'],
  ['ja', 'ja-JP'],
  ['ko', 'ko-KR'],
  ['pl', 'pl-PL'],
  ['pt', 'pt-BR'],
  ['ru', 'ru-RU'],
  ['tr', 'tr-TR'],
  ['vi', 'vi-VN'],
  ['zh-hant', 'zh-TW'],
  ['zh-tw', 'zh-TW'],
  ['zh-hk', 'zh-TW'],
  ['zh-mo', 'zh-TW'],
  ['zh', 'zh-CN']
]

/** 右到左书写的语言，需要给 <html dir> 设成 rtl */
const RTL_LOCALES = new Set<Locale>(['ar-SA'])

function matchLocale(tag: string): Locale | undefined {
  return LOCALE_PREFIXES.find(([prefix]) => tag.startsWith(prefix))?.[1]
}

export function isLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.some(option => option.value === value)
}

/**
 * 把各种来源的语言标记收敛到受支持的语言：
 * `en`、`en_GB`、`EN-us` 都归到 en-US；`ja`、`ja_JP` 归到 ja-JP；
 * `zh`、`zh-Hans`、`zh-SG` 归到 zh-CN；`zh-Hant`、`zh-TW`、`zh-HK` 归到 zh-TW；
 * `pt-PT` 归到 pt-BR，`de-AT`、`es-419`、`ar-EG` 等地区变体归到各自主变体。
 */
export function normalizeLocale(value: string | null | undefined): Locale {
  const tag = String(value ?? '').trim().toLowerCase().replace(/_/gu, '-')
  if (!tag) return DEFAULT_LOCALE
  return matchLocale(tag) ?? DEFAULT_LOCALE
}

/** 按浏览器语言偏好推断初始语言，第一个受支持的偏好胜出 */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  for (const language of languages ?? []) {
    const tag = String(language ?? '').trim().toLowerCase().replace(/_/gu, '-')
    const matched = tag ? matchLocale(tag) : undefined
    if (matched) return matched
  }
  return DEFAULT_LOCALE
}

/** 书写方向，供 <html dir> 使用 */
export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'
}

/** 把 `{name}` 形式的占位符替换为参数，缺失的参数保持原样便于排查 */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => {
    const value = params[name]
    return value === undefined || value === null ? match : String(value)
  })
}

export function hasTranslation(locale: Locale, source: string): boolean {
  return Boolean(MESSAGES[locale]?.[source])
}

/**
 * 翻译单条文案。key 在所有语言里都存在；万一缺失则回退到 key 本身，
 * 方便在界面上直接看出是哪一条没翻译，而不是显示空白。
 */
export function translate(locale: Locale, source: string, params?: TranslateParams): string {
  const template = MESSAGES[locale]?.[source] ?? MESSAGES[DEFAULT_LOCALE]?.[source] ?? source
  return interpolate(template, params)
}

/** 语言的自称，用于设置页与切换入口 */
export function localeLabel(locale: Locale): string {
  return SUPPORTED_LOCALES.find(option => option.value === locale)?.label ?? locale
}
