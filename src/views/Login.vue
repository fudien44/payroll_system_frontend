<script setup lang="ts">
import Logo from '@/components/Logo.vue'
import { useAuthStore } from '@/stores/auth'
import authBgDark from '@images/pages/auth-bg-dark.svg'
import authBgLight from '@images/pages/auth-bg-light.svg'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { VForm } from 'vuetify/components/VForm'

const loginForm = ref<VForm>()
const isPasswordVisible = ref(false)
const theme = useTheme()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isLoading = ref(false)
const errorMessage = ref('')

const loginData = ref({
  username: '',
  password: '',
})

const authBgThemeVariant = computed(() => {
  return theme.current.value.dark ? authBgDark : authBgLight
})

// Right panel — hero/brand side (stays dark for now, structured for future light swap)
const rightPanelStyle = computed(() => ({
  background: 'linear-gradient(145deg, #1a3d33 0%, #285c4d 50%, #32725f 100%)',
  blockSize: '38rem',
}))

async function handleLogin() {
  errorMessage.value = ''

  const { valid } = await loginForm.value!.validate()
  if (!valid) return

  isLoading.value = true

  try {
    await authStore.login(loginData.value)

    const redirectTo = route.query.redirect as string || '/'
    router.push(redirectTo)
  } catch (e: any) {
    errorMessage.value = e.response?.data?.message || 'Invalid credentials. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const features = [
  {
    icon: 'mdi-calculator-variant-outline',
    title: 'Automated Computation',
    text: 'Accurate payroll processed in seconds',
  },
  {
    icon: 'mdi-clock-check-outline',
    title: 'Attendance Tracking',
    text: 'Real-time monitoring and reporting',
  },
  {
    icon: 'mdi-account-group-outline',
    title: 'HRMIS Integration',
    text: 'Synced directly with your HR records',
  },
]
</script>

<template>
  <div class="auth-wrapper">
    <VCard
      max-width="900"
      :width="$vuetify.display.smAndDown ? '500' : 'auto'"
    >
      <VRow no-gutters>
        <!-- 👈 Left side — login form -->
        <VCol
          cols="12"
          md="6"
          class="d-flex flex-column justify-center pa-10 position-relative"
          style="block-size: 38rem;"
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
                class="mb-0 font-weight-bold text-high-emphasis"
                style="font-size: 1rem; line-height: 1.2;"
              >
                JO Payroll System
              </h5>
              <span class="text-medium-emphasis" style="font-size: 0.7rem; letter-spacing: 0.4px;">
                HRMIS PORTAL
              </span>
            </div>
          </div>

          <!-- Heading -->
          <div class="mb-6">
            <h3
              class="font-weight-bold mb-1 text-high-emphasis"
              style="font-size: 1.5rem;"
            >
              Welcome... 👋
            </h3>
            <p
              class="mb-0 text-medium-emphasis"
              style="font-size: 0.82rem;"
            >
              Please sign in with your HRMIS account to continue.
            </p>
          </div>

          <!-- Error alert -->
          <VAlert
            v-if="errorMessage"
            color="error"
            variant="tonal"
            class="mb-5 mt-1"
            closable
            density="default"
            @click:close="errorMessage = ''"
          >
            {{ errorMessage }}
          </VAlert>

          <!-- Form -->
          <VForm
            ref="loginForm"
            @submit.prevent="handleLogin"
          >
            <div class="mb-4">
              <label
                class="d-block mb-1 text-medium-emphasis"
                style="font-size: 0.75rem; letter-spacing: 0.4px;"
              >
                USERNAME
              </label>
              <VTextField
                v-model="loginData.username"
                placeholder="Enter your username"
                type="text"
                prepend-inner-icon="mdi-account-outline"
                :rules="[v => !!v || 'Username is required']"
                variant="outlined"
                density="comfortable"
                color="#285c4d"
                hide-details="auto"
                style="border-radius: 10px;"
              />
            </div>

            <div class="mb-2">
              <label
                class="d-block mb-1 text-medium-emphasis"
                style="font-size: 0.75rem; letter-spacing: 0.4px;"
              >
                PASSWORD
              </label>
              <VTextField
                v-model="loginData.password"
                placeholder="Enter your password"
                :type="isPasswordVisible ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="isPasswordVisible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                :rules="[v => !!v || 'Password is required']"
                variant="outlined"
                density="comfortable"
                color="#285c4d"
                hide-details="auto"
                style="border-radius: 10px;"
                @click:append-inner="isPasswordVisible = !isPasswordVisible"
              />
            </div>

            <!-- Forgot password -->
            <div class="text-end mb-6">
              <RouterLink
                to="/forgot-password"
                style="color: #285c4d; font-size: 0.78rem; text-decoration: none;"
              >
                Forgot Password?
              </RouterLink>
            </div>

            <!-- Submit -->
            <VBtn
              block
              type="submit"
              size="large"
              :loading="isLoading"
              :disabled="isLoading"
              style="
                background: linear-gradient(135deg, #285c4d, #1a3d33);
                color: white;
                border-radius: 10px;
                font-weight: 600;
                letter-spacing: 0.5px;
                box-shadow: 0 4px 20px rgba(40, 92, 77, 0.5);
              "
            >
              Sign In
            </VBtn>
          </VForm>
        </VCol>

        <!-- 👉 Right side — branded hero panel -->
        <VCol
          cols="6"
          class="d-none d-md-flex flex-column align-center justify-center pa-10 border-s position-relative overflow-hidden"
          :style="rightPanelStyle"
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
