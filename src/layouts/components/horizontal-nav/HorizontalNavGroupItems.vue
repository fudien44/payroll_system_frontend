<script setup lang="ts">
import HorizontalNavGroup from '@/layouts/components/horizontal-nav/HorizontalNavGroup.vue'
import HorizontalNavLink from '@/layouts/components/horizontal-nav/HorizontalNavLink.vue'
import type { HorizontalMenuItem } from '@/layouts/components/types'

interface Props {
  navItem: HorizontalMenuItem
}

const props = defineProps<Props>()

const resolveNavLinkGroup = computed(() => {
  return (navItem: any) => {
    return navItem.children ? HorizontalNavGroup : HorizontalNavLink
  }
})
</script>

<template>
  <VMenu
    activator="parent"
    location="end"
    offset="10"
    class="nav-content"
    content-class="horizontal-nav-menu-child-content"
  >
    <VList>
      <template
        v-for="item in props.navItem.children"
        :key="item.name"
      >
        <Component
          :is="resolveNavLinkGroup(item)"
          :nav-item="item"
        />
      </template>
    </VList>
  </VMenu>
</template>
