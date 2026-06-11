import axios from '@axios'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// --- Interfaces ---

interface HrPos {
  id: number
  position: string
}

interface HrSec {
  id: number
  station: string
}

interface HrDiv {
  id: number
  description: string
}

interface HrInfo {
  id: number
  emp_id: number
  position_id: number | null
  section_id: number | null
  division_id: number | null
  pos: HrPos | null
  sec: HrSec | null
  div: HrDiv | null
}

interface EmpInfo {
  id: number
  first_name: string
  middle_name: string
  sur_name: string
  picture_link: string | null
  hrinfo: HrInfo | null
}

interface User {
  id: number
  emp_id: number
  username: string
  email: string | null
  email_verified_at: string | null
  level: string
  last_login: string | null
  login_status: string
  status: string
  created_at: string | null
  updated_at: string
  void: number
  is_committee: number
  is_division_head: string
  is_hr_admin: string
  is_pdoho_head: number
  is_section_head: string
  is_superadmin: string
  info: EmpInfo | null
}

// --- Helpers ---

function getStoredUser(): User | null {
  const raw = localStorage.getItem('auth_user')
  if (!raw || raw === 'undefined') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getStoredProfile(): string | null {
  return localStorage.getItem('auth_profile') || null
}

// --- Store ---

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(getStoredUser())
  const profile = ref<string | null>(getStoredProfile()) // base64 string
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // --- Computed ---

  const fullName = computed(() => {
    if (!user.value?.info) return ''
    const { first_name, middle_name, sur_name } = user.value.info
    return [first_name, middle_name, sur_name].filter(Boolean).join(' ').trim()
  })

  const position = computed(() => user.value?.info?.hrinfo?.pos?.position || '')
  const section = computed(() => user.value?.info?.hrinfo?.sec?.station || '')
  const division = computed(() => user.value?.info?.hrinfo?.div?.description || '')

  const isSuperAdmin = computed(() => user.value?.is_superadmin === '1')
  const isHrAdmin = computed(() => user.value?.is_hr_admin === '1')
  const isSectionHead = computed(() => user.value?.is_section_head === '1')
  const isDivisionHead = computed(() => user.value?.is_division_head === '1')
  const isCommittee = computed(() => user.value?.is_committee === 1)
  const isPdohoHead = computed(() => user.value?.is_pdoho_head === 1)

  // --- Actions ---

  function setUser(data: User) {
    user.value = data
    localStorage.setItem('auth_user', JSON.stringify(data))
  }

  function setProfile(base64: string) {
    profile.value = base64
    localStorage.setItem('auth_profile', base64)
  }

  async function fetchUser(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const { data } = await axios.get<User>('/api/employee/me')
      setUser(data)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to fetch user.'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProfile(): Promise<void> {
    try {
      const { data } = await axios.get('/api/employee/profile-pic', {
        responseType: 'blob',
      })

      // Convert blob → base64 and persist properly (fixes the bug from the reference project)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read profile picture.'))
        reader.readAsDataURL(data)
      })

      setProfile(base64)
    } catch {
      // Non-fatal: profile picture failure should not block login
      profile.value = null
    }
  }

  function clearUser() {
    user.value = null
    profile.value = null
    error.value = null
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_profile')
  }

  return {
    user,
    profile,
    isLoading,
    error,
    fullName,
    position,
    section,
    division,
    isSuperAdmin,
    isHrAdmin,
    isSectionHead,
    isDivisionHead,
    isCommittee,
    isPdohoHead,
    fetchUser,
    fetchProfile,
    setUser,
    setProfile,
    clearUser,
  }
})
