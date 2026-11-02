<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, Search, X } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import library from '../../library.generated.json'

const props = defineProps<{ bookId: string }>()
const query = ref('')
const book = computed(() => library.books.find(item => item.id === props.bookId) ?? library.books[0])
const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const filteredChapters = computed(() => {
  if (!normalizedQuery.value) return book.value.chapters
  return book.value.chapters.filter(chapter =>
    chapter.label.toLowerCase().includes(normalizedQuery.value) || chapter.title.toLowerCase().includes(normalizedQuery.value)
  )
})
const groups = computed(() => {
  const grouped = new Map<string, typeof book.value.chapters>()
  for (const chapter of filteredChapters.value) {
    const items = grouped.get(chapter.group) ?? []
    items.push(chapter)
    grouped.set(chapter.group, items)
  }
  return [...grouped.entries()].map(([group, chapters]) => ({ group, chapters }))
})
</script>

<template>
  <main class="book-catalogue-page">
    <header class="catalogue-header">
      <a :href="withBase(book.topicLink)"><ArrowLeft :size="16" /> {{ t('online.topic.back') }}</a>
      <p>TABLE OF CONTENTS</p>
      <h1>{{ book.title }} {{ t('contents.fullSuffix') }}</h1>
      <span>{{ t('contents.rangeTotalComma', { range: book.range, count: book.chapterCount }) }}</span>
    </header>

    <div class="catalogue-search">
      <Search :size="18" />
      <input v-model="query" type="search" :placeholder="`搜索${book.title}的章号或章名`" :aria-label="t('contents.search')" />
      <button v-if="query" type="button" :aria-label="t('search.clear')" @click="query = ''"><X :size="17" /></button>
      <output>{{ t('unit.chapters', { count: filteredChapters.length }) }}</output>
    </div>

    <div v-if="groups.length" class="catalogue-groups">
      <section v-for="group in groups" :key="group.group" class="catalogue-group">
        <h2>{{ group.chapters[0].label }}—{{ group.chapters.at(-1)!.label }}</h2>
        <div class="catalogue-links">
          <a v-for="chapter in group.chapters" :key="chapter.link" :href="withBase(chapter.link)">
            <span>{{ chapter.label }}</span>
            <strong>{{ chapter.title }}</strong>
            <ArrowRight :size="15" />
          </a>
        </div>
      </section>
    </div>
    <p v-else class="catalogue-empty">{{ t('contents.search.emptyShort') }}</p>
  </main>
</template>
