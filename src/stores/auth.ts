import { usePayrollStore } from '@/stores/payroll'
import { useUserStore } from '@/stores/user'
import axios from '@axios'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'))

  const isAuthenticated = computed(() => !!token.value)

  // --- Token helpers ---

  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('auth_token', newToken)
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
  }

  function clearToken() {
    token.value = null
    localStorage.removeItem('auth_token')
    delete axios.defaults.headers.common['Authorization']
  }

  // --- Auth actions ---

  async function login(credentials: { username: string; password: string }): Promise<void> {
    // 1. Authenticate and get token
    const { data } = await axios.post('/api/auth/login', credentials)
    setToken(data.accessToken)

    const userStore = useUserStore()

    // 2. Fetch full user object from /api/employee/me
    await userStore.fetchUser()

    // 3. Fetch profile picture (non-fatal — won't throw if it fails)
    await userStore.fetchProfile()
  }

  async function logout(): Promise<void> {
    try {
      await axios.get('/api/auth/logout')
    } catch (_) {
      // Proceed with local cleanup even if the server call fails
    } finally {
      clearToken()
      useUserStore().clearUser()       // clears user + profile from state + localStorage
      usePayrollStore().clearPayroll() // clear payroll data
    }
  }

  /**
   * Call this once on app startup (e.g. in App.vue or main.ts).
   * Restores token + user + profile from localStorage if they exist.
   */
  function initialize(): void {
    if (!token.value) return

    // Re-attach token to axios so requests work immediately
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`

    const userStore = useUserStore()

    // useUserStore already reads auth_user + auth_profile from localStorage
    // on creation, so no extra work needed here unless you want a fresh fetch.
    // Uncomment the lines below if you want to always re-validate on app load:
    // userStore.fetchUser().catch(() => clearToken())
    // userStore.fetchProfile()
  }

  return {
    token,
    isAuthenticated,
    login,
    logout,
    initialize,
  }
})
