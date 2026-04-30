import { createPinia } from 'pinia'
import type { App } from 'vue'
import i18n from '@plugins/i18n'
import vuetify from '@plugins/vuetify/vuetify'
import { loadFonts } from '@plugins/webfontloader'

import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import axiosInstance from '@/plugins/axios'

export function registerPlugins(app: App) {
  loadFonts()

  const pinia = createPinia()

  app
    .use(pinia)
    .use(vuetify)
    .use(router)
    .use(i18n)

    app.config.globalProperties.$axios = axiosInstance

  useAuthStore().initialize()
}
