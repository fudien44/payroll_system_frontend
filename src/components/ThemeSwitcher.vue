<script lang="ts" setup>
import { useAppConfig } from '@/composable/useAppConfig'

const { theme } = useAppConfig()
const currentTheme = ref<['light' | 'dark' | 'system']>([theme.value])

watch(currentTheme, () => {
  theme.value = currentTheme.value[0]
})

const themeSwitcherIcon = computed(() => {
  return currentTheme.value[0] === 'system' ? 'mdi-laptop' : currentTheme.value[0] === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'
})
</script>

<template>
  <!-- theme Switcher -->
  <VBtn icon>
    <VIcon :icon="themeSwitcherIcon" />

    <VMenu
      activator="parent"
      offset="10px"
    >
      <VList
        v-model:selected="currentTheme"
        :items="[
          { name: 'System', value: 'system', props: { prependIcon: 'mdi-laptop' } },
          { name: 'Light', value: 'light', props: { prependIcon: 'mdi-weather-sunny' } },
          { name: 'Dark', value: 'dark', props: { prependIcon: 'mdi-weather-night' } },
        ]"
        item-title="name"
        item-value="value"
        mandatory
      />
    </VMenu>
  </VBtn>
</template>
