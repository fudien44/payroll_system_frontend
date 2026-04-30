<script setup lang="ts">
import { useLocale } from 'vuetify'
import type { HorizontalMenuItem } from '@/layouts/components/types'
import { isNavLinkActive } from '@/layouts/components/utils'

interface Props {
  navItem: HorizontalMenuItem
}
interface Emit {
  (e: 'closeGroup'): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emit>()

const { t } = useLocale()
</script>

<template>
  <template v-if="props.navItem">
    <!-- navigation for same app routes -->
    <VListItem
      v-if="props.navItem.to"
      :prepend-icon="props.navItem.icon"
      :title="t(props.navItem.name)"
      :to="props.navItem.to"
      :active="isNavLinkActive(props.navItem)"
      :target="props.navItem.target ? props.navItem.target : ''"
      @click="emit('closeGroup')"
    />

    <!-- navigation for external site link -->
    <VListItem
      v-else
      :prepend-icon="props.navItem.icon"
      :title="t(props.navItem.name)"
      :href="props.navItem.href"
      :active="isNavLinkActive(props.navItem)"
      :target="props.navItem.target ? props.navItem.target : ''"
    />
  </template>
</template>
