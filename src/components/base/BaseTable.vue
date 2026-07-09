<script setup lang="ts">
interface Header {
    title: string
    key: string
    sortable?: boolean
    align?: 'start' | 'center' | 'end'
}

interface Props {
    headers: Header[]
    items: Record<string, any>[]
    loading?: boolean
    searchable?: boolean
    title?: string
    itemsPerPage?: number
    // NEW: optional list of item keys to search against. If omitted, Vuetify
    // falls back to its default behavior (searching only the `key`s present
    // in `headers`). Use this when a column displays a combined/derived value
    // (e.g. Section shown as a subtitle under Division) but you still want
    // the hidden field searchable.
    filterKeys?: string[]
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    searchable: true,
    title: '',
    itemsPerPage: 10,
    filterKeys: undefined,
})

const emit = defineEmits<{
    (e: 'edit', item: Record<string, any>): void
    (e: 'delete', item: Record<string, any>): void
}>()

const search = ref('')

// NEW: Vuetify's built-in `filter-keys` prop has long-standing reliability
// bugs (see vuetifyjs/vuetify#16999, #22863) where it silently fails to
// widen the searched fields beyond what its internal reactivity happens to
// pick up. Rather than depend on that, we filter items ourselves in plain
// JS and hand VDataTable an already-filtered array — deterministic and
// version-proof. Falls back to header keys if `filterKeys` isn't provided,
// preserving the same searchable scope as before for every other table.
const searchKeys = computed(() => props.filterKeys ?? props.headers.map(h => h.key))

const filteredItems = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return props.items
    return props.items.filter(item =>
        searchKeys.value.some(key => String(item[key] ?? '').toLowerCase().includes(q))
    )
})
</script>

<template>
    <VCard>
        <!-- Card Header -->
        <VCardText class="d-flex align-center justify-space-between flex-wrap gap-4 pb-0">
            <h6 v-if="title" class="text-h6">
                {{ title }}
            </h6>

            <VTextField
                v-if="searchable"
                v-model="search"
                density="compact"
                placeholder="Search..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                hide-details
                style="max-width: 300px;"
            />
        </VCardText>

        <!-- Table -->
        <VDataTable
            :headers="headers"
            :items="filteredItems"
            :loading="loading"
            :items-per-page="itemsPerPage"
            class="text-no-wrap"
        >
            <!-- Loading state -->
            <template #loading>
                <VSkeletonLoader type="table-row@5"/>
            </template>

            <!-- Empty state -->
            <template #no-data>
                <div class="text-center py-8">
                    <VIcon
                        icon="mdi-database-off-outline"
                        size="48"
                        color="medium-emphasis"
                        class="mb-3"
                    />
                    <p class="text-medium-emphasis">
                        No records found
                    </p>
                </div>
            </template>

            <!-- Actions column - only renders if parent uses this slot -->
             <template #item.actions="{ item }">
                <div class="d-flex gap-1">
                    <VBtn
                        icon
                        size="small"
                        variant="text"
                        color="primary"
                        @click="$emit('edit', item)"
                    >
                        <VIcon icon="mdi-pencil-outline" size="18" />
                        <VTooltip activator="parent">Edit</VTooltip>
                    </VBtn>

                    <VBtn
                        icon
                        size="small"
                        variant="text"
                        color="error"
                        @click="$emit('delete', item)"
                    >
                        <VIcon icon="mdi-trash-can-outline" size="18" />
                        <VTooltip activator="parent">Delete</VTooltip>
                    </VBtn>
                </div>
             </template>

             <!-- Allow parent to override any column -->
             <template
                v-for="(_, name) in $slots"
                #[name]="slotProps"
             >
                <slot
                    :name="name"
                    v-bind="slotProps ?? {}"
                />
             </template>
        </VDataTable>
    </VCard>
</template>
