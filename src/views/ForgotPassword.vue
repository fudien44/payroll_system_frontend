<script setup lang="ts">
import { VForm } from 'vuetify/components/VForm'
import { useRouter } from 'vue-router'
import axios from '@axios'
import Logo from '@/components/Logo.vue'

const forgetPasswordForm = ref<VForm>()
const router = useRouter()

const email = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function handleForgotPassword() {
  errorMessage.value = ''
  successMessage.value = ''

  const { valid } = await forgetPasswordForm.value!.validate()
  if (!valid) return

  isLoading.value = true

  try {
    const { data } = await axios.post('/api/password/email', { email: email.value })
    successMessage.value = data.message
  } catch (e: any) {
    errorMessage.value = e.response?.data?.message || 'Something went wrong. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <VCard
      max-width="900"
      :width="$vuetify.display.smAndDown ? '500' : 'auto'"
    >
      <VRow no-gutters>
        <!-- 👈 Left side — forgot password form -->
        <VCol
          cols="12"
          md="6"
          class="d-flex flex-column justify-center pa-10 position-relative"
          style="block-size: 36rem; background: #0b1612;"
        >
          <!-- Logo + System name -->
          <div class="d-flex align-center gap-3 mb-8">
            <div
              class="d-flex align-center justify-center"
              style="
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, #285c4d, #1a3d33);
                flex-shrink: 0;
              "
            >
              <Logo style="width: 26px; height: 26px; color: white;" />
            </div>
            <div>
              <h5
                class="mb-0 font-weight-bold"
                style="color: white; font-size: 1rem; line-height: 1.2;"
              >
                JO Payroll System
              </h5>
              <span style="color: rgba(255,255,255,0.35); font-size: 0.7rem; letter-spacing: 0.4px;">
                HRMIS PORTAL
              </span>
            </div>
          </div>

          <!-- Heading -->
          <div class="mb-6">
            <h3
              class="font-weight-bold mb-1"
              style="color: white; font-size: 1.5rem;"
            >
              Forgot Password? 🔑
            </h3>
            <p
              class="mb-0"
              style="color: rgba(255,255,255,0.45); font-size: 0.82rem;"
            >
              Enter your email and we'll send you instructions to reset your password.
            </p>
          </div>

          <!-- Error alert -->
          <VAlert
            v-if="errorMessage"
            color="error"
            variant="tonal"
            class="mb-5"
            closable
            density="default"
            @click:close="errorMessage = ''"
          >
            {{ errorMessage }}
          </VAlert>

          <!-- Success alert -->
          <VAlert
            v-if="successMessage"
            color="success"
            variant="tonal"
            class="mb-5"
            closable
            density="default"
            @click:close="successMessage = ''"
          >
            {{ successMessage }}
          </VAlert>

          <!-- Form -->
          <VForm
            ref="forgetPasswordForm"
            @submit.prevent="handleForgotPassword"
          >
            <div class="mb-6">
              <label
                class="d-block mb-1"
                style="color: rgba(255,255,255,0.55); font-size: 0.75rem; letter-spacing: 0.4px;"
              >
                EMAIL ADDRESS
              </label>
              <VTextField
                v-model="email"
                placeholder="Enter your email address"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                :rules="[
                  v => !!v || 'Email is required',
                  v => /.+@.+\..+/.test(v) || 'Enter a valid email address',
                ]"
                variant="outlined"
                density="comfortable"
                bg-color="#112318"
                base-color="rgba(255,255,255,0.15)"
                color="#285c4d"
                hide-details="auto"
                style="border-radius: 10px;"
              />
            </div>

            <!-- Submit -->
            <VBtn
              block
              type="submit"
              size="large"
              :loading="isLoading"
              :disabled="isLoading"
              class="mb-3"
              style="
                background: linear-gradient(135deg, #285c4d, #1a3d33);
                color: white;
                border-radius: 10px;
                font-weight: 600;
                letter-spacing: 0.5px;
                box-shadow: 0 4px 20px rgba(40, 92, 77, 0.5);
              "
            >
              Send Reset Link
            </VBtn>

            <!-- Back to login -->
            <VBtn
              block
              variant="text"
              size="small"
              prepend-icon="mdi-chevron-double-left"
              :to="{ name: 'login' }"
              style="color: rgba(255,255,255,0.45); font-size: 0.78rem;"
            >
              Back to Login
            </VBtn>
          </VForm>
        </VCol>

        <!-- 👉 Right side — branded hero panel -->
        <VCol
          cols="6"
          class="d-none d-md-flex flex-column align-center justify-center pa-10 border-s position-relative overflow-hidden"
          style="background: linear-gradient(145deg, #1a3d33 0%, #285c4d 50%, #32725f 100%); block-size: 36rem;"
        >
          <!-- Decorative background circles -->
          <div
            style="
              position: absolute;
              width: 320px;
              height: 320px;
              border-radius: 50%;
              border: 1.5px solid rgba(255,255,255,0.08);
              top: -80px;
              right: -80px;
            "
          />
          <div
            style="
              position: absolute;
              width: 200px;
              height: 200px;
              border-radius: 50%;
              border: 1.5px solid rgba(255,255,255,0.06);
              bottom: -50px;
              left: -50px;
            "
          />
          <div
            style="
              position: absolute;
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background: rgba(255,255,255,0.04);
              top: 60px;
              left: 40px;
            "
          />

          <!-- Logo -->
          <div class="mb-4">
            <Logo style="width: 64px; height: 64px; color: white;" />
          </div>

          <!-- System name -->
          <h2
            class="text-center font-weight-bold mb-1"
            style="color: white; font-size: 1.4rem; letter-spacing: 0.5px;"
          >
            JO Payroll System
          </h2>

          <!-- Tagline -->
          <p
            class="text-center mb-8"
            style="color: rgba(255,255,255,0.6); font-size: 0.85rem; letter-spacing: 0.3px;"
          >
            Streamline your payroll, effortlessly.
          </p>

          <!-- Bottom badge -->
          <div
            class="mt-10 px-4 py-2 d-flex align-center gap-2"
            style="
              border-radius: 999px;
              background: rgba(255,255,255,0.1);
              border: 1px solid rgba(255,255,255,0.15);
            "
          >
            <VIcon
              icon="mdi-shield-check-outline"
              size="14"
              color="white"
            />
            <span style="color: rgba(255,255,255,0.7); font-size: 0.72rem; letter-spacing: 0.4px;">
              Secured & integrated with HRMIS
            </span>
          </div>
        </VCol>
      </VRow>
    </VCard>
  </div>
</template>

<style lang="scss">
@use "@styles/pages/auth.scss";
</style>