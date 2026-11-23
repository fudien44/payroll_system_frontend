<script setup lang="ts">
const isDevSite = window.location.port === '8090'
const message = '⚠ TEST SITE — FOR DEVELOPMENT ONLY. DO NOT ENCODE LIVE DATA. ⚠ ⚠ TEST SITE — FOR DEVELOPMENT ONLY. DO NOT ENCODE LIVE DATA. ⚠'
</script>

<template>
  <VSystemBar
    v-if="isDevSite"
    color="error"
    height="28"
    class="dev-site-banner d-print-none"
  >
    <div class="dev-site-banner__track">
      <span>{{ message }}</span>
      <span aria-hidden="true">{{ message }}</span>
    </div>
  </VSystemBar>
</template>

<style scoped>
.dev-site-banner {
  overflow: hidden;
  padding: 0 !important;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.dev-site-banner__track {
  display: flex;
  white-space: nowrap;
  animation: dev-site-scroll 25s linear infinite;
}

.dev-site-banner__track span {
  padding-right: 6rem;
}

@keyframes dev-site-scroll {
  from { transform: translateX(100vw); }
  to   { transform: translateX(-100%); }
}

@media (prefers-reduced-motion: reduce) {
  .dev-site-banner__track { animation: none; justify-content: center; width: 100%; }
  .dev-site-banner__track span[aria-hidden] { display: none; }
}
</style>
