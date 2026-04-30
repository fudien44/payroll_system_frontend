<script setup lang="ts">
interface Props {
    title?: string
    modelValue: boolean
    width?: string | number
    persistent?: boolean
    loading?: boolean
    confirmText?: string
    cancelText?: string
    hideActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    title: '',
    width: '600',
    persistent: false,
    loading: false,
    confirmText: 'Save',
    cancelText: 'Cancel',
    hideActions: false,
})

const emit = defineEmits<{
    (e: 'update:modelValue', val: boolean): void
    (e: 'confirm'): void
    (e: 'cancel'): void
}>()

function close() {
    emit('update:modelValue', false)
    emit('cancel')
}

function confirm() {
    emit('confirm')
}
</script>

<template>
    <VDialog
        :model-value="modelValue"
        :width="width"
        :persistent="persistent || loading"
        @update:model-value="emit('update:modelValue', $event)"
    >
        <VCard>
            <!-- Header -->
             <VCardTitle class="d-flex align-center justify-space-between pa-4 pb-2">
                <span class="text-h6">{{ title }}</span>
                <VBtn
                    icon
                    variant="text"
                    size="small"
                    :disabled="loading"
                    @click="close"
                >
                    <VIcon icon="mdi-close" />
                </VBtn>
            </VCardTitle>

            <VDivider/>

            <!-- Body — put your form or content here via slot -->
            <VCardText class="pa-4">
                <slot />
            </VCardText>

                     <VDivider />

                    <!-- Footer actions -->
                    <VCardActions
                        v-if="!hideActions"
                        class="pa-4 pt-3 justify-end gap-3"
                    >
                        <VBtn
                        variant="tonal"
                        color="secondary"
                        :disabled="loading"
                        @click="close"
                        >
                        {{ cancelText }}
                        </VBtn>

                        <VBtn
                        color="primary"
                        :loading="loading"
                        :disabled="loading"
                        @click="confirm"
                        >
                        {{ confirmText }}
                        </VBtn>
                    </VCardActions>
        </VCard>
    </VDialog>
</template>