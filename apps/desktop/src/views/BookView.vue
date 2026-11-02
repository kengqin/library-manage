<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, BookOpen, ChevronRight, EyeOff, RefreshCw, Trash2 } from 'lucide-vue-next'
import { formatChapterLabel, isNumberedChapter } from '@novel-library/reader-core'
import { deleteDesktopBook, getDesktopBook, listDesktopChapters, type DesktopBook, type DesktopChapterSummary } from '../services/desktop-library'
import { sanitizeReaderHtml } from '../services/sanitize-reader-html'
import UiConfirmDialog from '../components/ui/UiConfirmDialog.vue'
import { showGlobalError, showGlobalMessage } from '../services/global-message'
import { checkOnlineUpdates, downloadOnlineBook, onlineBooks, refreshOnlineBooks } from '../services/online-library'

const route = useRoute()
const router = useRouter()
const book = ref<DesktopBook>()
const chapters = ref<DesktopChapterSummary[]>([])
const loading = ref(true)
const deleteDialogOpen = ref(false)
const deleting = ref(false)
const checkingBooks = ref(new Set<string>())
const bookId = computed(() => String(route.params.bookId || ''))
const checkingUpdates = computed(() => checkingBooks.value.has(bookId.value))
const downloading = computed(() => onlineBooks.value.some(item => item.bookId === bookId.value && item.state === 'downloading'))
const safeDescription = computed(() => sanitizeReaderHtml(book.value?.description || '', { preserveStyles: true }))
const chapterGroups = computed(() => {
  const groups = new Map<string, DesktopChapterSummary[]>()
  for (const chapter of chapters.value) {
    const name = chapter.volume || t('reader.text')
    const items = groups.get(name) ?? []
    items.push(chapter)
    groups.set(name, items)
  }
  return [...groups.entries()].map(([name, items]) => ({
    name,
    items,
    chapterCount: items.filter(isNumberedChapter).length,
    extraCount: items.filter(chapter => !isNumberedChapter(chapter)).length
  }))
})
const numberedChapterCount = computed(() => chapters.value.filter(isNumberedChapter).length)
const currentChapterTitle = computed(() => {
  const current = chapters.value.find(chapter => chapter.number === book.value?.currentChapter)
  return current?.title || (book.value ? t('contents.chapterN', { number: book.value.currentChapter }) : '')
})

function chapterMetaLabel(chapter: DesktopChapterSummary) {
  if (book.value?.sourceFormat === 'web') return ''
  if (chapter.kind === 'chapter') {
    const label = formatChapterLabel(chapter)
    if (label !== chapter.title) return label
    const originalLabel = chapter.originalLabel.trim()
    if (/^(?:番外|楔子|序章|尾声)/u.test(originalLabel)) return originalLabel
    return ''
  }
  return chapter.kind === 'volume' ? t('contents.volume') : chapter.kind === 'frontmatter' ? t('contents.frontMatter') : t('contents.extra')
}

async function refreshBook(id = bookId.value) {
  const [nextBook, nextChapters] = await Promise.all([getDesktopBook(id), listDesktopChapters(id)])
  if (!nextBook) throw new Error(t('library.error.notFound'))
  if (bookId.value !== id) return
  book.value = nextBook
  chapters.value = nextChapters
}

async function load(id = bookId.value) {
  loading.value = true
  try {
    await refreshBook(id)
  } catch (cause) {
    if (bookId.value === id) showGlobalError(cause, t('library.error.loadFailed'))
  } finally {
    if (bookId.value === id) loading.value = false
  }
}

async function checkUpdates() {
  if (!book.value || book.value.sourceFormat !== 'web' || checkingUpdates.value || deleting.value || downloading.value) return
  const id = book.value.id
  checkingBooks.value.add(id)
  try {
    if (!onlineBooks.value.some(item => item.bookId === id)) await refreshOnlineBooks()
    const count = await checkOnlineUpdates(id)
    if (count) void downloadOnlineBook(id)
    await refreshBook(id)
    if (bookId.value === id) showGlobalMessage(count ? `新增 ${count} 章，已开始下载` : t('online.contents.upToDate'))
  } catch (cause) {
    if (bookId.value === id && !(cause instanceof DOMException && cause.name === 'AbortError')) showGlobalError(cause, t('update.checkFailed'))
  } finally {
    checkingBooks.value.delete(id)
  }
}

async function removeBook() {
  if (!book.value) return
  const title = book.value.title
  deleting.value = true
  try {
    await deleteDesktopBook(book.value.id)
    deleteDialogOpen.value = false
    await router.push('/library')
    showGlobalMessage(t('library.deleted', { title }))
  } catch (cause) {
    showGlobalError(cause, t('library.delete.failed'))
  } finally {
    deleting.value = false
  }
}

watch(bookId, id => { if (id) void load(id) }, { immediate: true })
</script>

<template>
  <section class="workspace-view book-detail-view">
    <button type="button" class="text-command" @click="router.push('/library')"><ArrowLeft :size="16" />{{ t('library.shelf.back') }}</button>
    <div v-if="loading" class="view-status" role="status">{{ t('library.loading') }}</div>
    <template v-else-if="book">
      <header class="book-detail-header" :style="{ '--book-accent': book.theme.accent }">
        <div class="book-detail-seal" :class="{ 'book-detail-seal--image': book.coverDataUrl }"><img v-if="book.coverDataUrl" :src="book.coverDataUrl" alt="" /><template v-else>{{ book.title.slice(0, 1) }}</template></div>
        <div class="book-detail-copy"><h1>{{ book.title }}</h1><span>{{ book.author || t('library.field.anonymous') }}</span><blockquote v-if="book.description" v-html="safeDescription" /><blockquote v-else>{{ t('library.synopsis.empty') }}</blockquote></div>
        <aside class="book-detail-side">
          <div class="book-detail-stats"><button v-if="book.sourceFormat === 'web'" type="button" class="text-command" @click="router.push({ path: '/online', query: { book: book.id } })">{{ t('online.downloadsTitle') }}</button><span v-else>{{ book.sourceFormat.toUpperCase() }}</span><span>{{ numberedChapterCount }} {{ t('unit.chaptersShort') }}</span><span>{{ book.totalWords.toLocaleString() }} {{ t('unit.wordsShort') }}</span></div>
          <div class="book-action-panel">
            <dl><div><dt>{{ t('library.progress') }}</dt><dd>{{ book.progress.toFixed(0) }}%</dd></div><div><dt>{{ t('reader.currentChapter') }}</dt><dd :title="currentChapterTitle">{{ currentChapterTitle }}</dd></div></dl>
            <div class="book-action-buttons" :class="{ 'book-action-buttons--online': book.sourceFormat === 'web' }">
              <button type="button" class="primary-command" @click="router.push(`/read/${book.id}/${book.currentChapter}`)"><BookOpen :size="17" />{{ book.progress ? t('library.continueReading') : t('library.startReading') }}</button>
              <button v-if="book.sourceFormat === 'web'" type="button" class="book-update-button" :disabled="checkingUpdates || deleting || downloading" :aria-busy="checkingUpdates" :title="downloading ? t('online.contents.waitDownload') : undefined" @click="checkUpdates"><RefreshCw :size="15" :class="{ spinning: checkingUpdates }" />{{ checkingUpdates ? t('common.checking') : t('update.check') }}</button>
              <button type="button" class="book-privacy-button" @click="router.push({ path: `/read/${book.id}/${book.currentChapter}`, query: { privacy: '1' } })"><EyeOff :size="15" />{{ t('app.privacyMode') }}</button>
              <button type="button" class="book-delete-button" @click="deleteDialogOpen = true"><Trash2 :size="15" />{{ t('library.delete.action') }}</button>
            </div>
          </div>
        </aside>
      </header>

      <section class="chapter-catalogue">
        <header><h2>{{ t('contents.chapterList') }}</h2></header>
        <section v-for="group in chapterGroups" :key="group.name" class="chapter-group"><h3>{{ group.name }} <span v-if="group.chapterCount">{{ group.chapterCount }} {{ t('unit.chaptersShort') }}</span><span v-if="group.extraCount">{{ group.chapterCount ? ' · ' : '' }}{{ group.extraCount }} {{ t('unit.itemsShort') }}</span></h3><div><button v-for="chapter in group.items" :key="chapter.id" type="button" :class="{ 'chapter-entry--plain': !chapterMetaLabel(chapter) }" @click="router.push(`/read/${book.id}/${chapter.number}`)"><small v-if="chapterMetaLabel(chapter)">{{ chapterMetaLabel(chapter) }}</small><span>{{ chapter.title }}</span><ChevronRight :size="15" /></button></div></section>
      </section>
    </template>
    <UiConfirmDialog :open="deleteDialogOpen" :busy="deleting" danger :title="t('library.delete.confirmTitle')" :description="`《${book?.title || ''}》及其全部章节、阅读进度将从本机删除，此操作无法撤销。`" :confirm-label="t('library.delete.action')" @close="deleteDialogOpen = false" @confirm="removeBook" />
  </section>
</template>
