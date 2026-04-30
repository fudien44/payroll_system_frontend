<script setup lang="ts" generic="T extends GlobalSearchData">
import { useMagicKeys } from '@vueuse/core'
import { VList } from 'vuetify/components/VList'
import type { GlobalSearchData } from '@plugins/apis/types'

interface Emit {
  (e: 'update:isDialogVisible', value: boolean): void
  (e: 'search', value: string): void
}

interface Props {
  isDialogVisible: boolean
  searchResults: T[]
}

const props = defineProps<Props>()
const emit = defineEmits<Emit>()
const refSearchList = ref<VList>()

// 👉 Hotkey
const { ctrl_k, meta_k } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    if (e.ctrlKey && e.key === 'k' && e.type === 'keydown')
      e.preventDefault()
  },
})

const searchQueryLocal = ref('')

// 👉 watching control + / to open dialog

watch([ctrl_k, meta_k], () => {
  emit('update:isDialogVisible', true)
})

// 👉 clear search result and close the dialog
const clearSearchAndCloseDialog = () => {
  searchQueryLocal.value = ''
  emit('update:isDialogVisible', false)
}

const dialogModelValueUpdate = (val: boolean) => {
  searchQueryLocal.value = ''
  emit('update:isDialogVisible', val)
}

// 👉 clear search query when redirect to another page
watch(
  () => props.isDialogVisible,
  () => {
    searchQueryLocal.value = ''
  },
)

watch(searchQueryLocal, () => {
  emit('search', searchQueryLocal.value)
})

// get fucus on search list
const getFocusOnSearchList = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    refSearchList.value?.focus('next')
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    refSearchList.value?.focus('prev')
  }
}
</script>

<template>
  <VDialog
    max-width="600"
    :model-value="props.isDialogVisible"
    class="global-search-dialog"
    @update:model-value="dialogModelValueUpdate"
    @keyup.esc="clearSearchAndCloseDialog"
  >
    <VCard>
      <VCardText class="pb-0">
        <VTextField
          v-model="searchQueryLocal"
          density="default"
          prepend-inner-icon="mdi-magnify"
          autofocus
          placeholder="Search apps & pages"
          @keydown="getFocusOnSearchList"
        />

        <VList
          v-if="props.searchResults.length && searchQueryLocal.length"
          ref="refSearchList"
          class="mx-n3"
        >
          <VListItem
            v-for="item in props.searchResults"
            :key="item.title"
            :to="item.to"
            rounded="sm"
            class="mb-2"
            @click="dialogModelValueUpdate(false)"
          >
            <template #prepend>
              <VIcon
                size="20"
                :icon="item.icon"
              />
            </template>
            <VListItemTitle class="text-sm">
              {{ item.title }}
            </VListItemTitle>

            <template #append>
              <VChip
                label
                size="x-small"
                color="primary"
                class="search-group"
              >
                {{ item.subtitle }}
              </VChip>
            </template>
          </VListItem>
        </VList>

        <div
          v-else
          class="py-6 text-center"
        >
          <p class="text-body-2 mb-0">
            {{ searchQueryLocal.length && !props.searchResults.length ? 'No result found!' : 'No recent searches' }}
          </p>
        </div>
      </VCardText>
      <VDivider />
      <VCardText class="d-flex align-center flex-wrap text-no-wrap gap-sm-4 gap-2 py-3">
        <div class="d-flex align-center gap-2">
          <VIcon
            size="16"
            icon="mdi-arrow-left-bottom"
          />
          <span class="text-caption ">to select</span>
        </div>
        <div class="d-flex align-center gap-2">
          <VIcon
            size="16"
            icon="mdi-arrow-up"
          />
          <VIcon
            size="16"
            icon="mdi-arrow-down"
          />
          <span class="text-caption">to navigate</span>
        </div>
        <VSpacer />
        <div class="d-flex align-center gap-2">
          <VIcon
            size="16"
            icon="mdi-keyboard-esc"
          />

          <span class="text-caption">to close</span>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style lang="scss">
.global-search-dialog {
  .v-overlay__content {
    inset-block-start: 64px;
  }

  .search-group {
    opacity: 0;
  }

  .v-list-item:hover {
    .search-group {
      opacity: 1;
    }
  }
}
</style>
