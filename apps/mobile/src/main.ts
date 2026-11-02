import { createApp } from 'vue'
import { initializeLocale } from '@novel-library/i18n/vue'
import App from './App.vue'
import { router } from './router'
import './styles.css'

initializeLocale()

createApp(App).use(router).mount('#app')
