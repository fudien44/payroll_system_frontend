<script setup lang="ts">
import BackToTop from '@/components/BackToTop.vue'
import { useAppConfig } from '@/composable/useAppConfig'
import Footer from '@/layouts/components/footer/index.vue'
import HorizontalNav from '@/layouts/components/horizontal-nav/index.vue'
import Navbar from '@/layouts/components/navbar/index.vue'
import VerticalNav from '@/layouts/components/vertical-nav/index.vue'
import { appConfig } from '@appConfig'

const { navigationMenu } = useAppConfig()
const isVerticalNavExpand = ref<boolean>(false)

// set vertical or horizontal menu as default
const isVerticalMenu = computed(() => {
  return navigationMenu.value !== 'horizontal'
})

// !SECTION
</script>

<template>
  <template v-if="$vuetify.display.mdAndDown ? true : isVerticalMenu">
    <VerticalNav
      v-model:is-drawer-open="isVerticalNavExpand"
      class="d-print-none"
    />
  </template>

  <template v-else>
    <HorizontalNav
      :is-horizontal-layout="$vuetify.display.mdAndDown ? false : !isVerticalMenu"
      class="d-print-none"
    />
  </template>

  <!-- buy now button -->

  <!-- back to top -->
  <BackToTop />

  <!-- navbar -->
  <Navbar
    v-model:is-drawer-open="isVerticalNavExpand"
    class="d-print-none"
  />

  <!-- main content -->
  <VMain
    class="layout-page-content"
    :class="isVerticalMenu ? 'with-vertical-nav' : 'with-horizontal-nav'"
  >
    <VContainer
      :fluid="!appConfig.isBoxLayout.value"
      class="layout-page-content-wrapper"
    >
      <RouterView v-slot="{ Component }">
        <Transition
          :name="appConfig.routeTransition.value"
          mode="out-in"
        >
          <Component :is="Component" />
        </Transition>
      </RouterView>
    </VContainer>
    <Footer class="d-print-none" />
  </VMain>
</template>
