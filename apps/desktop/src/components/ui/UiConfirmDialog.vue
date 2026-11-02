<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { nextTick, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  confirmDisabled?: boolean
}>(), {
  confirmLabel: t('common.confirm'),
  cancelLabel: t('common.cancel'),
  danger: false,
  busy: false,
  confirmDisabled: false
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const dialog = ref<HTMLDialogElement>()

watch(() => props.open, async open => {
  await nextTick()
  if (open && dialog.value && !dialog.value.open) dialog.value.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function close() {
  emit('close')
}

function cancel(event: Event) {
  event.preventDefault()
  close()
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="ui-dialog" @cancel="cancel" @close="open && close()">
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <slot />
      <div class="ui-dialog-actions">
        <button type="button" class="secondary-command" :disabled="busy" @click="close">{{ cancelLabel }}</button>
        <button type="button" :class="danger ? 'danger-command-filled' : 'primary-command'" :disabled="busy || confirmDisabled" @click="emit('confirm')">
          {{ busy ? t('common.working') : confirmLabel }}
        </button>
      </div>
    </dialog>
  </Teleport>
</template>
