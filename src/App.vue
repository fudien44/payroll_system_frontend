<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'; // NEW
import { useAppConfig } from '@/composable/useAppConfig'
import Blank from '@/layouts/blank.vue'
import Default from '@/layouts/default.vue'
import { useSnackbarStore } from '@/stores/snackbar'; // NEW
import { appConfig } from '@appConfig'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

const route = useRouter()
const { initLoadingTheme, rootClasses } = useAppConfig()

const resolveLayoutVariant = computed(() => {
  if (route.currentRoute.value.meta.layout === 'content')
    return Default

  if (route.currentRoute.value.meta.layout === 'blank')
    return Blank

  return false
})

const setAppRtl = computed(() => {
  if (appConfig.isRtl.value)
    return { rtl: true }
  else
    return {}
})

const classes = rootClasses()

// NEW — global snackbar, fed by the router guard (and anything else that
// wants app-wide notifications outside a specific view's local BaseAlert)
const snackbarStore = useSnackbarStore()
const { visible: snackbarVisible, message: snackbarMessage, type: snackbarType } = storeToRefs(snackbarStore)

initLoadingTheme()
</script>

<template>
  <VLocaleProvider v-bind="setAppRtl">
    <VApp :class="classes">
      <Component
        :is="resolveLayoutVariant"
        v-if="resolveLayoutVariant"
      />

      <BaseAlert
        v-model="snackbarVisible"
        :message="snackbarMessage"
        :type="snackbarType"
        :timeout="3500"
      />
    </VApp>
  </VLocaleProvider>
</template>

<style>
/* Guided tour (driver.js) — match Vuetify look & feel */
.jo-tour-popover {
  border-radius: 12px !important;
  font-family: inherit !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18) !important;
}

.jo-tour-popover .driver-popover-title {
  font-weight: 700 !important;
  font-size: 15px !important;
}

.jo-tour-popover .driver-popover-description {
  font-size: 13.5px !important;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.jo-tour-popover .driver-popover-next-btn,
.jo-tour-popover .driver-popover-prev-btn {
  border-radius: 8px !important;
  font-weight: 600 !important;
  text-transform: none !important;
}

.jo-tour-popover .driver-popover-progress-text {
  font-size: 12px !important;
}

/* Dark mode overrides */
.v-theme--dark .jo-tour-popover,
.v-theme--dark .jo-tour-popover .driver-popover-arrow-side-left.driver-popover-arrow,
.v-theme--dark .jo-tour-popover .driver-popover-arrow-side-right.driver-popover-arrow,
.v-theme--dark .jo-tour-popover .driver-popover-arrow-side-top.driver-popover-arrow,
.v-theme--dark .jo-tour-popover .driver-popover-arrow-side-bottom.driver-popover-arrow {
  background-color: rgb(var(--v-theme-surface)) !important;
}

.v-theme--dark .jo-tour-popover {
  background-color: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.v-theme--dark .jo-tour-popover .driver-popover-title,
.v-theme--dark .jo-tour-popover .driver-popover-close-btn {
  color: rgb(var(--v-theme-on-surface)) !important;
}

.v-theme--dark .jo-tour-popover .driver-popover-next-btn,
.v-theme--dark .jo-tour-popover .driver-popover-prev-btn {
  background-color: rgba(var(--v-theme-on-surface), 0.08) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
}

.v-theme--dark .jo-tour-popover .driver-popover-footer {
  border-top-color: rgba(var(--v-theme-on-surface), 0.08) !important;
}
</style>
