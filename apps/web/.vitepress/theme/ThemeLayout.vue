<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { nextTick, onMounted, onUpdated, watch } from 'vue'
import ReadingTools from './components/ReadingTools.vue'
import LanguageSwitch from './components/LanguageSwitch.vue'
import { initializeLocale, useI18n } from '@novel-library/i18n/vue'
import { patchNavLabels, syncSiteChrome, type SiteThemeConfig } from './site-chrome'

const { Layout } = DefaultTheme
const { locale } = useI18n()
// useData() 只能在 setup 阶段调用，钩子里再调拿不到注入
const { theme, site } = useData()
const siteTheme = () => theme.value?.themeConfig as SiteThemeConfig | undefined

// VitePress 有 SSR：挂载后再恢复用户语言，避免服务端与客户端渲染不一致
onMounted(() => {
  initializeLocale()
  syncSiteChrome(locale.value, siteTheme(), site.value.base)
})
watch(locale, value => {
  syncSiteChrome(value, siteTheme(), site.value.base)
  void nextTick(() => patchNavLabels(value, site.value.base))
})
// 导航由 VitePress 自己的组件渲染，会在更新后覆盖掉手写文字，这里兜底重贴
onUpdated(() => patchNavLabels(locale.value, site.value.base))
</script>

<template>
  <Layout>
    <template #layout-bottom>
      <ReadingTools />
      <LanguageSwitch />
    </template>
  </Layout>
</template>
