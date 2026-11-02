<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { computed, ref, watch } from 'vue'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileText, ImagePlus, Settings2, Upload, X } from 'lucide-vue-next'
import { saveImportedBook } from './db'
import { defaultParseOptions, defaultTheme, formatChapterLabel, type LocalBook, type ParseOptions, type ParseResult, type ParserResponse, type ThemeSettings } from './types'
import { getThemePreset, themePresets } from './themes'

const props = defineProps<{ open: boolean; existingBook?: LocalBook }>()
const emit = defineEmits<{ close: []; imported: [book: LocalBook] }>()
const step = ref(1)
const file = ref<File>()
const options = ref<ParseOptions>({ ...defaultParseOptions })
const result = ref<ParseResult>()
const progress = ref(0)
const progressMessage = ref('')
const error = ref('')
const previewIndex = ref(0)
const importing = ref(false)
const theme = ref<ThemeSettings>({ ...defaultTheme })
const cover = ref<Blob>()
const coverUrl = ref('')

watch(() => props.open, open => {
  if (!open) return
  step.value = 1
  file.value = undefined
  result.value = undefined
  progress.value = 0
  error.value = ''
  previewIndex.value = 0
  options.value = { ...(props.existingBook?.parseOptions ?? defaultParseOptions) }
  theme.value = { ...(props.existingBook?.theme ?? defaultTheme) }
  cover.value = undefined
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
  coverUrl.value = ''
})

const selectedChapter = computed(() => result.value?.chapters[previewIndex.value])
const selectedPresetImage = computed(() => coverUrl.value || getThemePreset(theme.value.preset).image || '')
const steps = computed(() => props.existingBook ? [t('notes.quoteSelect'), t('parse.proofread'), t('reader.theme.confirm'), t('update.done')] : [t('common.chooseFile'), t('parse.proofread'), t('reader.theme.choose'), t('library.import.done')])

function chooseFile(selected?: File) {
  if (!selected) return
  if (!/\.txt$/i.test(selected.name) && !selected.type.startsWith('text/')) {
    error.value = t('import.txt.chooseFile')
    return
  }
  file.value = selected
  error.value = ''
}

function onDrop(event: DragEvent) { chooseFile(event.dataTransfer?.files?.[0]) }

async function parseFile() {
  if (!file.value) return
  step.value = 2
  progress.value = 2
  progressMessage.value = t('common.readingFile')
  error.value = ''
  const buffer = await file.value.arrayBuffer()
  const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })
  try {
    result.value = await new Promise<ParseResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<ParserResponse>) => {
        if (event.data.type === 'progress') {
          progress.value = event.data.progress
          progressMessage.value = event.data.message
        } else if (event.data.type === 'complete') resolve(event.data.result)
        else reject(new Error(event.data.message))
      }
      worker.onerror = () => reject(new Error(t('parse.workerFailed')))
      worker.postMessage({ buffer, filename: file.value!.name, options: { ...options.value } }, [buffer])
    })
    progress.value = 100
    progressMessage.value = t('import.detectedChapters', { count: result.value.chapters.length })
    previewIndex.value = 0
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('parse.failed')
  } finally {
    worker.terminate()
  }
}

function selectPreset(id: string) {
  const preset = getThemePreset(id)
  theme.value = { ...preset.settings }
  cover.value = undefined
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
  coverUrl.value = ''
}

function selectCover(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
  cover.value = selected
  coverUrl.value = URL.createObjectURL(selected)
}

async function finishImport() {
  if (!result.value || !file.value) return
  importing.value = true
  error.value = ''
  try {
    const book = await saveImportedBook({ result: result.value, cover: cover.value, theme: theme.value, options: options.value, existingId: props.existingBook?.id })
    step.value = 4
    emit('imported', book)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('common.saveFailed')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="local-modal-backdrop" @mousedown.self="emit('close')">
      <section class="local-modal import-modal" role="dialog" aria-modal="true" :aria-label="t('import.txt.title')">
        <header><div><small>LOCAL IMPORT</small><h2>{{ existingBook ? `重新解析《${existingBook.title}》` : t('import.txt.title') }}</h2></div><button type="button" :aria-label="t('common.close')" @click="emit('close')"><X :size="20" /></button></header>
        <ol class="import-steps"><li v-for="(label, index) in steps" :key="label" :class="{ active: step === index + 1, done: step > index + 1 }"><span>{{ step > index + 1 ? '✓' : index + 1 }}</span>{{ label }}</li></ol>

        <div v-if="step === 1" class="import-step-body">
          <label class="import-dropzone" @dragover.prevent @drop.prevent="onDrop"><Upload :size="34" /><strong>{{ file?.name || t('import.txt.dropzone') }}</strong><span>{{ file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : t('import.supportedEncodings') }}</span><input type="file" accept=".txt,text/plain" @change="chooseFile(($event.target as HTMLInputElement).files?.[0])" /></label>
          <p class="local-privacy-note"><FileText :size="16" /> {{ t('import.txt.privacyWeb') }}</p>
          <details class="import-advanced"><summary><Settings2 :size="16" /> {{ t('parse.advancedRules') }}</summary><div class="import-rule-grid">
            <label>{{ t('import.encoding') }}<select v-model="options.encoding"><option value="auto">{{ t('import.autoDetect') }}</option><option value="utf-8">UTF-8</option><option value="gb18030">GBK / GB18030</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option></select></label>
            <label class="rule-wide">{{ t('parse.customRegex') }}<input v-model="options.chapterPattern" :placeholder="t('parse.customRegexHint')" /></label>
            <label class="rule-wide">{{ t('parse.adRulesHint') }}<textarea v-model="options.adPatterns" rows="4" /></label>
            <label class="rule-check"><input v-model="options.mergeWrapped" type="checkbox" /> {{ t('parse.mergeLines') }}</label><label class="rule-check"><input v-model="options.removeAds" type="checkbox" /> {{ t('parse.adRulesEnabled') }}</label>
          </div></details>
        </div>

        <div v-else-if="step === 2" class="import-step-body">
          <div v-if="!result" class="import-progress"><span :style="{ width: `${progress}%` }" /><strong>{{ progressMessage }}</strong><small>{{ progress }}%</small></div>
          <template v-else>
            <div class="import-metadata"><label>{{ t('library.field.title') }}<input v-model="result.metadata.title" /></label><label>{{ t('library.field.author') }}<input v-model="result.metadata.author" :placeholder="t('library.field.anonymous')" /></label><label class="metadata-wide">{{ t('library.field.synopsis') }}<textarea v-model="result.metadata.description" rows="3" /></label></div>
            <div class="parse-summary"><span><b>{{ result.chapters.length }}</b> {{ t('unit.chaptersShort') }}</span><span><b>{{ [...new Set(result.chapters.map(item => item.volume).filter(Boolean))].length || 1 }}</b> {{ t('contents.volumeGroup') }}</span><span><b>{{ result.metadata.encoding }}</b> {{ t('import.encodingShort') }}</span><span><b>{{ result.chapters.reduce((sum, item) => sum + item.wordCount, 0).toLocaleString() }}</b> {{ t('unit.wordsShort') }}</span></div>
            <div v-if="result.warnings.length" class="parse-warnings"><p v-for="warning in result.warnings" :key="warning"><AlertTriangle :size="15" /> {{ warning }}</p></div>
            <div class="chapter-preview"><aside><button v-for="(chapter, index) in result.chapters.slice(0, 80)" :key="chapter.number" type="button" :class="{ active: previewIndex === index }" @click="previewIndex = index"><small>{{ chapter.volume || t('reader.text') }}</small><span>{{ formatChapterLabel(chapter) }} {{ chapter.title }}</span></button><p v-if="result.chapters.length > 80">{{ t('contents.others') }} {{ result.chapters.length - 80 }} {{ t('library.chaptersPending') }}</p></aside><article v-if="selectedChapter"><small>{{ t('notes.formatPreview') }} {{ selectedChapter.wordCount }} {{ t('unit.wordsShort') }}</small><h3>{{ formatChapterLabel(selectedChapter) }} {{ selectedChapter.title }}</h3><p v-for="paragraph in selectedChapter.content.split(/\n{2,}/).slice(0, 12)" :key="paragraph">{{ paragraph }}</p></article></div>
            <details class="import-advanced"><summary><Settings2 :size="16" /> {{ t('parse.adjustAndRetry') }}</summary><div class="import-rule-grid"><label>{{ t('import.encoding') }}<select v-model="options.encoding"><option value="auto">{{ t('import.autoDetect') }}</option><option value="utf-8">UTF-8</option><option value="gb18030">GBK / GB18030</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option></select></label><label class="rule-wide">{{ t('parse.customRegex') }}<input v-model="options.chapterPattern" /></label><label class="rule-wide">{{ t('parse.adRules') }}<textarea v-model="options.adPatterns" rows="3" /></label><label class="rule-check"><input v-model="options.mergeWrapped" type="checkbox" /> {{ t('parse.mergeLines') }}</label><label class="rule-check"><input v-model="options.removeAds" type="checkbox" /> {{ t('parse.adRulesEnabled') }}</label><button type="button" class="local-button-secondary" @click="result = undefined; parseFile()">{{ t('parse.retry') }}</button></div></details>
          </template>
        </div>

        <div v-else-if="step === 3 && result" class="import-step-body">
          <div class="import-theme-preview" :style="{ '--theme-accent': theme.accent, '--theme-text': theme.text, '--theme-overlay': `${theme.overlay / 100}`, background: selectedPresetImage ? `linear-gradient(rgba(0,0,0,var(--theme-overlay)), rgba(0,0,0,var(--theme-overlay))), url(${selectedPresetImage}) ${theme.positionX}% ${theme.positionY}%/cover` : theme.background }"><span>{{ result.metadata.author || t('library.field.anonymous') }}</span><strong>{{ result.metadata.title }}</strong><small>{{ result.chapters.length }} {{ t('unit.chaptersShort') }}</small></div>
          <div class="theme-preset-grid"><button v-for="preset in themePresets" :key="preset.id" type="button" :class="{ active: theme.preset === preset.id && !coverUrl }" @click="selectPreset(preset.id)"><span :style="{ background: preset.image ? `url(${preset.image}) center/cover` : preset.settings.background }" /><b>{{ preset.name }}</b><Check v-if="theme.preset === preset.id && !coverUrl" :size="15" /></button></div>
          <div class="theme-controls"><label><span>{{ t('reader.typography.accentColor') }}</span><input v-model="theme.accent" type="color" /></label><label><span>{{ t('reader.typography.backgroundColor') }}</span><input v-model="theme.background" type="color" /></label><label><span>{{ t('reader.typography.textColor') }}</span><input v-model="theme.text" type="color" /></label><label class="theme-control-wide"><span>{{ t('reader.theme.overlay') }} {{ theme.overlay }}%</span><input v-model.number="theme.overlay" type="range" min="0" max="85" /></label><label class="theme-control-wide"><span>{{ t('reader.focus.horizontal') }} {{ theme.positionX }}%</span><input v-model.number="theme.positionX" type="range" min="0" max="100" /></label><label class="theme-control-wide"><span>{{ t('reader.focus.vertical') }} {{ theme.positionY }}%</span><input v-model.number="theme.positionY" type="range" min="0" max="100" /></label></div>
          <label class="local-upload-button"><ImagePlus :size="17" /> {{ t('reader.theme.uploadImage') }}<input type="file" accept="image/*" @change="selectCover" /></label>
        </div>

        <div v-else class="import-complete"><Check :size="34" /><h3>{{ existingBook ? t('parse.retryDone') : t('library.shelf.added') }}</h3><p>{{ t('library.web.savedLocally') }}</p></div>
        <p v-if="error" class="local-error">{{ error }}</p>
        <footer><button v-if="step > 1 && step < 4" type="button" class="local-button-secondary" @click="step--"><ArrowLeft :size="16" /> {{ t('common.previousStep') }}</button><span /><button v-if="step === 1" type="button" class="local-button-primary" :disabled="!file" @click="parseFile">{{ t('parse.start') }} <ArrowRight :size="16" /></button><button v-else-if="step === 2 && result" type="button" class="local-button-primary" @click="step = 3">{{ t('reader.theme.choose') }} <ArrowRight :size="16" /></button><button v-else-if="step === 3" type="button" class="local-button-primary" :disabled="importing" @click="finishImport">{{ importing ? t('common.savingNow') : existingBook ? t('online.book.update') : t('common.addToShelf') }}</button><button v-else-if="step === 4" type="button" class="local-button-primary" @click="emit('close')">{{ t('common.done') }}</button></footer>
      </section>
    </div>
  </Teleport>
</template>
