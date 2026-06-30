<script setup lang="ts">
interface Props {
    modelValue: boolean
    message?: string
    type?: 'success' | 'error' | 'warning' | 'info'
    timeout?: number
}

const props = withDefaults(defineProps<Props>(), {
    message: '',
    type: 'success',
    timeout: 3000,
})

const emit = defineEmits<{
    (e: 'update:modelValue', val: boolean): void
}>()

const typeIcon = computed(() => {
    const icon = {
        success: 'mdi-check-circle-outline',
        error: 'mdi-alert-circle-outline',
        warning: 'mdi-alert-outline',
        info: 'mdi-information-outline',
    }
    return icon[props.type]
})
</script>

<template>
    <VSnackbar
    :model-value="modelValue"
    :timeout="timeout"
    :color="type"
    location="bottom end"
    variant="flat"
    elevation="8"
    @update:model-value="emit('update:modelValue', $event)"
>
        <div class="d-flex align-center gap-3">
            <VIcon :icon="typeIcon" />
            <span>{{ message }}</span>
        </div>

        <template #actions>
            <VBtn
                icon
                variant="text"
                size="small"
                @click="emit('update:modelValue', false)"
            >
                <VIcon icon="mdi-close" />
            </VBtn>
        </template>
    </VSnackbar>
</template>
