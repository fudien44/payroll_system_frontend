<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppConfig } from '@/composable/useAppConfig'
import Blank from '@/layouts/blank.vue'
import Default from '@/layouts/default.vue'
import { appConfig } from '@appConfig'

const route = useRouter()
const { initLoadingTheme, rootClasses } = useAppConfig()

const resolveLayoutVariant = computed(() => {
  if (route.currentRoute.value.meta.layout === 'content')
    return Default

  if (route.currentRoute.value.meta.layout === 'blank')
    return Blank

  return false
})

// set rtl through @appConfig.ts
const setAppRtl = computed(() => {
  if (appConfig.isRtl.value)
    return { rtl: true }
  else
    return {}
})

const classes = rootClasses()

initLoadingTheme()
</script>

<template>
  <VLocaleProvider v-bind="setAppRtl">
    <VApp :class="classes">
      <Component
        :is="resolveLayoutVariant"
        v-if="resolveLayoutVariant"
      />
    </VApp>
  </VLocaleProvider>
</template>
