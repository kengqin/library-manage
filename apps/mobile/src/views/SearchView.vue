<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Search } from 'lucide-vue-next'
import type { LibrarySearchResult } from '@novel-library/reader-core'
import { searchLibrary } from '../services/mobile-library'

const router = useRouter()
const query = ref('')
const results = ref<LibrarySearchResult[]>([])
const searching = ref(false)
const searched = ref(false)
const error = ref('')

async function search() {
  if (!query.value.trim()) return
  searching.value = true
  error.value = ''
  try { results.value = await searchLibrary(query.value); searched.value = true }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { searching.value = false }
}
</script>

<template>
  <section class="page search-page">
    <header class="page-header"><div><span class="eyebrow">LOCAL SEARCH</span><h1>{{ t('search.fullText') }}</h1></div></header>
    <form class="search-box" @submit.prevent="search"><Search :size="20" /><input v-model="query" type="search" :placeholder="t('search.hint.fullText')" /><button type="submit" :disabled="searching || !query.trim()">{{ searching ? t('common.searching') : t('nav.search') }}</button></form>
    <p v-if="error" class="error-card">{{ error }}</p>
    <div v-if="searched && !results.length" class="status-card">{{ t('contents.search.noMatch') }}</div>
    <div class="search-results"><button v-for="result in results" :key="`${result.bookId}:${result.chapterNumber}`" type="button" @click="router.push(`/read/${result.bookId}/${result.chapterNumber}`)"><span><small>{{ result.bookTitle }}</small><strong>{{ result.chapterTitle }}</strong><p>{{ result.snippet }}</p></span><ArrowRight :size="18" /></button></div>
  </section>
</template>
