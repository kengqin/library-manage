<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, BookOpen, Search, X } from 'lucide-vue-next'
import { searchDesktopLibrary, type DesktopBookSearchResult, type DesktopSearchResult } from '../services/desktop-library'
import { formatChapterLabel } from '@novel-library/reader-core'
import PageHeader from '../components/ui/PageHeader.vue'
import { showGlobalError } from '../services/global-message'

const router = useRouter()
const query = ref('')
const bookResults = ref<DesktopBookSearchResult[]>([])
const results = ref<DesktopSearchResult[]>([])
const searching = ref(false)
const searched = ref(false)

function resultChapterLabel(result: DesktopSearchResult) {
  return formatChapterLabel({ number: result.chapterNumber, originalLabel: result.originalLabel })
}

function clearSearch() {
  query.value = ''
  bookResults.value = []
  results.value = []
  searched.value = false
}

async function search() {
  if (!query.value.trim()) return
  searching.value = true
  searched.value = true
  try {
    const response = await searchDesktopLibrary(query.value)
    bookResults.value = response.books
    results.value = response.chapters
  } catch (cause) {
    bookResults.value = []
    results.value = []
    searched.value = false
    showGlobalError(cause, t('search.failed'))
  } finally {
    searching.value = false
  }
}
</script>

<template>
  <section class="workspace-view search-view">
    <PageHeader :title="t('search.fullText')" />
    <div class="search-stage">
      <form class="search-control" role="search" @submit.prevent="search"><Search :size="19" /><input v-model="query" :aria-label="t('library.search')" :placeholder="t('search.placeholder.fullText')" /><button v-if="query" type="button" class="clear-search" :title="t('common.clear')" @click="clearSearch"><X :size="16" /></button><button type="submit" class="primary-command" :disabled="searching || !query.trim()">{{ searching ? t('common.searching') : t('nav.search') }}</button></form>
      <div v-if="searched && !bookResults.length && !results.length && !searching" class="search-empty" role="status">{{ t('contents.search.noMatch') }}</div>
      <div v-if="bookResults.length || results.length" class="search-output" aria-live="polite">
        <section v-if="bookResults.length" class="search-result-section">
          <header class="search-result-heading"><strong>{{ t('search.matchedNovels') }}</strong><span>{{ t('unit.books', { count: bookResults.length }) }}</span></header>
          <div class="search-book-results">
            <button v-for="book in bookResults" :key="book.bookId" type="button" @click="router.push(`/book/${book.bookId}`)">
              <span class="search-book-cover"><img v-if="book.coverDataUrl" :src="book.coverDataUrl" :alt="t('library.cover', { title: book.title })" /><BookOpen v-else :size="20" /></span>
              <div><strong>{{ book.title }}</strong><small>{{ book.author || t('library.field.unknownAuthor') }} · {{ t('unit.chapters', { count: book.chapterCount }) }}</small><p v-if="book.description">{{ book.description }}</p></div>
              <ArrowRight :size="17" />
            </button>
          </div>
        </section>
        <section v-if="results.length" class="search-result-section">
          <header class="search-result-heading"><strong>{{ t('contents.withText') }}</strong><span>{{ t('unit.items', { count: results.length }) }}</span></header>
          <div class="search-results"><button v-for="result in results" :key="`${result.bookId}:${result.chapterNumber}`" type="button" @click="router.push(`/read/${result.bookId}/${result.chapterNumber}`)"><div><small>{{ result.bookTitle }} · {{ result.kind === 'chapter' ? resultChapterLabel(result) : result.kind === 'volume' ? t('contents.volume') : result.kind === 'frontmatter' ? t('contents.frontMatterContent') : t('contents.extraContent') }}</small><strong>{{ result.chapterTitle }}</strong><p>{{ result.snippet }}</p></div><ArrowRight :size="17" /></button></div>
        </section>
      </div>
    </div>
  </section>
</template>
