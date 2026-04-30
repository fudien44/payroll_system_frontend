<template>
  <!-- Buy now button -->
  <VBtn
    color="error"
    class="buy-now-btn d-print-none"
    prepend-icon="mdi-cart-outline"
    size="large"
    elevation="8"
    href="https://tinyurl.com/prime-dash-buy"
  >
    Buy Now
  </VBtn>
</template>

<style lang="scss">
.buy-now-btn {
  position: fixed !important;
  z-index: 901;
  inset-block-end: 3rem;
  inset-inline-end: 6.4rem;
}
</style>
