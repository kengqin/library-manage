<script setup lang="ts">
import { listSeparator, t } from '@novel-library/i18n/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, FilePlus2, FileText, Globe, RefreshCw } from 'lucide-vue-next'
import { defaultParseOptions, defaultTheme } from '@novel-library/reader-core'
import { deleteDesktopBook, getCachedDesktopBooks, listDesktopBooks, readDesktopExternalFile, saveDesktopBook, type DesktopBookSummary } from '../services/desktop-library'
import BookCard from '../components/library/BookCard.vue'
import PageHeader from '../components/ui/PageHeader.vue'
import UiConfirmDialog from '../components/ui/UiConfirmDialog.vue'
import { parseNovelFile } from '../services/parse-novel-file'
import { parseEpubFile } from '../services/parse-epub-file'
import { showGlobalError, showGlobalMessage } from '../services/global-message'

const router = useRouter()
const cachedBooks = getCachedDesktopBooks()
const books = ref<DesktopBookSummary[]>(cachedBooks || [])
const loading = ref(cachedBooks === undefined)
const refreshing = ref(false)
const importing = ref(false)
const importProgress = ref(0)
const importMessage = ref('')
const fileInput = ref<HTMLInputElement>()
const importDialogOpen = ref(false)
const pendingImportFiles = ref<File[]>([])
const pendingDeleteBook = ref<DesktopBookSummary>()
const deleting = ref(false)

function showError(cause: unknown, fallback: string) {
  showGlobalError(cause, fallback)
}

async function loadBooks() {
  const hasVisibleBooks = books.value.length > 0
  loading.value = !hasVisibleBooks
  refreshing.value = hasVisibleBooks
  try {
    books.value = await listDesktopBooks({ forceRefresh: true })
  } catch (cause) {
    showError(cause, t('library.shelf.loadFailed'))
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function openImportDialog() {
  if (importing.value) return
  pendingImportFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
  importDialogOpen.value = true
}

function closeImportDialog() {
  importDialogOpen.value = false
  pendingImportFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
}

function chooseImportFile() {
  if (fileInput.value) fileInput.value.value = ''
  fileInput.value?.click()
}

function selectImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  pendingImportFiles.value = files
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function confirmImport() {
  const files = [...pendingImportFiles.value]
  if (!files.length) return
  importDialogOpen.value = false
  pendingImportFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
  void importBooks(files)
}

function importSelectionTitle() {
  if (!pendingImportFiles.value.length) return t('common.noFileSelected')
  if (pendingImportFiles.value.length === 1) return pendingImportFiles.value[0].name
  return t('common.filesSelected', { count: pendingImportFiles.value.length })
}

function importSelectionDetail() {
  const files = pendingImportFiles.value
  if (!files.length) return t('import.supportedFormats')
  const epubCount = files.filter(file => file.name.toLowerCase().endsWith('.epub')).length
  const txtCount = files.length - epubCount
  const formats = [
    txtCount ? `TXT ${txtCount}` : '',
    epubCount ? `EPUB ${epubCount}` : ''
  ].filter(Boolean).join(' · ')
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  return `${formatFileSize(totalBytes)} · ${formats}`
}

async function parseAndSaveBook(file: File, existingId: string | undefined, onProgress: (progress: number, message: string) => void) {
  const options = { ...defaultParseOptions }
  const parse = file.name.toLowerCase().endsWith('.epub')
    ? (selectedFile: File) => parseEpubFile(selectedFile, onProgress)
    : (selectedFile: File) => parseNovelFile(selectedFile, options, onProgress)
  const result = await parse(file)
  return saveDesktopBook({ result, options, theme: { ...defaultTheme }, existingId })
}

async function importBooks(files: File[], existingId?: string) {
  if (!files.length) return
  importing.value = true
  importProgress.value = 0
  importMessage.value = t('common.readingFile')
  const importedIds: string[] = []
  const failures: File[] = []
  try {
    for (const [index, file] of files.entries()) {
      const prefix = files.length > 1 ? `${index + 1}/${files.length} · ${file.name} · ` : ''
      try {
        const book = await parseAndSaveBook(
          file,
          files.length === 1 ? existingId : undefined,
          (progress, message) => {
            importProgress.value = Math.round((index + progress / 100) / files.length * 100)
            importMessage.value = `${prefix}${message}`
          }
        )
        importedIds.push(book.id)
      } catch {
        failures.push(file)
      }
      importProgress.value = Math.round((index + 1) / files.length * 100)
    }
    importMessage.value = t('library.shelf.refreshing')
    await loadBooks()
    if (failures.length) {
      const failedNames = failures.slice(0, 2).map(file => file.name).join(listSeparator())
      const remaining = failures.length > 2 ? t('import.multiFiles', { names: failedNames, count: failures.length }) : failedNames
      const summary = importedIds.length ? t('library.import.donePartial', { imported: importedIds.length, total: files.length }) : t('library.import.failed')
      showGlobalMessage(t('import.summary', { summary, files: remaining }), 'warning', 6000)
    } else if (files.length === 1 && importedIds[0]) {
      showGlobalMessage(existingId ? t('library.import.reimported') : t('library.import.added'))
      await router.push(`/book/${importedIds[0]}`)
    } else {
      showGlobalMessage(t('library.import.doneCount', { count: importedIds.length }))
    }
  } finally {
    importing.value = false
  }
}

async function importExternalFile(event: Event) {
  const detail = (event as CustomEvent<{ path: string; existingId?: string }>).detail
  if (!detail?.path) return
  closeImportDialog()
  try {
    const external = await readDesktopExternalFile(detail.path)
    await importBooks([new File([new Uint8Array(external.bytes)], external.name)], detail.existingId)
  } catch (cause) {
    showError(cause, t('library.import.failedDetail'))
  }
}

async function removeBook() {
  const book = pendingDeleteBook.value
  if (!book) return
  deleting.value = true
  try {
    await deleteDesktopBook(book.id)
    books.value = books.value.filter(item => item.id !== book.id)
    pendingDeleteBook.value = undefined
    showGlobalMessage(t('library.deleted', { title: book.title }))
  } catch (cause) {
    showError(cause, t('library.delete.failed'))
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void loadBooks()
  window.addEventListener('novel-library-import', importExternalFile)
})
onBeforeUnmount(() => window.removeEventListener('novel-library-import', importExternalFile))
</script>

<template>
  <section class="workspace-view">
    <PageHeader :title="t('library.shelf.mine')">
      <template #actions>
        <button type="button" class="secondary-command" @click="router.push('/online')"><Globe :size="17" />{{ t('online.find') }}</button>
        <button type="button" class="icon-button" :title="t('library.shelf.refresh')" :disabled="loading || refreshing" @click="loadBooks"><RefreshCw :size="18" :class="{ spinning: refreshing }" /></button>
        <button type="button" class="primary-command primary-command--core" :disabled="importing" @click="openImportDialog"><FilePlus2 :size="18" />{{ importing ? t('common.importing') : t('library.import.action') }}</button>
        <input ref="fileInput" type="file" accept=".txt,.epub,text/plain,application/epub+zip" multiple hidden @change="selectImportFile" />
      </template>
    </PageHeader>

    <div v-if="importing" class="import-status" role="status"><div><span :style="{ width: `${importProgress}%` }" /></div><strong>{{ importMessage }}</strong><small>{{ importProgress }}%</small></div>
    <div v-if="loading" class="view-status" role="status">{{ t('library.shelf.loading') }}</div>
    <div v-else-if="!books.length && !importing" class="empty-library">
      <BookOpen :size="34" />
      <h2>{{ t('library.shelf.emptyShort') }}</h2>
      <button type="button" class="primary-command primary-command--core" @click="openImportDialog"><FilePlus2 :size="17" />{{ t('library.empty.importFirst') }}</button>
    </div>
    <div v-else class="book-grid">
      <BookCard v-for="book in books" :key="book.id" :book="book" @open="router.push(`/book/${book.id}`)" @read="router.push(`/read/${book.id}/${book.currentChapter}`)" @privacy="router.push({ path: `/read/${book.id}/${book.currentChapter}`, query: { privacy: '1' } })" @request-delete="pendingDeleteBook = book" />
    </div>
    <UiConfirmDialog
      :open="importDialogOpen"
      :title="t('library.import.action')"
      :description="t('import.selectFiles')"
      :confirm-label="pendingImportFiles.length > 1 ? `确认导入（${pendingImportFiles.length}）` : t('import.confirm')"
      :cancel-label="t('common.cancel')"
      :confirm-disabled="!pendingImportFiles.length"
      @close="closeImportDialog"
      @confirm="confirmImport"
    >
      <div class="book-import-file" :class="{ selected: pendingImportFiles.length }">
        <span class="book-import-file-icon"><FileText :size="22" /></span>
        <div>
          <strong :title="pendingImportFiles.map(file => file.name).join('\n')">{{ importSelectionTitle() }}</strong>
          <small>{{ importSelectionDetail() }}</small>
        </div>
        <button type="button" class="secondary-command" @click="chooseImportFile">{{ pendingImportFiles.length ? t('common.chooseAgain') : t('common.chooseFile') }}</button>
      </div>
    </UiConfirmDialog>
    <UiConfirmDialog
      :open="Boolean(pendingDeleteBook)"
      :busy="deleting"
      danger
      :title="t('library.delete.confirmTitle')"
      :description="t('library.delete.confirmDetail', { title: pendingDeleteBook?.title || '' })"
      :confirm-label="t('library.delete.action')"
      @close="pendingDeleteBook = undefined"
      @confirm="removeBook"
    />
  </section>
</template>
