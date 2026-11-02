<script setup lang="ts">
import { t, useI18n } from '@novel-library/i18n/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, BookOpen, HardDrive, LibraryBig, Shuffle, Upload } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import library from '../../library.generated.json'
import { getThemePreset } from '../local-library/themes'
const coverModules = import.meta.glob('../../../../书库/*/站点/*.{avif,gif,jpeg,jpg,png,webp}', { eager: true, import: 'default' }) as Record<string, string>
const { locale } = useI18n()
// 中文标题「小说书库」两段之间不留空格，西文（Romans Bibliothèque）需要一个词间隔
const titleGap = computed(() => (locale.value.startsWith('zh') || locale.value === 'ja-JP' ? '' : ' '))
const activeFilter = ref('all')
const localShelfVisual = getThemePreset('amber-library').image || ''
const filters = computed(() => [{ id: 'all', label: t('common.all') }, ...[...new Set(library.books.map(book => book.status))].map(status => ({ id: status, label: status }))])
const filteredBooks = computed(() => activeFilter.value === 'all' ? library.books : library.books.filter(book => book.status === activeFilter.value))

function imageFor(book: typeof library.books[number]) {
  if (!book.cover) return ''
  const suffix = `/书库/${book.slug}/站点/${book.cover}`
  return Object.entries(coverModules).find(([file]) => file.endsWith(suffix))?.[1] ?? ''
}

function moveCard(event: PointerEvent) {
  const card = event.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  card.style.setProperty('--card-rx', `${(0.5 - y) * 4}deg`)
  card.style.setProperty('--card-ry', `${(x - 0.5) * 5}deg`)
  card.style.setProperty('--pointer-x', `${x * 100}%`)
  card.style.setProperty('--pointer-y', `${y * 100}%`)
}

function resetCard(event: PointerEvent) {
  const card = event.currentTarget as HTMLElement
  card.style.setProperty('--card-rx', '0deg')
  card.style.setProperty('--card-ry', '0deg')
  card.style.setProperty('--pointer-x', '50%')
  card.style.setProperty('--pointer-y', '50%')
}

function openRandomBook() {
  const pool = filteredBooks.value.length ? filteredBooks.value : library.books
  if (!pool.length) return
  const book = pool[Math.floor(Math.random() * pool.length)]
  window.location.href = withBase(book.topicLink)
}

onMounted(() => document.body.classList.add('is-eternal-home'))
onBeforeUnmount(() => document.body.classList.remove('is-eternal-home'))
</script>

<template>
  <header class="library-nav">
    <a class="library-brand" :href="withBase('/')"><LibraryBig :size="22" /><strong>{{ t('app.name') }}</strong></a>
    <div class="library-nav__actions">
      <span>{{ library.books.length }} BOOKS</span>
      <a class="library-nav__shelf" :href="withBase('/本地书架/')"><HardDrive :size="15" /> {{ t('library.shelf.mine') }} <ArrowRight :size="14" /></a>
    </div>
  </header>

  <main class="library-home">
    <section class="library-heading">
      <p>STORIES · WORLDS · JOURNEYS</p>
      <h1><span>{{ t('library.novels') }}</span>{{ titleGap }}<strong>{{ t('nav.library') }}</strong></h1>
      <span>{{ t('library.shelf.tagline') }}</span>
    </section>

    <section class="library-shelf-feature" :style="{ '--shelf-image': localShelfVisual ? `url(${localShelfVisual})` : 'none' }">
      <div class="library-shelf-feature__copy">
        <p><HardDrive :size="15" /> PRIVATE LIBRARY</p>
        <h2>{{ t('library.shelf.mineLocal') }}</h2>
        <span>{{ t('import.txt.webDescription') }}</span>
        <div>
          <a class="library-shelf-primary" :href="withBase('/本地书架/?import=1')"><Upload :size="17" /> {{ t('import.txt.action') }} <ArrowRight :size="16" /></a>
          <a class="library-shelf-secondary" :href="withBase('/本地书架/')">{{ t('library.shelf.open') }} <ArrowRight :size="16" /></a>
        </div>
      </div>
      <div class="library-shelf-feature__meta" aria-hidden="true">
        <span>LOCAL</span><b>TXT</b><small>PRIVATE · OFFLINE</small>
      </div>
    </section>

    <section class="library-static-section">
    <div class="library-toolbar">
      <span class="library-toolbar__label">ONLINE COLLECTION</span>
      <div class="library-toolbar__controls">
        <div class="library-filters" role="group" :aria-label="t('library.filter.status')">
          <button v-for="filter in filters" :key="filter.id" type="button" :class="{ active: activeFilter === filter.id }" @click="activeFilter = filter.id">{{ filter.label }}</button>
        </div>
        <button class="library-random-button" type="button" :title="t('library.random')" :disabled="!library.books.length" @click="openRandomBook"><Shuffle :size="15" /></button>
        <span>{{ filteredBooks.length }} / {{ library.books.length }}</span>
      </div>
    </div>

    <TransitionGroup tag="section" name="book-grid" class="book-gallery" :aria-label="t('library.novels.list')">
      <a v-for="(book, index) in filteredBooks" :key="book.id" class="book-tile" :href="withBase(book.topicLink)" :style="{ '--tile-index': index }" @pointermove="moveCard" @pointerleave="resetCard">
        <div class="book-tile__media" :style="{ backgroundImage: imageFor(book) ? `url(${imageFor(book)})` : undefined }">
          <div class="book-tile__shade" />
          <div class="book-tile__glow" />
          <span class="book-tile__index">{{ String(index + 1).padStart(2, '0') }}</span>
          <div class="book-tile__meta"><span>{{ book.status }}</span><small>{{ t('unit.chapters', { count: book.chapterCount }) }}</small></div>
        </div>
        <div class="book-tile__content">
          <div class="book-tile__heading"><div><h2>{{ book.title }}</h2><p>{{ book.author }}</p></div><ArrowRight :size="19" /></div>
          <blockquote>{{ book.description }}</blockquote>
          <span class="book-tile__enter"><BookOpen :size="17" /> {{ t('online.topic.open') }} <ArrowRight :size="17" /></span>
        </div>
      </a>
    </TransitionGroup>
    </section>
  </main>
</template>
