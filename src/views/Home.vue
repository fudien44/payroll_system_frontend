<script setup lang="ts">
import BaseCard from '@/components/base/BaseCard.vue'
</script>

<template>
  <VRow>
    <VCol cols="12">
      <h4 class="text-h4 mb-6">
        Dashboard
      </h4>
    </VCol>

    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <BaseCard
        title="Total Employees"
        value="124"
        icon="mdi-account-group-outline"
        color="primary"
        :trend="12"
      />
    </VCol>

    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <BaseCard
        title="Net Pay This Month"
        value="₱1,240,000"
        icon="mdi-cash-multiple"
        color="success"
        :trend="-3"
      />
    </VCol>

    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <BaseCard
        title="Pending Payroll"
        value="8"
        icon="mdi-clock-outline"
        color="warning"
      />
    </VCol>

    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <BaseCard
        title="Departments"
        value="12"
        icon="mdi-office-building-outline"
        color="info"
      />
    </VCol>
  </VRow>
</template>