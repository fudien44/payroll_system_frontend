<script lang="ts" setup>
import { useLocale } from 'vuetify'

const { current } = useLocale()

const changeLocale = (value: string) => {
  current.value = value.toLowerCase()
  localStorage.setItem('app-locale', value.toLowerCase())
  document.querySelector('html')?.setAttribute('lang', value)
}
</script>

<template>
  <VBtn icon>
    <VIcon icon="mdi-translate" />

    <VMenu
      activator="parent"
      offset="10px"
    >
      <VList>
        <VListItem
          v-for="(item, index) in [{ name: 'English', abr: 'en' }, { name: 'French', abr: 'fr' }, { name: 'Arabic', abr: 'ar' }]"
          :key="index"
          :value="index"
          :active="$vuetify.locale.current === item.abr"
          @click="changeLocale(item.abr)"
        >
          <VListItemTitle>{{ item.name }}</VListItemTitle>
        </VListItem>
      </VList>
    </VMenu>
  </VBtn>
</template>
