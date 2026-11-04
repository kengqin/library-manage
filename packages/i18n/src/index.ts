/**
 * 多语言核心（与框架无关）。
 *
 * 约定：文案以语义 key 组织（`common.save`、`library.shelf.empty`），
 * 每门语言一份 `messages/<locale>.ts`，key 集合完全一致；
 * 简体中文也在字典里（`messages/zh-CN.ts`），因此调整措辞只改字典、不动组件。
 * 缺少译文时回退到 key 本身，`npm run i18n:check` 会在测试链里拦下缺失。
 *
 * 默认界面语言的判定收敛在 `resolveLocale`：系统语言 → 本机时区 → 简体中文，
 * 任一步取不到系统信息都只是少一条线索，最终一定落在 `DEFAULT_LOCALE`。
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
import { thTH } from './messages/th-TH'
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
  | 'th-TH'
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
  { value: 'th-TH', label: 'ไทย' },
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
  'th-TH': thTH,
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
  ['th', 'th-TH'],
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

/** 语言标记归一：去空白、转小写、下划线转连字符（`ja_JP` → `ja-jp`、`EN-us` → `en-us`） */
function normalizeTag(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/_/gu, '-')
}

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
  const tag = normalizeTag(value)
  if (!tag) return DEFAULT_LOCALE
  return matchLocale(tag) ?? DEFAULT_LOCALE
}

/* ────────────────────────── 时区回退 ────────────────────────── */

/**
 * 时区（IANA 标记，全小写）→ 受支持语言，作为「系统语言不受支持」时的第二优先级。
 *
 * 收录原则：只在该时区所在地区确有某门受支持语言作为主要界面书面语时才收录，
 * 多语言地区按实际使用习惯取一门（新加坡、印度、菲律宾、加拿大取 en-US）。
 * **刻意不收录**语言全都不受支持的地区（`asia/yangon`、`africa/addis_ababa`、
 * `asia/phnom_penh`），这类时区视为无法匹配，交给调用方回退到默认语言，
 * 而不是按地理位置硬猜。
 *
 * 键同时兼容少量遗留时区 ID（`prc`、`roc`、`hongkong`、`gb`、`eire`、`japan`），
 * 部分老系统与第三方运行时会返回这些名字。
 */
const TIME_ZONE_LOCALES: Readonly<Record<string, Locale>> = {
  // 简体中文：中国大陆全境（含东六区的乌鲁木齐等）
  'asia/shanghai': 'zh-CN',
  'asia/chongqing': 'zh-CN',
  'asia/harbin': 'zh-CN',
  'asia/urumqi': 'zh-CN',
  'asia/kashgar': 'zh-CN',
  prc: 'zh-CN',
  // 繁体中文：中国台湾、中国香港、中国澳门
  'asia/taipei': 'zh-TW',
  'asia/hong_kong': 'zh-TW',
  'asia/macau': 'zh-TW',
  roc: 'zh-TW',
  hongkong: 'zh-TW',
  // 日语、韩语
  'asia/tokyo': 'ja-JP',
  japan: 'ja-JP',
  'asia/seoul': 'ko-KR',
  'asia/pyongyang': 'ko-KR',
  rok: 'ko-KR',
  // 泰语、越南语、印尼语
  'asia/bangkok': 'th-TH',
  'asia/ho_chi_minh': 'vi-VN',
  'asia/saigon': 'vi-VN',
  'asia/jakarta': 'id-ID',
  'asia/pontianak': 'id-ID',
  'asia/makassar': 'id-ID',
  'asia/jayapura': 'id-ID',
  // 阿拉伯语：海湾、黎凡特、北非
  'asia/riyadh': 'ar-SA',
  'asia/dubai': 'ar-SA',
  'asia/qatar': 'ar-SA',
  'asia/kuwait': 'ar-SA',
  'asia/bahrain': 'ar-SA',
  'asia/muscat': 'ar-SA',
  'asia/baghdad': 'ar-SA',
  'asia/amman': 'ar-SA',
  'asia/beirut': 'ar-SA',
  'asia/damascus': 'ar-SA',
  'asia/aden': 'ar-SA',
  'asia/gaza': 'ar-SA',
  'asia/hebron': 'ar-SA',
  'africa/cairo': 'ar-SA',
  'africa/tripoli': 'ar-SA',
  'africa/khartoum': 'ar-SA',
  'africa/algiers': 'ar-SA',
  'africa/tunis': 'ar-SA',
  'africa/casablanca': 'ar-SA',
  'africa/el_aaiun': 'ar-SA',
  'africa/nouakchott': 'ar-SA',
  // 德语、法语、意大利语
  'europe/berlin': 'de-DE',
  'europe/vienna': 'de-DE',
  'europe/zurich': 'de-DE',
  'europe/luxembourg': 'de-DE',
  'europe/vaduz': 'de-DE',
  'europe/paris': 'fr-FR',
  'europe/monaco': 'fr-FR',
  'africa/abidjan': 'fr-FR',
  'africa/dakar': 'fr-FR',
  'africa/bamako': 'fr-FR',
  'africa/ouagadougou': 'fr-FR',
  'africa/niamey': 'fr-FR',
  'africa/conakry': 'fr-FR',
  'africa/lome': 'fr-FR',
  'africa/cotonou': 'fr-FR',
  'africa/libreville': 'fr-FR',
  'africa/brazzaville': 'fr-FR',
  'africa/kinshasa': 'fr-FR',
  'africa/bangui': 'fr-FR',
  'africa/ndjamena': 'fr-FR',
  'africa/douala': 'fr-FR',
  'indian/reunion': 'fr-FR',
  'indian/mayotte': 'fr-FR',
  'america/cayenne': 'fr-FR',
  'america/martinique': 'fr-FR',
  'america/guadeloupe': 'fr-FR',
  'america/port-au-prince': 'fr-FR',
  'europe/rome': 'it-IT',
  'europe/vatican': 'it-IT',
  'europe/san_marino': 'it-IT',
  'europe/malta': 'it-IT',
  // 西班牙语：本土、拉美
  'europe/madrid': 'es-ES',
  'atlantic/canary': 'es-ES',
  'africa/ceuta': 'es-ES',
  'america/mexico_city': 'es-ES',
  'america/monterrey': 'es-ES',
  'america/cancun': 'es-ES',
  'america/tijuana': 'es-ES',
  'america/chihuahua': 'es-ES',
  'america/hermosillo': 'es-ES',
  'america/mazatlan': 'es-ES',
  'america/bogota': 'es-ES',
  'america/lima': 'es-ES',
  'america/santiago': 'es-ES',
  'america/punta_arenas': 'es-ES',
  'america/montevideo': 'es-ES',
  'america/caracas': 'es-ES',
  'america/guatemala': 'es-ES',
  'america/costa_rica': 'es-ES',
  'america/panama': 'es-ES',
  'america/havana': 'es-ES',
  'america/santo_domingo': 'es-ES',
  'america/puerto_rico': 'es-ES',
  'america/el_salvador': 'es-ES',
  'america/tegucigalpa': 'es-ES',
  'america/managua': 'es-ES',
  'america/asuncion': 'es-ES',
  'america/la_paz': 'es-ES',
  'america/guayaquil': 'es-ES',
  // 葡萄牙语：巴西、葡萄牙、非洲葡语国家
  'america/sao_paulo': 'pt-BR',
  'america/bahia': 'pt-BR',
  'america/fortaleza': 'pt-BR',
  'america/recife': 'pt-BR',
  'america/maceio': 'pt-BR',
  'america/manaus': 'pt-BR',
  'america/belem': 'pt-BR',
  'america/santarem': 'pt-BR',
  'america/cuiaba': 'pt-BR',
  'america/campo_grande': 'pt-BR',
  'america/porto_velho': 'pt-BR',
  'america/rio_branco': 'pt-BR',
  'america/noronha': 'pt-BR',
  'europe/lisbon': 'pt-BR',
  'atlantic/azores': 'pt-BR',
  'atlantic/madeira': 'pt-BR',
  'africa/luanda': 'pt-BR',
  'africa/maputo': 'pt-BR',
  'africa/bissau': 'pt-BR',
  'africa/praia': 'pt-BR',
  'africa/sao_tome': 'pt-BR',
  // 俄语：俄罗斯全境及俄语通行的周边国家
  'europe/moscow': 'ru-RU',
  'europe/kaliningrad': 'ru-RU',
  'europe/minsk': 'ru-RU',
  'asia/yekaterinburg': 'ru-RU',
  'asia/omsk': 'ru-RU',
  'asia/novosibirsk': 'ru-RU',
  'asia/barnaul': 'ru-RU',
  'asia/krasnoyarsk': 'ru-RU',
  'asia/novokuznetsk': 'ru-RU',
  'asia/irkutsk': 'ru-RU',
  'asia/chita': 'ru-RU',
  'asia/yakutsk': 'ru-RU',
  'asia/khandyga': 'ru-RU',
  'asia/vladivostok': 'ru-RU',
  'asia/ust-nera': 'ru-RU',
  'asia/magadan': 'ru-RU',
  'asia/sakhalin': 'ru-RU',
  'asia/srednekolymsk': 'ru-RU',
  'asia/kamchatka': 'ru-RU',
  'asia/anadyr': 'ru-RU',
  'asia/almaty': 'ru-RU',
  'asia/aqtau': 'ru-RU',
  'asia/aqtobe': 'ru-RU',
  'asia/atyrau': 'ru-RU',
  'asia/oral': 'ru-RU',
  'asia/qostanay': 'ru-RU',
  'asia/qyzylorda': 'ru-RU',
  'asia/bishkek': 'ru-RU',
  'asia/tashkent': 'ru-RU',
  'asia/samarkand': 'ru-RU',
  'asia/dushanbe': 'ru-RU',
  'asia/ashgabat': 'ru-RU',
  // 土耳其语、波兰语、捷克语
  'europe/istanbul': 'tr-TR',
  'asia/istanbul': 'tr-TR',
  'europe/warsaw': 'pl-PL',
  'europe/prague': 'cs-CZ',
  // 英语：英伦三岛、北美、大洋洲、英语为官方语言的亚洲与非洲地区
  'europe/london': 'en-US',
  gb: 'en-US',
  'europe/dublin': 'en-US',
  eire: 'en-US',
  'europe/gibraltar': 'en-US',
  'europe/isle_of_man': 'en-US',
  'america/new_york': 'en-US',
  'america/chicago': 'en-US',
  'america/denver': 'en-US',
  'america/los_angeles': 'en-US',
  'america/phoenix': 'en-US',
  'america/anchorage': 'en-US',
  'america/juneau': 'en-US',
  'america/detroit': 'en-US',
  'america/indiana/indianapolis': 'en-US',
  'america/toronto': 'en-US',
  'america/vancouver': 'en-US',
  'america/edmonton': 'en-US',
  'america/winnipeg': 'en-US',
  'america/regina': 'en-US',
  'america/halifax': 'en-US',
  'america/st_johns': 'en-US',
  'pacific/honolulu': 'en-US',
  'pacific/auckland': 'en-US',
  'pacific/fiji': 'en-US',
  'asia/singapore': 'en-US',
  singapore: 'en-US',
  'asia/kolkata': 'en-US',
  'asia/calcutta': 'en-US',
  'asia/manila': 'en-US',
  'asia/karachi': 'en-US',
  'africa/lagos': 'en-US',
  'africa/accra': 'en-US',
  'africa/nairobi': 'en-US',
  'africa/kampala': 'en-US',
  'africa/harare': 'en-US',
  'africa/lusaka': 'en-US',
  'africa/dar_es_salaam': 'en-US',
  'africa/johannesburg': 'en-US'
}

/**
 * 整片区域语言一致的时区用前缀兜住，省去逐条列举（`Australia/*` 全为英语）。
 * 按最长前缀优先命中，避免宽规则吃掉更具体的规则。
 */
const TIME_ZONE_PREFIXES: readonly (readonly [string, Locale])[] = [
  ['australia/', 'en-US'],
  ['america/argentina/', 'es-ES']
]

/**
 * 按本机时区推断语言；时区不受支持或格式无法识别时返回 `undefined`，
 * 由调用方决定回退（统一入口是 `resolveLocale`）。
 */
export function detectLocaleFromTimeZone(timeZone: string | null | undefined): Locale | undefined {
  // 时区标记只做去空白 + 转小写：`Asia/Ho_Chi_Minh` 的下划线是名字的一部分，不能替换
  const tag = String(timeZone ?? '').trim().toLowerCase()
  if (!tag) return undefined
  const exact = TIME_ZONE_LOCALES[tag]
  if (exact) return exact
  let matched: { length: number; locale: Locale } | undefined
  for (const [prefix, locale] of TIME_ZONE_PREFIXES) {
    if (!tag.startsWith(prefix)) continue
    if (!matched || prefix.length > matched.length) matched = { length: prefix.length, locale }
  }
  return matched?.locale
}

/** 默认语言是怎么定下来的，用于诊断与埋点 */
export type LocaleDetectionReason = 'system-language' | 'time-zone' | 'fallback'

export interface LocaleDetectionInput {
  /** 系统/浏览器语言偏好，按优先级从高到低（`navigator.languages` 的顺序） */
  languages?: readonly string[] | null
  /** 本机时区 IANA 标记，取自 `Intl.DateTimeFormat().resolvedOptions().timeZone` */
  timeZone?: string | null
}

export interface LocaleDetectionResult {
  locale: Locale
  reason: LocaleDetectionReason
  /** 真正命中的原始值（语言标记或时区），未命中时为空 */
  matched?: string
}

/**
 * 默认界面语言的统一判定入口，优先级固定为：
 *
 * 1. **系统语言**：按 `languages` 的顺序取第一个受支持的标记（`th-TH` 不支持就继续看下一个）；
 * 2. **本机时区**：语言全部不支持时，用 IANA 时区查 `TIME_ZONE_LOCALES`；
 * 3. **默认语言**：两者都没命中（含系统信息缺失、`Intl` 不可用、时区为空白或无法识别）时用 zh-CN。
 *
 * 任何一步取不到系统信息都只是「少一条线索」，不会抛错，最终一定落到 zh-CN。
 */
export function resolveLocale(input: LocaleDetectionInput = {}): LocaleDetectionResult {
  for (const language of input.languages ?? []) {
    const tag = normalizeTag(language)
    const matched = tag ? matchLocale(tag) : undefined
    if (matched) return { locale: matched, reason: 'system-language', matched: String(language) }
  }
  const byTimeZone = detectLocaleFromTimeZone(input.timeZone)
  if (byTimeZone) return { locale: byTimeZone, reason: 'time-zone', matched: String(input.timeZone ?? '').trim() }
  return { locale: DEFAULT_LOCALE, reason: 'fallback' }
}

/**
 * 按浏览器语言偏好推断初始语言，第一个受支持的偏好胜出。
 * 只看语言、不看时区；需要「语言 → 时区 → 默认」完整回退时用 `resolveLocale`。
 */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  return resolveLocale({ languages }).locale
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
