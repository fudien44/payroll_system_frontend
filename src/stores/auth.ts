import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from '@axios'
import { useUserStore } from '@/stores/user'
import { usePayrollStore } from '@/stores/payroll'

export const useAuthStore = defineStore('auth', () => {
    const token = ref<string | null>(localStorage.getItem('auth_token'))

    const isAuthenticated = computed(() => !!token.value)

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

    async function login(credentials: { username: string; password: string }) {
        // const { data } = await axios.post('/api/auth/login', credentials)
        // setToken(data.accessToken) //adjust if your Laravel response key differs

        // localStorage.setItem('auth_user', JSON.stringify({
        //     name: data.name
        // }))

        // const userStore = useUserStore()
        // userStore.setUser({ name: data.name })

        const MOCK_USERNAME = 'admin123'
        const MOCK_PASSWORD = 'admin123'

        if (credentials.username === MOCK_USERNAME && credentials.password === MOCK_PASSWORD) {
            setToken('mock-token-123')
            return
        }

        throw { response: { data: { message: 'Invalid credentials.' } } }
    }

    async function logout() {
        // try {
        //     await axios.get('/api/auth/logout')
        // } finally {
        //     clearToken()
        //     useUserStore().clearUser() //clear user profile on logout
        //     usePayrollStore().clearPayroll() //clear payroll data on logout
        // }

        clearToken()
        useUserStore().clearUser()
        usePayrollStore().clearPayroll()
    }

    function initialize() {
        if (token.value) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`

            const storedUser = localStorage.getItem('auth_user')
            if (storedUser) {
                useUserStore().setUser(JSON.parse(storedUser))
            }
        }
    }

    return {
        token,
        isAuthenticated,
        login,
        logout,
        initialize,
    }
})