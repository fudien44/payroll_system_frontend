<script setup lang="ts">
interface Header {
  title: string;
  key: string;
  sortable?: boolean;
  align?: "start" | "center" | "end";
}

interface Props {
  headers: Header[];
  items: Record<string, any>[];
  loading?: boolean;
  searchable?: boolean;
  title?: string;
  itemsPerPage?: number;
  filterKeys?: string[];
  searchDataTour?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  searchable: true,
  title: "",
  itemsPerPage: 10,
  filterKeys: undefined,
  searchDataTour: undefined,
});

const emit = defineEmits<{
  (e: "edit", item: Record<string, any>): void;
  (e: "delete", item: Record<string, any>): void;
  (e: "update:visible-items", items: Record<string, any>[]): void; // NEW
}>();

const search = ref("");
const page = ref(1); // NEW — tracks current page for visible-item calculation

const searchKeys = computed(
  () => props.filterKeys ?? props.headers.map((h) => h.key),
);

const filteredItems = computed(() => {
  const q = (search.value ?? "").trim().toLowerCase();
  if (!q) return props.items;
  return props.items.filter((item) =>
    searchKeys.value.some((key) =>
      String(item[key] ?? "")
        .toLowerCase()
        .includes(q),
    ),
  );
});

// NEW — reset to page 1 whenever the filtered set changes shape (new search,
// or the underlying items array itself changes), so we never emit a stale
// out-of-range page's worth of "visible" items.
watch(filteredItems, () => {
  page.value = 1;
});

// NEW — approximation: slices filteredItems by page position, ignoring
// VDataTable's internal sort-by state. Good enough for a prefetch hint
// (e.g. employee photos); a slightly-off row set here just means we
// prefetch a couple extra/fewer photos, never a correctness issue.
const visibleItems = computed(() => {
  const start = (page.value - 1) * props.itemsPerPage;
  return filteredItems.value.slice(start, start + props.itemsPerPage);
});

watch(visibleItems, (items) => emit("update:visible-items", items), {
  immediate: true,
});
</script>

<template>
  <VCard>
    <VCardText
      class="d-flex align-center justify-space-between flex-wrap gap-4 pb-0"
    >
      <h6 v-if="title" class="text-h6">{{ title }}</h6>
      <VTextField
        v-if="searchable"
        v-model="search"
        density="compact"
        placeholder="Search..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        hide-details
        clearable
        style="max-width: 300px"
        :data-tour="searchDataTour"
      />
    </VCardText>

    <VDataTable
      v-model:page="page"
      :headers="headers"
      :items="filteredItems"
      :loading="loading"
      :items-per-page="itemsPerPage"
      class="text-no-wrap"
    >
      <!-- Loading state -->
      <template #loading>
        <VSkeletonLoader type="table-row@5" />
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
          <p class="text-medium-emphasis">No records found</p>
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
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </VDataTable>
  </VCard>
</template>
