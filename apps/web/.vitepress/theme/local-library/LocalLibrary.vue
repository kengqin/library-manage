<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, ArrowRight, BookOpen, Database, Download, FilePlus2, HardDrive, LibraryBig, Palette, RefreshCw, Search, Settings2, Trash2, Upload, X } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import ImportNovelModal from './ImportNovelModal.vue'
import LocalReader from './LocalReader.vue'
import ThemeEditor from './ThemeEditor.vue'
import { clearLibrary, deleteBook, exportLibrary, getAsset, getBook, getBooks, getChapter, getChapters, getLibraryStats, importLibraryBackup, updateBookProgress, updateBookTheme } from './db'
import { getThemePreset } from './themes'
import { calculateOverallProgress, formatChapterLabel, type LocalBook, type LocalChapter, type ThemeSettings } from './types'

const books = ref<LocalBook[]>([])
const selectedBook = ref<LocalBook>()
const chapters = ref<LocalChapter[]>([])
const selectedChapter = ref<LocalChapter>()
const coverUrls = ref<Record<string, string>>({})
const query = ref('')
const importOpen = ref(false)
const importExisting = ref<LocalBook>()
const themeOpen = ref(false)
const storageOpen = ref(false)
const storageStats = ref({ books: 0, chapters: 0, usage: 0, quota: 0 })
const toast = ref('')
const backupInput = ref<HTMLInputElement>()
let toastTimer: ReturnType<typeof setTimeout> | undefined

const filteredChapters = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return chapters.value
  return chapters.value.filter(chapter => String(chapter.number).includes(needle) || chapter.originalLabel.toLowerCase().includes(needle) || chapter.title.toLowerCase().includes(needle) || chapter.volume.toLowerCase().includes(needle))
})
const chapterGroups = computed(() => {
  const groups = new Map<string, LocalChapter[]>()
  for (const chapter of filteredChapters.value) {
    const key = chapter.volume || t('reader.text')
    const items = groups.get(key) ?? []
    items.push(chapter)
    groups.set(key, items)
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }))
})

function coverFor(book: LocalBook) { return coverUrls.value[book.id] || getThemePreset(book.theme.preset).image || '' }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

async function refreshBooks() {
  for (const url of Object.values(coverUrls.value)) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  books.value = await getBooks()
  const next: Record<string, string> = {}
  await Promise.all(books.value.map(async book => {
    const asset = await getAsset(book.id, 'cover')
    if (asset) next[book.id] = URL.createObjectURL(asset.blob)
  }))
  coverUrls.value = next
}

function setLocation(bookId?: string, chapter?: number, replace = false) {
  const url = new URL(window.location.href)
  bookId ? url.searchParams.set('book', bookId) : url.searchParams.delete('book')
  chapter ? url.searchParams.set('chapter', String(chapter)) : url.searchParams.delete('chapter')
  history[replace ? 'replaceState' : 'pushState']({}, '', url)
}

async function showShelf(push = true) {
  selectedBook.value = undefined
  selectedChapter.value = undefined
  chapters.value = []
  query.value = ''
  if (push) setLocation()
  window.scrollTo({ top: 0 })
}

async function openBook(id: string, push = true) {
  const book = await getBook(id)
  if (!book) return showShelf(push)
  selectedBook.value = book
  chapters.value = await getChapters(id)
  selectedChapter.value = undefined
  query.value = ''
  if (push) setLocation(id)
  window.scrollTo({ top: 0 })
}

async function openChapter(number: number, push = true) {
  if (!selectedBook.value) return
  const chapter = await getChapter(selectedBook.value.id, number)
  if (!chapter) return
  selectedChapter.value = chapter
  if (push) setLocation(selectedBook.value.id, number)
}

async function continueBook(book: LocalBook) {
  await openBook(book.id)
  await openChapter(book.currentChapter)
}

async function syncLocation() {
  const params = new URLSearchParams(window.location.search)
  const bookId = params.get('book')
  const chapter = Number(params.get('chapter'))
  const shouldImport = params.get('import') === '1'
  if (!bookId) {
    await showShelf(false)
    if (shouldImport) startImport()
    return
  }
  await openBook(bookId, false)
  if (chapter) await openChapter(chapter, false)
}

function startImport(existing?: LocalBook) {
  if (!existing) {
    const url = new URL(window.location.href)
    if (url.searchParams.get('import') === '1') {
      url.searchParams.delete('import')
      history.replaceState({}, '', url)
    }
  }
  importExisting.value = existing
  importOpen.value = true
}

async function imported(book: LocalBook) {
  await refreshBooks()
  await openBook(book.id)
  showToast(t('library.savedToShelf', { title: book.title }))
}

async function saveTheme(theme: ThemeSettings, cover?: Blob) {
  if (!selectedBook.value) return
  await updateBookTheme(selectedBook.value.id, theme, cover)
  themeOpen.value = false
  await refreshBooks()
  await openBook(selectedBook.value.id, false)
  showToast('主题配置已保存')
}

async function removeBook(book: LocalBook) {
  if (!window.confirm(t('library.delete.confirmWeb', { title: book.title }))) return
  await deleteBook(book.id)
  await refreshBooks()
  await showShelf()
  showToast('已删除本地书籍')
}

async function downloadBackup() {
  const payload = await exportLibrary()
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `小说书库备份-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  showToast('备份已导出')
}

async function restoreBackup(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await importLibraryBackup(JSON.parse(await file.text()))
    await refreshBooks()
    showToast('本地书架备份已恢复')
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('storage.backup.restoreFailedShort'))
  }
  ;(event.target as HTMLInputElement).value = ''
}

async function showStorage() {
  storageStats.value = await getLibraryStats()
  storageOpen.value = true
}

async function clearAll() {
  if (!window.confirm(t('library.clear.confirmWeb'))) return
  await clearLibrary()
  storageOpen.value = false
  await refreshBooks()
  await showShelf()
  showToast('本地书架已清空')
}

async function saveProgress(chapter: number, progress: number) {
  if (!selectedBook.value) return
  const overallProgress = calculateOverallProgress(chapter, progress, selectedBook.value.chapterCount)
  selectedBook.value = { ...selectedBook.value, currentChapter: chapter, progress: overallProgress }
  await updateBookProgress(selectedBook.value.id, chapter, progress)
}

onMounted(async () => {
  document.body.classList.add('is-eternal-home', 'is-local-library')
  window.addEventListener('popstate', syncLocation)
  await refreshBooks()
  await syncLocation()
})
onBeforeUnmount(() => {
  document.body.classList.remove('is-eternal-home', 'is-local-library')
  window.removeEventListener('popstate', syncLocation)
  for (const url of Object.values(coverUrls.value)) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <LocalReader v-if="selectedBook && selectedChapter" :book="selectedBook" :chapters="chapters" :chapter="selectedChapter" :cover-url="coverFor(selectedBook)" @back="openBook(selectedBook.id)" @open="openChapter" @progress="saveProgress" />
  <div v-else class="local-library">
    <header class="local-library-nav"><a :href="withBase('/')"><LibraryBig :size="21" /><strong>{{ t('app.name') }}</strong></a><nav><button type="button" @click="startImport()"><FilePlus2 :size="16" /> {{ t('import.txt.action') }}</button><button type="button" :title="t('storage.backup.export')" @click="downloadBackup"><Download :size="16" /></button><button type="button" :title="t('storage.backup.restore')" @click="backupInput?.click()"><Upload :size="16" /></button><button type="button" :title="t('storage.title')" @click="showStorage"><Settings2 :size="16" /></button><input ref="backupInput" type="file" accept="application/json,.json" hidden @change="restoreBackup" /></nav></header>

    <main v-if="!selectedBook" class="local-shelf"><section class="local-shelf-hero"><p>LOCAL · PRIVATE · OFFLINE</p><h1>{{ t('library.shelf.mineLocal') }}</h1><span>{{ t('import.txt.privacyMobile') }}</span><button type="button" @click="startImport()"><FilePlus2 :size="18" /> {{ t('library.empty.importFirstNovel') }}</button></section>
      <section v-if="books.length" class="local-book-grid"><article v-for="book in books" :key="book.id" class="local-book-card" :style="{ '--book-accent': book.theme.accent, '--book-bg': book.theme.background, '--book-text': book.theme.text }"><button type="button" class="local-book-cover" :style="{ backgroundColor: book.theme.background, backgroundImage: coverFor(book) ? `linear-gradient(rgba(0,0,0,${book.theme.overlay / 100}),rgba(0,0,0,${book.theme.overlay / 100})),url(${coverFor(book)})` : undefined, backgroundPosition: `${book.theme.positionX}% ${book.theme.positionY}%` }" @click="openBook(book.id)"><span>{{ t('library.books.local') }}</span><strong>{{ book.title }}</strong><small>{{ book.author }}</small></button><div><p>{{ book.chapterCount }} {{ t('unit.chaptersPrefix') }} {{ book.totalWords.toLocaleString() }} {{ t('unit.wordsShort') }}</p><div class="local-book-progress"><span :style="{ width: `${book.progress}%` }" /></div><footer><button type="button" @click="continueBook(book)"><BookOpen :size="15" /> {{ t('library.continueReading') }}</button><button type="button" :title="t('common.delete')" @click="removeBook(book)"><Trash2 :size="15" /></button></footer></div></article></section>
      <section v-else class="local-empty"><Database :size="32" /><h2>{{ t('library.shelf.emptyLocal') }}</h2><p>{{ t('import.txt.description') }}</p></section>
    </main>

    <main v-else class="local-book-detail"><section class="local-book-hero" :style="{ '--book-accent': selectedBook.theme.accent, '--book-bg': selectedBook.theme.background, '--book-text': selectedBook.theme.text, backgroundColor: selectedBook.theme.background, backgroundImage: coverFor(selectedBook) ? `linear-gradient(rgba(0,0,0,${selectedBook.theme.overlay / 100}),rgba(0,0,0,${selectedBook.theme.overlay / 100})),url(${coverFor(selectedBook)})` : undefined, backgroundPosition: `${selectedBook.theme.positionX}% ${selectedBook.theme.positionY}%` }"><button type="button" class="local-back" @click="showShelf()"><ArrowLeft :size="16" /> {{ t('nav.localShelf') }}</button><div><p>LOCAL BOOK · {{ selectedBook.chapterCount }} CHAPTERS</p><h1>{{ selectedBook.title }}</h1><span>{{ selectedBook.author }}</span><blockquote>{{ selectedBook.description || t('library.synopsis.emptyDetail') }}</blockquote><div><button type="button" class="local-button-primary" @click="openChapter(selectedBook.currentChapter)"><BookOpen :size="17" /> {{ selectedBook.progress ? t('library.continueReading') : t('library.startReading') }}</button><button type="button" @click="themeOpen = true"><Palette :size="17" /> {{ t('reader.theme.settings') }}</button><button type="button" @click="startImport(selectedBook)"><RefreshCw :size="17" /> {{ t('parse.retry') }}</button><button type="button" @click="removeBook(selectedBook)"><Trash2 :size="17" /> {{ t('common.delete') }}</button></div></div></section>
      <section class="local-catalogue"><header><div><p>TABLE OF CONTENTS</p><h2>{{ t('contents.chapterList') }}</h2></div><label><Search :size="17" /><input v-model="query" :placeholder="t('contents.search.placeholderShort')" /><button v-if="query" type="button" @click="query = ''"><X :size="15" /></button></label></header><div v-if="chapterGroups.length" class="local-volume-list"><section v-for="group in chapterGroups" :key="group.name"><h3>{{ group.name }} <span>{{ group.items.length }} {{ t('unit.chaptersShort') }}</span></h3><div><button v-for="chapter in group.items" :key="chapter.id" type="button" @click="openChapter(chapter.number)"><small>{{ formatChapterLabel(chapter) }}</small><span>{{ chapter.title }}</span><ArrowRight :size="14" /></button></div></section></div><p v-else class="local-no-result">{{ t('contents.search.emptyShort') }}</p></section>
    </main>
  </div>

  <ImportNovelModal :open="importOpen" :existing-book="importExisting" @close="importOpen = false" @imported="imported" />
  <ThemeEditor :open="themeOpen" :book="selectedBook" :cover-url="selectedBook ? coverFor(selectedBook) : undefined" @close="themeOpen = false" @save="saveTheme" />
  <Teleport to="body"><div v-if="storageOpen" class="local-modal-backdrop" @mousedown.self="storageOpen = false"><section class="local-modal storage-modal"><header><div><small>LOCAL STORAGE</small><h2>{{ t('storage.local.title') }}</h2></div><button type="button" @click="storageOpen = false"><X :size="19" /></button></header><div class="storage-stats"><span><LibraryBig :size="20" /><b>{{ storageStats.books }}</b> {{ t('unit.bookPlural') }}</span><span><FilePlus2 :size="20" /><b>{{ storageStats.chapters }}</b> {{ t('unit.chaptersShort') }}</span><span><HardDrive :size="20" /><b>{{ formatSize(storageStats.usage) }}</b> {{ t('storage.usage.used') }}</span></div><p>{{ t('storage.usage.quota') }} {{ formatSize(storageStats.quota) }}{{ t('library.web.clearHint') }}</p><footer><button type="button" class="local-button-secondary" @click="downloadBackup"><Download :size="16" /> {{ t('storage.backup.export') }}</button><button type="button" class="local-danger-button" @click="clearAll"><Trash2 :size="16" /> {{ t('library.clear.shelf') }}</button></footer></section></div></Teleport>
  <Transition name="local-toast"><div v-if="toast" class="local-toast">{{ toast }}</div></Transition>
</template>
