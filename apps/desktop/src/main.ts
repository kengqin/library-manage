import { createApp, nextTick } from 'vue'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import App from './App.vue'
import { router } from './router'
import { syncApplicationWindowChrome } from './services/window-chrome'
import { initializeTooltips } from './services/tooltips'
import { initializeScrollbars } from './services/scrollbars'
import { PAGE_TURN_DURATION, startPageTurn } from './services/startup-animation'
import { initializeLocale } from '@novel-library/i18n/vue'
import './styles.css'
import './styles/editorial.css'

// 语言必须在挂载前确定，避免先渲染中文再闪烁成译文
initializeLocale()

window.addEventListener('contextmenu', event => event.preventDefault(), true)

const app = createApp(App).use(router)
const overlayShell = isTauri() && ['app-message', 'app-tooltip', 'app-progress'].includes(getCurrentWindow().label)
const browserShell = isTauri() && (getCurrentWebview().label.startsWith('web-browser') || ['settings', 'release-history', 'app-update'].includes(getCurrentWindow().label) || overlayShell)
if (browserShell) document.documentElement.dataset.windowKind = getCurrentWebview().label
const stopPageTurn = browserShell ? () => {} : startPageTurn()
app.mount('#app')
if (!overlayShell) { initializeTooltips(); initializeScrollbars() }
if (browserShell) { document.getElementById('startup-splash')?.remove(); delete document.documentElement.dataset.starting }

// 设置、更新、更新历史这三个窗口由 Rust 侧以隐藏状态创建（`visible(false)`），
// 这里在首帧渲染进 DOM 后主动请求显示：窗口出现的第一眼就是最终画面，不会先闪空白框。
// 等的是本地渲染，不是接口——慢请求只会让状态文案停在「正在检查…」。
// Rust 侧另有 1.2 秒兜底，脚本异常也不至于点了没反应。
const REVEAL_ON_MOUNT_WINDOWS = ['settings', 'release-history', 'app-update']
if (isTauri() && REVEAL_ON_MOUNT_WINDOWS.includes(getCurrentWindow().label)) {
  void Promise.all([router.isReady(), nextTick()])
    .then(() => invoke('reveal_auxiliary_window', { label: getCurrentWindow().label }))
    .catch(() => {})
}

function dismissStartupSplash() {
  const splash = document.getElementById('startup-splash')
  if (!splash) {
    stopPageTurn()
    delete document.documentElement.dataset.starting
    void syncApplicationWindowChrome()
    return
  }
  splash.classList.add('startup-splash--leaving')
  window.setTimeout(() => {
    stopPageTurn()
    splash.remove()
    delete document.documentElement.dataset.starting
    void syncApplicationWindowChrome()
  }, 420)
}

async function waitForStartup() {
  if (!isTauri()) return
  if (browserShell) return
  try {
    let timedOut = false
    const timeout = new Promise<void>(resolve => {
      window.setTimeout(() => {
        timedOut = true
        resolve()
      }, 20_000)
    })
    await Promise.race([invoke('wait_for_startup'), timeout])
    if (timedOut) console.warn('application-startup-timeout')
  } catch (error) {
    console.error('application-startup-error', error)
  }
}

void Promise.all([router.isReady(), waitForStartup()]).then(() => {
  // 主界面上屏后，后台把设置/更新/更新历史三个窗口预创建好（隐藏）。
  // 用户点开时窗口已经渲染完成，直接显示就是最终画面，不用等加载。
  if (!browserShell && isTauri()) void invoke('prepare_auxiliary_windows').catch(() => {})
  // Local-only visual preview; production startup always dismisses normally.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('startup-preview')) {
    // Optional frozen frame for visual QA, never included in production startup.
    const frame = new URLSearchParams(location.search).get('frame')
    if (frame !== null && Number.isFinite(Number(frame))) {
      const progress = Math.max(0, Math.min(1, Number(frame)))
      document.querySelectorAll<SVGElement>('.startup-splash__sheet').forEach(element => {
        element.getAnimations().forEach(animation => {
          animation.pause()
          animation.currentTime = progress * PAGE_TURN_DURATION
        })
      })
    }
    return
  }
  // Paint the ready interface before fading, without delaying startup for animation.
  requestAnimationFrame(() => requestAnimationFrame(dismissStartupSplash))
})
