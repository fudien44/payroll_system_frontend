<script setup lang="ts">
import { useLocale } from 'vuetify'
import type { VerticalMenuItem } from '@/layouts/components/types'
import VerticalNavGroupItems from '@/layouts/components/vertical-nav/VerticalNavGroupItems.vue'

interface Props {
  navItem: VerticalMenuItem & { children?: VerticalMenuItem[] }
}

const props = defineProps<Props>()
const { t } = useLocale()
</script>

<template>
  <VListGroup
    v-if="props.navItem"
    :value="props.navItem.name"
  >
    <template #activator="{ props: activatorProps }">
      <VListItem
        v-bind="activatorProps"
        :prepend-icon="props.navItem.icon"
        :title="t(props.navItem.name)"
      >
        <template #append>
          <VIcon
            class="navigation-group-handler scale-rtl me-n2"
            icon="mdi-chevron-right"
          />
        </template>
      </VListItem>
    </template>

    <VerticalNavGroupItems :nav-item="props.navItem" />
  </VListGroup>
</template>
