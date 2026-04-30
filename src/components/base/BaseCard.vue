<script setup lang="ts">
interface Props {
    title: string
    value: string | number
    icon: string
    color?: string
    trend?: number //positive=up, negative=down, undefined=no trend
}

const props = withDefaults(defineProps<Props>(), {
    color: 'primary',
    trend: undefined,
})

const trendColor = computed(() => {
    if (props.trend === undefined) return ''
    return props.trend >= 0 ? 'success' : 'error'
})

const trendIcon = computed(() => {
    if (props.trend === undefined) return ''
    return props.trend >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'
})
</script>

<template>
    <VCard>
        <VCardText>
            <div class="d-flex align-center justify-space-between mb-4">
                <VAvatar 
                    :color="color" 
                    variant="tonal"
                    size="48"
                    rounded="lg" 
                >
                    <VIcon :icon="icon" size="24" />
                </VAvatar>

                <VChip
                    v-if="trend != undefined"
                    :color="trendColor"
                    size="small"
                    variant="tonal"
                    label
                >
                    <VIcon start :icon="trendIcon" size="14"/>
                    {{ Math.abs(trend) }}%
                </VChip>
            </div>

            <h4 class="text-h4 font-weight-bold mb-1">
                {{ value }}
            </h4>

            <span class="text-body-2 text-medium-emphasis">
                {{ title }}
            </span>
        </VCardText>
    </VCard>
</template>