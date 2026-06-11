<script lang="ts" setup>
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const userStore = useUserStore()

const { user, fullName } = storeToRefs(userStore)

const initials = computed(() => {
  if (!fullName.value) return '?'
  const parts = fullName.value.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return (first + second).toUpperCase()
})

async function handleLogout() {
  await authStore.logout()
  await nextTick()
  router.replace({ name: 'login' })
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
          <VListItemTitle>{{ fullName }}</VListItemTitle>
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
