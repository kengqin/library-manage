/**
 * VitePress 站点外壳文案同步。
 *
 * 站点导航与页脚按钮的文字来自 `.vitepress/config.mts` 的静态配置，
 * 不属于 Vue 组件，切换语言时只能就地改写 themeConfig 再让主题重新渲染。
 * 书名为内容层数据（book.json），这里不动。
 *
 * 注意：themeConfig 必须由调用方在 setup 阶段用 useData() 取出来传进来，
 * 不能在 onMounted 等钩子里再调用 useData()（inject 只在 setup 内有效）。
 */
import { localeDirection, translate, type Locale, type MessageKey } from '@novel-library/i18n'

export interface SiteThemeConfig {
  nav?: Array<{ text?: string; link?: string }>
  docFooter?: { prev?: string; next?: string }
  darkModeSwitchLabel?: string
  sidebarMenuLabel?: string
  returnToTopLabel?: string
}

/**
 * 固定导航项：URL 路径 → 文案 key。
 * 运行时 link 已经带上了站点 base（形如 /library-manage/本地书架/），
 * 所以先剥掉 base 再比对，避免误伤书名条目。
 */
const NAV_SOURCE: Record<string, MessageKey | undefined> = {
  '': 'nav.library',
  本地书架: 'nav.localShelf'
}

function normalizeBase(base: string | undefined): string {
  const value = base || '/'
  return value.endsWith('/') ? value : `${value}/`
}

function navSource(link: string | undefined, base: string): string | undefined {
  if (!link) return undefined
  let path = link.replace(/^https?:\/\/[^/]+/u, '')
  const prefix = normalizeBase(base)
  if (path.startsWith(prefix)) path = path.slice(prefix.length)
  path = path.replace(/^\/+|\/+$/gu, '')
  return NAV_SOURCE[path]
}

export function syncSiteChrome(locale: Locale, config: SiteThemeConfig | undefined, base = '/') {
  if (!config) return
  for (const item of config.nav ?? []) {
    const source = navSource(item.link, base)
    if (source) item.text = translate(locale, source)
  }
  config.docFooter = { prev: translate(locale, 'reader.prevChapter'), next: translate(locale, 'reader.nextChapter') }
  config.darkModeSwitchLabel = translate(locale, 'reader.theme')
  config.sidebarMenuLabel = translate(locale, 'contents.title')
  config.returnToTopLabel = translate(locale, 'common.backToTop')
  patchNavLabels(locale, base)
}

/**
 * VitePress 的 siteData 是浅层 ref，就地改写 themeConfig 不会触发导航重渲染，
 * 而且每次重渲染都会用回原配置，所以直接把已渲染的导航文字改掉，
 * 并在组件更新后重复执行（见 ThemeLayout 的 onUpdated）。
 */
export function patchNavLabels(locale: Locale, base: string) {
  if (typeof document === 'undefined') return
  // VitePress 水合时会用站点配置里的 lang 覆盖 <html>，这里在每次更新后重新写回
  document.documentElement.lang = locale
  document.documentElement.dir = localeDirection(locale)
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('.VPNavBarMenu a')) {
    const source = navSource(anchor.getAttribute('href') ?? undefined, base)
    if (!source) continue
    const text = translate(locale, source)
    if (anchor.textContent !== text) anchor.textContent = text
  }
  // 移动端抽屉里的「外观」标签同样来自静态配置，就地改掉
  const appearance = document.querySelector<HTMLElement>('.item.appearance .label')
  if (appearance) {
    const text = translate(locale, 'reader.theme')
    if (appearance.textContent !== text) appearance.textContent = text
  }
}
