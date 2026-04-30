<script setup lang="ts">
import type { Menu } from '@plugins/apis/types'

interface Props {
  data?: Menu
  isDialogVisible: boolean
}

interface Emit {
  (e: 'update:isDialogVisible', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  data: () => ({
    img: '',
    name: '',
    type: '',
    desc: '',
    price: 0,
    tax: 0,
  }),
})

const emit = defineEmits<Emit>()

const menu = ref(structuredClone(toRaw(props.data)))

watch(() => props.data, () => {
  menu.value = structuredClone(toRaw(props.data))
})

const close = (val: boolean) => {
  emit('update:isDialogVisible', val)
}
</script>

<template>
  <VDialog
    :model-value="isDialogVisible"
    width="600"
    @update:model-value="(val) => close(val)"
  >
    <VCard>
      <VCardText class="mb-6 text-center">
        <h6 class="text-h4">
          {{ menu.name ? 'Edit' : 'Add' }} Menu
        </h6>
      </VCardText>

      <VCardText>
        <VForm>
          <VRow>
            <VCol
              v-if="menu.img"
              cols="12"
            >
              <VImg
                :src="menu.img"
                height="200"
                class="rounded"
              />
            </VCol>
            <VCol cols="12">
              <VFileInput label="File input" />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="menu.name"
                label="Name"
              />
            </VCol>

            <VCol cols="12">
              <VTextarea
                v-model="menu.desc"
                rows="2"
                label="Description"
              />
            </VCol>

            <VCol cols="12">
              <VSelect
                v-model="menu.type"
                label="Category"
                :items="['Appetizer', 'Salad', 'Main Course', 'Dessert', 'Beverages']"
              />
            </VCol>

            <VCol cols="12">
              <VTextField
                v-model="menu.price"
                label="Price"
              />
            </VCol>

            <VCol cols="12">
              <VTextField
                v-model="menu.tax"
                label="Tax (in %)"
              />
            </VCol>

            <VCol cols="12">
              <VBtn
                color="primary"
                class="me-3"
              >
                Submit
              </VBtn>

              <VBtn
                color="error"
                variant="outlined"
                @click="close(false)"
              >
                Cancel
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
