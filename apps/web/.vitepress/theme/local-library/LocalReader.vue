<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlignJustify, ArrowLeft, ChevronLeft, ChevronRight, Menu, Minus, Moon, Plus, Sun, Type, X } from 'lucide-vue-next'
import { formatChapterLabel, type LocalBook, type LocalChapter } from './types'

const props = defineProps<{ book: LocalBook; chapters: LocalChapter[]; chapter: LocalChapter; coverUrl?: string }>()
const emit = defineEmits<{ back: []; open: [number: number]; progress: [chapter: number, progress: number] }>()
const sidebarOpen = ref(false)
const settingsOpen = ref(false)
const fontSize = ref(18)
const lineHeight = ref(2.05)
const palette = ref<'light' | 'paper' | 'night'>('paper')
const readingProgress = ref(0)
let progressTimer = 0

const paragraphs = computed(() => props.chapter.content.split(/\n{2,}/).filter(Boolean))
const chapterIndex = computed(() => props.chapters.findIndex(item => item.number === props.chapter.number))
const previous = computed(() => props.chapters[chapterIndex.value - 1])
const next = computed(() => props.chapters[chapterIndex.value + 1])

function saveSettings() {
  localStorage.setItem('local-reader-settings', JSON.stringify({ fontSize: fontSize.value, lineHeight: lineHeight.value, palette: palette.value }))
}

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const progress = scrollable > 0 ? Math.min(100, Math.max(0, window.scrollY / scrollable * 100)) : 0
  readingProgress.value = progress
  window.clearTimeout(progressTimer)
  progressTimer = window.setTimeout(() => emit('progress', props.chapter.number, progress), 350)
}

function openChapter(number: number) {
  sidebarOpen.value = false
  emit('open', number)
}

onMounted(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('local-reader-settings') || '{}')
    if (stored.fontSize) fontSize.value = stored.fontSize
    if (stored.lineHeight) lineHeight.value = stored.lineHeight
    if (stored.palette) palette.value = stored.palette
  } catch {}
  window.addEventListener('scroll', updateProgress, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateProgress)
  window.clearTimeout(progressTimer)
})
watch([fontSize, lineHeight, palette], saveSettings)
watch(() => props.chapter.number, () => nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' })))
</script>

<template>
  <div class="local-reader" :class="`local-reader--${palette}`" :style="{ '--local-font-size': `${fontSize}px`, '--local-line-height': lineHeight }">
    <div class="local-reading-progress" :style="{ width: `${readingProgress}%`, background: book.theme.accent }" />
    <header class="local-reader-nav"><button type="button" :title="t('online.topic.backToBook')" @click="emit('back')"><ArrowLeft :size="18" /></button><button type="button" class="local-reader-menu" @click="sidebarOpen = !sidebarOpen"><Menu :size="18" /> {{ t('contents.title') }}</button><div><strong>{{ book.title }}</strong><span>{{ formatChapterLabel(chapter) }} · {{ chapterIndex + 1 }} / {{ book.chapterCount }}</span></div><button type="button" :title="t('reader.settings')" @click="settingsOpen = !settingsOpen"><Type :size="18" /></button></header>
    <aside class="local-reader-sidebar" :class="{ open: sidebarOpen }"><header><strong>{{ t('contents.chapterList') }}</strong><button type="button" @click="sidebarOpen = false"><X :size="18" /></button></header><nav><button v-for="item in chapters" :key="item.id" type="button" :class="{ active: item.number === chapter.number }" @click="openChapter(item.number)"><small>{{ formatChapterLabel(item) }}</small><span>{{ item.title }}</span></button></nav></aside>
    <div v-if="sidebarOpen" class="local-reader-scrim" @click="sidebarOpen = false" />

    <Transition name="reader-panel"><section v-if="settingsOpen" class="local-reader-settings"><header><strong>{{ t('reader.settings') }}</strong><button type="button" @click="settingsOpen = false"><X :size="17" /></button></header><label><span><Type :size="16" /> {{ t('reader.typography.fontSize') }}</span><div><button type="button" @click="fontSize = Math.max(15, fontSize - 1)"><Minus :size="15" /></button><output>{{ fontSize }}</output><button type="button" @click="fontSize = Math.min(24, fontSize + 1)"><Plus :size="15" /></button></div></label><label><span><AlignJustify :size="16" /> {{ t('reader.typography.lineHeight') }}</span><div class="local-reader-segments"><button v-for="value in [1.8, 2.05, 2.3]" :key="value" type="button" :class="{ active: lineHeight === value }" @click="lineHeight = value">{{ value === 1.8 ? t('reader.spacing.compact') : value === 2.05 ? t('reader.spacing.comfortable') : t('reader.spacing.loose') }}</button></div></label><label><span><Sun :size="16" /> {{ t('reader.theme.paperShort') }}</span><div class="local-reader-segments"><button v-for="item in ([['light',t('reader.theme.plainWhite')],['paper',t('reader.theme.ricePaper')],['night',t('reader.theme.nightReading')]] as const)" :key="item[0]" type="button" :class="{ active: palette === item[0] }" @click="palette = item[0]"><Moon v-if="item[0] === 'night'" :size="13" />{{ item[1] }}</button></div></label></section></Transition>

    <main class="local-reader-content"><article><p class="local-reader-volume">{{ chapter.volume || book.title }}</p><h1>{{ formatChapterLabel(chapter) }} {{ chapter.title }}</h1><p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p></article><footer><button type="button" :disabled="!previous" @click="previous && openChapter(previous.number)"><ChevronLeft :size="18" /><span><small>{{ t('reader.prevChapter') }}</small>{{ previous?.title || t('reader.firstChapter') }}</span></button><button type="button" :disabled="!next" @click="next && openChapter(next.number)"><span><small>{{ t('reader.nextChapter') }}</small>{{ next?.title || t('reader.lastChapter') }}</span><ChevronRight :size="18" /></button></footer></main>
  </div>
</template>
