<script lang="ts" setup>
import avatar from '@images/avatars/avatar-6.png'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { nextTick } from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const userStore = useUserStore()

const { user } = storeToRefs(userStore)

async function handleLogout() {
  await authStore.logout()
  await nextTick() // ensure state is updated before redirecting
  router.replace({ name: 'login'})
}
</script>

<template>
  <VAvatar class="cursor-pointer">
    <VImg :src="avatar" />

    <VMenu activator="parent">
      <VList>
        <VListItem
          v-if="user"
          :append-avatar="avatar"
        >
          <VListItemTitle>{{ user?.name }}</VListItemTitle>
        </VListItem>
        <VDivider class="mt-2" />
        <!-- <VListItem
          v-for="item in [{ title: 'Home', icon: 'mdi-home-outline' },
                          { title: 'Profile', icon: 'mdi-account-outline' },
                          { title: 'Settings', icon: 'mdi-cog-outline' }]"
          :key="item.title"
          :value="item.title"
          :append-icon="item.icon"
        >
          <VListItemTitle>{{ item.title }}</VListItemTitle>
        </VListItem>
        <VDivider /> -->
        <VListItem
          append-icon="mdi-logout"
          @click="handleLogout"
        >
          <VListItemTitle>Logout</VListItemTitle>
        </VListItem>
      </VList>
    </VMenu>
  </VAvatar>
</template>
