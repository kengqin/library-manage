<script setup lang="ts">
import { t } from '@novel-library/i18n/vue'
import { ArrowUpRight, ShieldCheck, X } from 'lucide-vue-next'
import { cancelOnlineVerification, onlineVerifications, showOnlineVerification } from '../services/online-browser'
import { showGlobalError } from '../services/global-message'
const hostname = (url: string) => new URL(url).hostname
const open = (id: string) => showOnlineVerification(id).catch(cause => showGlobalError(cause, t('browser.verify.openFailed')))
const cancel = (id: string) => cancelOnlineVerification(id).catch(cause => showGlobalError(cause, t('browser.verify.cancelFailed')))
</script>

<template>
  <Teleport to="body">
    <div v-if="onlineVerifications.length" class="online-verifications" aria-live="polite">
      <div v-for="item in onlineVerifications" :key="item.requestId" class="online-verification" role="status">
        <ShieldCheck :size="17" aria-hidden="true" />
        <span><strong>{{ hostname(item.url) }}</strong><small>{{ t('browser.verify.waiting') }}</small></span>
        <button type="button" class="text-command" @click="open(item.requestId)">{{ t('window.open') }}<ArrowUpRight :size="13" /></button>
        <button type="button" class="icon-button" :aria-label="t('browser.verify.cancel')" @click="cancel(item.requestId)"><X :size="15" /></button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.online-verifications { position: fixed; right: 24px; bottom: 24px; z-index: 2200; display: grid; gap: 10px; max-width: calc(100vw - 40px); }
.online-verification { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--ui-border); border-radius: 12px; background: var(--ui-surface); color: var(--ui-text-2); box-shadow: var(--ui-shadow); animation: verification-in 180ms ease-out; }
.online-verification > span { display: grid; gap: 4px; min-width: 0; }
.online-verification strong { overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; }
.online-verification small { color: var(--ui-text-3); font-size: 11px; }
.online-verification .text-command { flex-shrink: 0; font-size: 12px; }
@keyframes verification-in { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .online-verification { animation: none; } }
</style>
