<script setup lang="ts">
interface Props {
    modelValue: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    title: 'Are you sure?',
    message: 'This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    loading: false,
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
        width="420"
        :persistent="loading"
        @update:model-value="emit('update:modelValue', $event)"
    >
        <VCard>
            <!-- Icon + Title -->
            <VCardText class="text-center pa-6">
                <VAvatar
                color="error"
                variant="tonal"
                size="64"
                class="mb-4"
                >
                <VIcon
                    icon="mdi-trash-can-outline"
                    size="32"
                />
                </VAvatar>

                <h6 class="text-h6 font-weight-bold mb-2">
                {{ title }}
                </h6>

                <p class="text-body-2 text-medium-emphasis mb-0">
                {{ message }}
                </p>
            </VCardText>

            <VDivider />

            <!-- Actions -->
            <VCardActions class="pa-4 justify-center gap-3">
                <VBtn
                variant="tonal"
                color="secondary"
                :disabled="loading"
                min-width="120"
                @click="close"
                >
                {{ cancelText }}
                </VBtn>

                <VBtn
                color="error"
                :loading="loading"
                :disabled="loading"
                min-width="120"
                @click="confirm"
                >
                {{ confirmText }}
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>