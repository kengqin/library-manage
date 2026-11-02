<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { BookOpen, EyeOff, Trash2 } from 'lucide-vue-next'
import type { DesktopBookSummary } from '../../services/desktop-library'

defineProps<{
  book: DesktopBookSummary
}>()

defineEmits<{
  open: []
  read: []
  privacy: []
  requestDelete: []
}>()
</script>

<template>
  <article class="book-card">
    <div class="book-card-cover-wrap">
      <button type="button" class="book-card-cover" :class="{ 'book-card-cover--image': book.coverDataUrl }" @click="$emit('open')">
        <img v-if="book.coverDataUrl" :src="book.coverDataUrl" alt="" />
        <span v-else>{{ book.title.slice(0, 1) }}</span>
        <i class="format-badge">{{ book.sourceFormat === 'web' ? t('nav.online') : book.sourceFormat.toUpperCase() }}</i>
      </button>
      <button type="button" class="book-card-delete" :aria-label="`删除《${book.title}》`" :title="t('library.delete.action')" @click="$emit('requestDelete')"><Trash2 :size="15" /></button>
    </div>
    <div class="book-card-copy">
      <button type="button" @click="$emit('open')"><strong>{{ book.title }}</strong><span>{{ book.author || t('library.field.anonymous') }}</span></button>
      <div class="book-card-quick-actions">
        <button type="button" class="book-card-read" :title="book.progress ? t('library.continueReading') : t('library.startReading')" @click="$emit('read')"><BookOpen :size="16" /></button>
        <button type="button" class="book-card-privacy" :title="t('app.privacyMode.enter')" :aria-label="`以隐私模式阅读《${book.title}》`" @click="$emit('privacy')"><EyeOff :size="16" /></button>
      </div>
    </div>
    <div class="book-card-meta"><span>{{ t('unit.chapters', { count: book.chapterCount }) }}</span><span>{{ t('unit.words', { count: book.totalWords.toLocaleString() }) }}</span><strong>{{ book.progress.toFixed(0) }}%</strong></div>
    <div class="book-card-progress" :aria-label="t('library.progress.value', { progress: book.progress.toFixed(1) })"><span :style="{ width: `${book.progress}%` }" /></div>
  </article>
</template>
