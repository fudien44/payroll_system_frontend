import axios from 'axios'
import { globals } from '@/globals'

const axiosIns = axios.create({
  // You can add your headers here
  // ================================
  // baseURL: 'https://some-domain.com/api/',
  // timeout: 1000,
  // headers: {'X-Custom-Header': 'foobar'}
})

const axiosInstance = axios.create({
  baseURL: globals.api,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Attach token to every request automatically
axiosInstance.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token)
    config.headers.Authorization = `Bearer ${token}`

  return config
})

// Handle expired/invalid token globally
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default axiosInstance
