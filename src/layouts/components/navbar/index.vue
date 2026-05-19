<script lang="ts" setup>
import Logo from '@/components/Logo.vue'
import NavUserProfileMenu from '@/components/NavUserProfileMenu.vue'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import { useAppConfig } from '@/composable/useAppConfig'
import { appConfig } from '@appConfig'

interface Emit {
  (e: 'update:isDrawerOpen', value: boolean): void
}

const props = defineProps<{
  isDrawerOpen: boolean
}>()

const emit = defineEmits<Emit>()
const { navigationMenu, isNavbarFixed } = useAppConfig()
</script>

<template>
  <VAppBar
    class="layout-navbar"
    :absolute="!isNavbarFixed"
  >
    <div class="navbar-wrapper">
      <!-- small screen navigation drawer toggler -->
      <VAppBarNavIcon
        v-show="$vuetify.display.mdAndDown"
        class="ms-n2"
        @click="emit('update:isDrawerOpen', !props.isDrawerOpen)"
      />

      <RouterLink
        v-if="navigationMenu === 'horizontal' && $vuetify.display.lgAndUp"
        to="/"
        class="text-primary d-flex align-center gap-1"
      >
        <Logo />
        <h6 class="text-h6 font-weight-bold text-gradient">
          {{ appConfig.title.value }}
        </h6>
      </RouterLink>

      <VSpacer />

      <!-- ThemeSwitcher -->
        <ThemeSwitcher />

      <!-- user menu -->
      <NavUserProfileMenu />
    </div>
  </VAppBar>
</template>
