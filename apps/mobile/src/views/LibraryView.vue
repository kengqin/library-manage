<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, FilePlus2, RefreshCw } from 'lucide-vue-next'
import { defaultParseOptions, type LocalBook } from '@novel-library/reader-core'
import { getBooks, saveMobileBook } from '../services/mobile-library'
import { parseMobileBook } from '../services/file-parser'

const router = useRouter()
const books = ref<LocalBook[]>([])
const loading = ref(true)
const importing = ref(false)
const importProgress = ref(0)
const importMessage = ref('')
const error = ref('')
const fileInput = ref<HTMLInputElement>()

async function load() {
  loading.value = true
  error.value = ''
  try { books.value = await getBooks() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { loading.value = false }
}

async function importSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importing.value = true
  importProgress.value = 0
  error.value = ''
  try {
    if (!/\.(txt|text|epub)$/iu.test(file.name)) throw new Error(t('import.unsupported'))
    const result = await parseMobileBook(file, { ...defaultParseOptions }, (progress, message) => {
      importProgress.value = progress
      importMessage.value = message
    })
    importMessage.value = t('library.savingToShelf')
    const book = await saveMobileBook(result)
    await load()
    await router.push(`/book/${book.id}`)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    importing.value = false
    input.value = ''
  }
}

onMounted(load)
onActivated(load)
</script>

<template>
  <section class="page library-page">
    <header class="page-header">
      <div><span class="eyebrow">NOVEL LIBRARY</span><h1>{{ t('library.shelf.mine') }}</h1></div>
      <div class="header-actions">
        <button class="icon-button" type="button" :title="t('common.refresh')" :disabled="loading" @click="load"><RefreshCw :size="19" :class="{ spinning: loading }" /></button>
        <button class="primary-icon" type="button" :title="t('library.import.action')" :disabled="importing" @click="fileInput?.click()"><FilePlus2 :size="20" /></button>
        <input ref="fileInput" hidden type="file" accept=".txt,.text,.epub,text/plain,application/epub+zip" @change="importSelected" />
      </div>
    </header>

    <div v-if="importing" class="progress-card" role="status"><div><span :style="{ width: `${importProgress}%` }" /></div><strong>{{ importMessage }}</strong><small>{{ importProgress }}%</small></div>
    <p v-if="error" class="error-card" role="alert">{{ error }}</p>
    <div v-if="loading && !books.length" class="status-card">{{ t('library.shelf.loadingUnicode') }}</div>
    <div v-else-if="!books.length" class="empty-state"><BookOpen :size="44" stroke-width="1.35" /><h2>{{ t('library.shelf.empty') }}</h2><p>{{ t('mobile.import.description') }}</p><button class="primary-button" type="button" @click="fileInput?.click()"><FilePlus2 :size="18" />{{ t('library.empty.importFirst') }}</button></div>
    <div v-else class="mobile-book-grid">
      <article v-for="book in books" :key="book.id" class="mobile-book-card" @click="router.push(`/book/${book.id}`)">
        <div class="book-cover"><img v-if="book.coverDataUrl" :src="book.coverDataUrl" alt="" /><span v-else>{{ book.title.slice(0, 1) }}</span><i :style="{ width: `${book.progress}%` }" /></div>
        <div><h2>{{ book.title }}</h2><p>{{ book.author || t('library.field.anonymous') }}</p><small>{{ t('stats.chaptersProgress', { chapters: book.chapterCount, progress: book.progress.toFixed(0) }) }}</small></div>
      </article>
    </div>
  </section>
</template>
