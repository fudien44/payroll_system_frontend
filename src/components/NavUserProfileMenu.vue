<script lang="ts" setup>
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { nextTick } from 'vue'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const userStore = useUserStore()

const { user } = storeToRefs(userStore)

const initials = computed(() => {
  if (!user.value?.name) return '?'
  const parts = user.value.name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return (first + second).toUpperCase()
})

async function handleLogout() {
  await authStore.logout()
  await nextTick() // ensure state is updated before redirecting
  router.replace({ name: 'login'})
}
</script>

<template>
  <VAvatar
    class="cursor-pointer"
    color="primary"
  >
    <span class="text-white font-weight-bold">{{ initials }}</span>

    <VMenu activator="parent">
      <VList>
        <VListItem v-if="user">
          <template #append>
            <VAvatar color="primary" size="36">
              <span class="text-white text-caption font-weight-bold">{{ initials }}</span>
            </VAvatar>
          </template>
          <VListItemTitle>{{ user?.name }}</VListItemTitle>
        </VListItem>
        <VDivider class="mt-2" />
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
