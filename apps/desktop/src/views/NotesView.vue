<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { onBeforeRouteLeave } from 'vue-router'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TurndownService from 'turndown'
import {
  Bold,
  Braces,
  ChevronDown,
  Code2,
  Copy,
  Download,
  FileJson,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Import,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Quote,
  Redo2,
  Search,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Unlink,
  X
} from 'lucide-vue-next'
import {
  createNote,
  deleteNote,
  duplicateNote,
  exportNotes,
  getNote,
  importNotes,
  listNotes,
  saveNote,
  setNotePinned,
  writeNoteExport,
  type NoteRecord,
  type NoteSummary
} from '../services/notes'
import UiConfirmDialog from '../components/ui/UiConfirmDialog.vue'
import { showGlobalError, showGlobalMessage } from '../services/global-message'

type ExportFormat = 'markdown' | 'html' | 'json'

const notes = ref<NoteSummary[]>([])
const selectedNote = ref<NoteRecord | null>(null)
const title = ref('')
const contentText = ref('')
const query = ref('')
const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)
const saveStatus = ref('')
const deleteDialogOpen = ref(false)
const exportMenuOpen = ref(false)
let hydrating = false
let saveTimer = 0
let searchTimer = 0
let activeSave: Promise<boolean> | null = null

onBeforeRouteLeave(async () => {
  await persistCurrentNote()
  return !dirty.value
})

// Capture pending content before useEditor registers its editor teardown hook.
onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  window.clearTimeout(searchTimer)
  void persistCurrentNote()
})

const editor = useEditor({
  content: '<p></p>',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }
    }),
    Placeholder.configure({ placeholder: t('notes.editor.placeholder') })
  ],
  editorProps: {
    attributes: {
      class: 'note-prose-editor',
      spellcheck: 'true'
    }
  },
  onUpdate: ({ editor: currentEditor }) => {
    contentText.value = currentEditor.getText({ blockSeparator: '\n' })
    scheduleSave()
  }
})

const wordCount = computed(() => contentText.value.replace(/\s/g, '').length)

function showError(cause: unknown, fallback: string) {
  showGlobalError(cause, fallback)
}

async function loadNotes() {
  try {
    notes.value = await listNotes(query.value)
  } catch (cause) {
    showError(cause, t('notes.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function selectNote(noteId: string) {
  if (selectedNote.value?.id === noteId) return
  await persistCurrentNote()
  try {
    const note = await getNote(noteId)
    if (!note) throw new Error(t('notes.notFound'))
    hydrating = true
    selectedNote.value = note
    title.value = note.title
    contentText.value = note.contentText
    editor.value?.commands.setContent(note.contentHtml || '<p></p>', { emitUpdate: false })
    dirty.value = false
    saveStatus.value = t('common.saved')
    await nextTick()
    hydrating = false
  } catch (cause) {
    hydrating = false
    showError(cause, t('notes.openFailed'))
  }
}

function scheduleSave() {
  if (hydrating || !selectedNote.value) return
  dirty.value = true
  saveStatus.value = t('common.unsaved')
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void persistCurrentNote()
  }, 700)
}

async function persistCurrentNote() {
  window.clearTimeout(saveTimer)
  if (activeSave) {
    const previousSucceeded = await activeSave
    if (previousSucceeded && dirty.value) await persistCurrentNote()
    return
  }
  if (!dirty.value || !selectedNote.value || !editor.value) return
  const noteId = selectedNote.value.id
  const snapshotTitle = title.value
  const snapshotHtml = editor.value.getHTML()
  const snapshotText = editor.value.getText({ blockSeparator: '\n' })
  const snapshotPinned = selectedNote.value.isPinned
  dirty.value = false
  saving.value = true
  saveStatus.value = t('common.saving')
  activeSave = (async () => {
    try {
      const saved = await saveNote({
        id: noteId,
        title: snapshotTitle,
        contentHtml: snapshotHtml,
        contentText: snapshotText,
        isPinned: snapshotPinned
      })
      if (selectedNote.value?.id === noteId && !dirty.value) {
        selectedNote.value = saved
        hydrating = true
        title.value = saved.title
        hydrating = false
        saveStatus.value = t('common.saved')
      }
      await loadNotes()
      return true
    } catch (cause) {
      dirty.value = true
      saveStatus.value = t('common.saveFailed')
      showError(cause, t('notes.saveFailed'))
      return false
    } finally {
      saving.value = false
    }
  })()
  const succeeded = await activeSave
  activeSave = null
  if (succeeded && dirty.value && selectedNote.value?.id === noteId) await persistCurrentNote()
}

async function addNote() {
  await persistCurrentNote()
  try {
    const note = await createNote()
    await loadNotes()
    await selectNote(note.id)
    await nextTick()
    document.querySelector<HTMLInputElement>('.note-title-input')?.select()
  } catch (cause) {
    showError(cause, t('notes.createFailed'))
  }
}

async function removeCurrentNote() {
  const note = selectedNote.value
  if (!note) return
  deleteDialogOpen.value = false
  window.clearTimeout(saveTimer)
  dirty.value = false
  try {
    await deleteNote(note.id)
    selectedNote.value = null
    title.value = ''
    contentText.value = ''
    editor.value?.commands.clearContent(false)
    await loadNotes()
    if (notes.value[0]) await selectNote(notes.value[0].id)
    showGlobalMessage(t('notes.deleted'))
  } catch (cause) {
    showError(cause, t('notes.deleteFailed'))
  }
}

async function copyCurrentNote() {
  if (!selectedNote.value) return
  await persistCurrentNote()
  try {
    const copy = await duplicateNote(selectedNote.value.id)
    await loadNotes()
    await selectNote(copy.id)
    showGlobalMessage(t('notes.copied'))
  } catch (cause) {
    showError(cause, t('notes.copyFailed'))
  }
}

async function togglePinned() {
  if (!selectedNote.value) return
  const next = !selectedNote.value.isPinned
  try {
    await setNotePinned(selectedNote.value.id, next)
    selectedNote.value = { ...selectedNote.value, isPinned: next }
    await loadNotes()
    showGlobalMessage(next ? t('notes.pinned') : t('library.pin.cancelled'))
  } catch (cause) {
    showError(cause, t('notes.pinFailed'))
  }
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim() || t('notes.untitled')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character] || character)
}

function exportContent(note: NoteRecord, format: ExportFormat) {
  if (format === 'json') return JSON.stringify(note, null, 2)
  if (format === 'html') {
    return `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(note.title)}</title>\n<style>body{max-width:760px;margin:48px auto;padding:0 24px;color:#24302d;font:16px/1.8 system-ui,sans-serif}h1,h2,h3{line-height:1.35}blockquote{margin-left:0;padding-left:16px;border-left:3px solid #8aa39a;color:#52605a}pre{padding:16px;overflow:auto;background:#f2f4f1}</style>\n</head>\n<body>\n<h1>${escapeHtml(note.title)}</h1>\n${note.contentHtml}\n</body>\n</html>\n`
  }
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
  return `# ${note.title}\n\n${turndown.turndown(note.contentHtml)}\n`
}

async function exportCurrentNote(format: ExportFormat) {
  if (!selectedNote.value) return
  exportMenuOpen.value = false
  await persistCurrentNote()
  const note = await getNote(selectedNote.value.id)
  if (!note) return
  const extension = format === 'markdown' ? 'md' : format
  const targetPath = await save({
    title: t('library.export.format', { format: format === 'markdown' ? 'Markdown' : format.toUpperCase() }),
    defaultPath: `${safeFileName(note.title)}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  })
  if (!targetPath) return
  try {
    await writeNoteExport(targetPath, exportContent(note, format))
    showGlobalMessage(t('notes.exported'))
  } catch (cause) {
    showError(cause, t('notes.exportFailed'))
  }
}

async function exportAllNotes() {
  await persistCurrentNote()
  const targetPath = await save({
    title: t('notes.exportAll'),
    defaultPath: `NovelLibrary-notes-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!targetPath) return
  try {
    const result = await exportNotes(targetPath)
    showGlobalMessage(t('notes.exportedCount', { count: result.notes }))
  } catch (cause) {
    showError(cause, t('notes.exportFailed'))
  }
}

async function importAllNotes() {
  const sourcePath = await open({
    title: t('notes.import'),
    multiple: false,
    directory: false,
    filters: [{ name: t('notes.exportTitle'), extensions: ['json'] }]
  })
  if (!sourcePath || Array.isArray(sourcePath)) return
  try {
    const result = await importNotes(sourcePath)
    await loadNotes()
    if (!selectedNote.value && notes.value[0]) await selectNote(notes.value[0].id)
    showGlobalMessage(t('notes.importedCount', { count: result.notes }))
  } catch (cause) {
    showError(cause, t('notes.importFailed'))
  }
}

function editLink() {
  if (!editor.value) return
  const current = editor.value.getAttributes('link').href as string | undefined
  const href = window.prompt('输入链接地址', current || 'https://')
  if (href === null) return
  if (!href.trim()) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

watch(title, scheduleSave)
watch(query, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void loadNotes(), 240)
})

onMounted(async () => {
  await loadNotes()
  if (notes.value[0]) await selectNote(notes.value[0].id)
})

</script>

<template>
  <section class="notes-workspace">
    <section class="note-index" :aria-label="t('notes.title')">
      <header>
        <div class="note-index-heading"><strong>{{ t('nav.notes') }}</strong><span>{{ notes.length }}</span></div>
        <div class="note-index-actions">
          <button type="button" class="icon-button" :title="t('notes.importJson')" @click="importAllNotes"><Import :size="15" /></button>
          <button type="button" class="icon-button" :title="t('notes.exportAllJson')" @click="exportAllNotes"><FileJson :size="15" /></button>
          <button type="button" class="icon-button primary-icon" :title="t('notes.create')" @click="addNote"><Plus :size="17" /></button>
        </div>
      </header>
      <label class="note-search"><Search :size="15" /><input v-model="query" :placeholder="t('notes.search')" /><button v-if="query" type="button" :title="t('search.clear')" @click="query = ''"><X :size="14" /></button></label>
      <div v-if="loading" class="note-list-status">{{ t('common.loading') }}</div>
      <div v-else-if="!notes.length" class="note-list-status">{{ t('notes.empty') }}</div>
      <div v-else class="note-list">
        <button v-for="note in notes" :key="note.id" type="button" :class="{ active: selectedNote?.id === note.id }" @click="selectNote(note.id)">
          <span><strong>{{ note.title }}</strong><Pin v-if="note.isPinned" :size="12" /></span>
          <p>{{ note.excerpt || t('notes.blank') }}</p>
          <time>{{ formatDate(note.updatedAt) }}</time>
        </button>
      </div>
    </section>

    <section class="note-editor-pane">
      <div v-if="!selectedNote" class="note-editor-empty">
        <NotebookPen :size="34" />
        <h2>{{ t('notes.createTitle') }}</h2>
        <button type="button" class="primary-command" @click="addNote"><Plus :size="16" />{{ t('notes.create') }}</button>
      </div>
      <template v-else>
        <header class="note-editor-commandbar">
          <span :class="{ saving, error: saveStatus === '保存失败' }">{{ saveStatus || t('common.saved') }}</span>
          <div>
            <button type="button" class="icon-button" :title="selectedNote.isPinned ? t('library.pin.cancel') : t('notes.pin')" @click="togglePinned"><PinOff v-if="selectedNote.isPinned" :size="16" /><Pin v-else :size="16" /></button>
            <button type="button" class="icon-button" :title="t('notes.copy')" @click="copyCurrentNote"><Copy :size="16" /></button>
            <div class="note-export-control">
              <button type="button" class="secondary-command" @click="exportMenuOpen = !exportMenuOpen"><Download :size="15" />{{ t('common.export') }}<ChevronDown :size="14" /></button>
              <div v-if="exportMenuOpen" class="note-export-menu">
                <button type="button" @click="exportCurrentNote('markdown')"><FileText :size="15" />Markdown</button>
                <button type="button" @click="exportCurrentNote('html')"><Braces :size="15" />HTML</button>
                <button type="button" @click="exportCurrentNote('json')"><FileJson :size="15" />JSON</button>
              </div>
            </div>
            <button type="button" class="icon-button danger-icon" :title="t('notes.delete')" @click="deleteDialogOpen = true"><Trash2 :size="16" /></button>
          </div>
        </header>

        <div class="note-title-block">
          <input v-model="title" class="note-title-input" maxlength="160" :placeholder="t('notes.untitled')" />
          <div><span>{{ wordCount.toLocaleString() }} {{ t('unit.wordsShort') }}</span><span>{{ t('notes.createdAt') }} {{ formatDate(selectedNote.createdAt) }}</span></div>
        </div>

        <div v-if="editor" class="note-format-toolbar" role="toolbar" :aria-label="t('notes.format')">
          <button type="button" :title="t('editor.undo')" :disabled="!editor.can().chain().focus().undo().run()" @click="editor.chain().focus().undo().run()"><Undo2 :size="16" /></button>
          <button type="button" :title="t('editor.redo')" :disabled="!editor.can().chain().focus().redo().run()" @click="editor.chain().focus().redo().run()"><Redo2 :size="16" /></button>
          <i />
          <button type="button" :title="t('editor.heading1')" :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"><Heading1 :size="17" /></button>
          <button type="button" :title="t('editor.heading2')" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"><Heading2 :size="17" /></button>
          <button type="button" :title="t('editor.heading3')" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"><Heading3 :size="17" /></button>
          <i />
          <button type="button" :title="t('editor.bold')" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()"><Bold :size="16" /></button>
          <button type="button" :title="t('editor.italic')" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()"><Italic :size="16" /></button>
          <button type="button" :title="t('editor.underline')" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()"><Underline :size="16" /></button>
          <button type="button" :title="t('editor.strikethrough')" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()"><Strikethrough :size="16" /></button>
          <i />
          <button type="button" :title="t('editor.bulletList')" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()"><List :size="17" /></button>
          <button type="button" :title="t('editor.orderedList')" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()"><ListOrdered :size="17" /></button>
          <button type="button" :title="t('editor.quote')" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()"><Quote :size="16" /></button>
          <button type="button" :title="t('editor.codeBlock')" :class="{ active: editor.isActive('codeBlock') }" @click="editor.chain().focus().toggleCodeBlock().run()"><Code2 :size="16" /></button>
          <button type="button" :title="t('editor.divider')" @click="editor.chain().focus().setHorizontalRule().run()"><Minus :size="17" /></button>
          <i />
          <button type="button" :title="t('editor.link')" :class="{ active: editor.isActive('link') }" @click="editLink"><Link2 :size="16" /></button>
          <button type="button" :title="t('editor.linkRemove')" :disabled="!editor.isActive('link')" @click="editor.chain().focus().unsetLink().run()"><Unlink :size="16" /></button>
        </div>
        <EditorContent v-if="editor" :editor="editor" class="note-editor-content" />
      </template>
    </section>
    <UiConfirmDialog :open="deleteDialogOpen" danger :title="t('notes.deleteConfirm')" :description="`“${selectedNote?.title || t('notes.untitled')}”将从本机永久删除，此操作无法撤销。`" :confirm-label="t('notes.delete')" @close="deleteDialogOpen = false" @confirm="removeCurrentNote" />
  </section>
</template>
