import { defineStore } from "pinia"
import { ref } from "vue"

interface SimpleUser {
    name: string
}

export const useUserStore = defineStore('user', () => {
    function getStoredUser(): SimpleUser | null {
        const raw = localStorage.getItem('auth_user')

        if (!raw || raw === 'undefined') return null

        try {
            return JSON.parse(raw)
        } catch {
            return null
        }
    }

    const user = ref<SimpleUser | null>(getStoredUser())

    function setUser(data: SimpleUser) {
        if (!data || !data.name) return
        
        user.value = data
        localStorage.setItem('auth_user', JSON.stringify(data))
    }

    function clearUser() {
        user.value = null
        localStorage.removeItem('auth_user')
    }

    return {
        user,
        setUser,
        clearUser,
    }
})

// import { defineStore } from "pinia"
// import { ref, computed } from "vue"
// import axios from "@axios"

// interface UserInfo {
//     first_name: string
//     sur_name: string
//     middle_name: string
//     hrinfo: {
//         pos: { position: string } | null
//         sec: { section: string } | null
//         div: { division: string } | null
//     } | null
// }

// interface User {
//     id: number
//     email: string
//     emp_id: number
//     info: UserInfo | null
// }

// export const useUserStore = defineStore('user', () => {
//     const user = ref<User | null>(
//         JSON.parse(localStorage.getItem('auth_user') || 'null')
//     )
//     const isLoading = ref(false)
//     const error = ref<string | null>(null)

//     const fullName = computed(() => {
//         if (!user.value?.info) return ''
//         const { first_name, middle_name, sur_name } = user.value.info
//         return `${first_name} ${middle_name} ${sur_name}`.trim()
//     })

//     const position = computed(() => user.value?.info?.hrinfo?.pos?.position || '')
//     const section = computed(() => user.value?.info?.hrinfo?.sec?.section || '')
//     const division = computed(() => user.value?.info?.hrinfo?.div?.division || '')

//     function setUser(data: User) {
//         user.value = data
//         localStorage.setItem('auth_user', JSON.stringify(data))
//     }

//     async function fetchUser() {
//         isLoading.value = true
//         error.value = null
//         try {
//             const { data } = await axios.get('/api/me') // Adjust endpoint as needed
//             setUser(data)
//         } catch (e: any) {
//             error.value = e.response?.data?.message || 'Failed to fetch user'
//         } finally {
//             isLoading.value = false
//         }
//     }

//     function clearUser() {
//         user.value = null
//         error.value = null
//         localStorage.removeItem('auth_user')
//     }

//     return {
//         user,
//         isLoading,
//         error,
//         fullName,
//         position,
//         section,
//         division,
//         fetchUser,
//         setUser,
//         clearUser,
//     }
// })