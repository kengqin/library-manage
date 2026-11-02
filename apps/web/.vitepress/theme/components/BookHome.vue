<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, LibraryBig, ScrollText } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import library from '../../library.generated.json'

const props = defineProps<{ bookId: string }>()
const book = computed(() => library.books.find(item => item.id === props.bookId) ?? library.books[0])
const coverModules = import.meta.glob('../../../../书库/*/站点/*.{avif,gif,jpeg,jpg,png,webp}', { eager: true, import: 'default' }) as Record<string, string>
const image = computed(() => {
  if (!book.value.cover) return ''
  const suffix = `/书库/${book.value.slug}/站点/${book.value.cover}`
  return Object.entries(coverModules).find(([file]) => file.endsWith(suffix))?.[1] ?? ''
})
const seal = computed(() => book.value.seal || book.value.title.slice(0, 1) || t('unit.bookShort'))
const heroShift = ref(0)
const catalogue = ref<HTMLElement | null>(null)
const catalogueVisible = ref(false)
let catalogueObserver: IntersectionObserver | undefined
const groups = computed(() => {
  const grouped = new Map<string, typeof book.value.chapters>()
  for (const chapter of book.value.chapters) {
    const items = grouped.get(chapter.group) ?? []
    items.push(chapter)
    grouped.set(chapter.group, items)
  }
  return [...grouped.entries()].map(([group, chapters]) => ({ group, first: chapters[0], last: chapters.at(-1)!, count: chapters.length }))
})

function updateParallax() {
  heroShift.value = Math.min(window.scrollY * 0.08, 48)
}

onMounted(() => {
  document.body.classList.add('is-eternal-home')
  window.addEventListener('scroll', updateParallax, { passive: true })
  catalogueObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) catalogueVisible.value = true
  }, { threshold: 0.12 })
  if (catalogue.value) catalogueObserver.observe(catalogue.value)
})
onBeforeUnmount(() => {
  document.body.classList.remove('is-eternal-home')
  window.removeEventListener('scroll', updateParallax)
  catalogueObserver?.disconnect()
})
</script>

<template>
  <header class="eternal-nav">
    <a class="eternal-brand" :href="withBase(book.topicLink)">
      <span class="eternal-brand__seal">{{ seal }}</span>
      <span><strong>{{ book.title }}</strong><small>{{ book.author }}</small></span>
    </a>
    <nav class="eternal-nav__links" :aria-label="t('app.navigation.novel')">
      <a :href="withBase('/')">{{ t('nav.library') }}</a>
      <a class="active" :href="withBase(book.topicLink)">{{ t('online.topic') }}</a>
      <a :href="withBase(book.catalogueLink)">{{ t('contents.full') }}</a>
    </nav>
    <div class="eternal-nav__actions">
      <a class="book-back" :href="withBase('/')" :aria-label="t('library.back')" :title="t('library.back')"><LibraryBig :size="18" /></a>
      <a class="eternal-nav__read" :href="withBase(book.firstLink)">{{ t('library.startReading') }} <ArrowRight :size="15" /></a>
    </div>
  </header>

  <main class="eternal-home book-home" :class="`${book.id}-home`">
    <section class="eternal-hero" :style="{ backgroundImage: `url(${image})`, '--hero-shift': `${heroShift}px` }">
      <div class="eternal-hero__veil" aria-hidden="true" />
      <div class="eternal-hero__mist eternal-hero__mist--one" aria-hidden="true" />
      <div class="eternal-hero__content">
        <a class="book-breadcrumb" :href="withBase('/')"><ArrowLeft :size="14" /> {{ t('app.name') }}</a>
        <p class="eternal-kicker">{{ book.status }} · {{ book.author }}</p>
        <h1><strong>{{ book.title.slice(0, 1) }}</strong><span>{{ book.title.slice(1) }}</span></h1>
        <p class="eternal-lead">{{ book.description }}</p>
        <blockquote>{{ t('contents.rangeTotal', { range: book.range, count: book.chapterCount }) }}</blockquote>
        <div class="eternal-actions">
          <a class="eternal-button eternal-button--primary" :href="withBase(book.firstLink)"><BookOpen :size="18" /> {{ t('library.startReading') }} <ArrowRight :size="17" /></a>
          <a class="eternal-button eternal-button--ghost" href="#catalogue"><ScrollText :size="18" /> {{ t('contents.view') }}</a>
        </div>
      </div>
      <a class="eternal-scroll" href="#catalogue"><span>{{ t('contents.chapterList') }}</span><ChevronDown :size="19" /></a>
    </section>

    <section id="catalogue" ref="catalogue" class="eternal-catalogue" :class="{ 'is-visible': catalogueVisible }">
      <div class="eternal-catalogue__intro">
        <div><p class="section-mark">TABLE OF CONTENTS</p><h2>{{ t('contents.titleOf', { title: book.title }) }}</h2><p>{{ t('contents.groupedHint') }}</p></div>
        <div class="volume-seal"><span>{{ book.status }}</span><strong>{{ book.chapterCount }}</strong><small>{{ t('unit.chaptersShort') }}</small></div>
      </div>
      <div class="chapter-list range-list">
        <a v-for="(group, index) in groups" :key="group.group" :href="withBase(group.first.link)" class="chapter-entry" :style="{ '--entry-index': index }">
          <span class="chapter-entry__index">{{ String(group.first.order).padStart(4, '0') }}</span>
          <span><small>{{ group.count }} CHAPTERS</small>{{ group.first.label }}—{{ group.last.label }}</span>
          <ArrowRight :size="17" />
        </a>
      </div>
      <a class="catalogue-all" :href="withBase(book.catalogueLink)"><ScrollText :size="18" /> {{ t('contents.viewFull') }} <ArrowRight :size="17" /></a>
    </section>
  </main>
</template>
