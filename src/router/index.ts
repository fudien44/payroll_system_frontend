import { useAuthStore } from '@/stores/auth'
import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    layout?: string
    requiresAuth?: boolean
    requiresGuest?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => {
    // always scroll to top
    return { top: 0, behavior: 'smooth' }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/Home.vue'),
      meta: {
        layout: 'content',
        requiresAuth: true,
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: {
        layout: 'blank',
        requiresGuest: true,
      },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPassword.vue'),
      meta: {
        layout: 'blank',
        requiresGuest: true,
      },
    },
    {
      path: '/payroll',
      name: 'payroll',
      component: () => import('@/views/Payroll.vue'),
      meta: {
        layout: 'content',
        requiresAuth: true,
      },
    },
    // {
    //   path: '/employees',
    //   name: 'employees',
    //   component: () => import('@/views/Employees.vue'),
    //   meta: {
    //     layout: 'content',
    //     requiresAuth: true,
    //   },
    // },
    {
      path: '/calendar',
      name: 'CalendarManagement',
      component: () => import('@/views/CalendarManagement.vue'),
      meta: {
        title: 'Calendar Management',
        layout: 'content',
        requiresAuth: true,
      },
    },
    {
      path: '/deductions',
      name: 'Deductions',
      component: () => import('@/views/Deductions.vue'),
      meta: {
        title: 'Deductions',
        layout: 'content',
        requiresAuth: true,
      },
    },
    {
      path: '/engas',
      name: 'Engas',
      component: () => import('@/views/Engas.vue'),
      meta: {
        title: 'ENGAS Reference',
        layout: 'content',
        requiresAuth: true,
      },
    },
    {
      path: '/dtr',
      name: 'DTR',
      component: () => import('@/views/Dtr.vue'),
      meta: {
        title: 'DTR Reference',
        layout: 'content',
        requiresAuth:true,
      },
    },
    {
      path: '/reports',
      name: 'Reports',
      component: () => import('@/views/Reports.vue'),
      meta: {
        title: 'Reports',
        layout: 'content',
        requiresAuth:true,
      },
    },
    {
      path: '/signatories',
      name: 'Signatories',
      component: () => import('@/views/Signatories.vue'),
      meta: {
        title: 'Signatories',
        layout: 'content',
        requiresAuth:true,
      },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/Register.vue'),
      meta: {
        layout: 'blank',
        requiresGuest: true,
      },
    },
    {
      path: '/blank',
      name: 'blank',
      component: () => import('@/views/Blank.vue'),
      meta: {
        layout: 'blank',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/NotFound.vue'),
      meta: {
        layout: 'blank',
      },
    },
  ],
})

router.beforeEach(async (to, _from) => {
  const authStore = useAuthStore()

  const isLoggedIn = authStore.isAuthenticated

  if (to.meta.requiresAuth && !isLoggedIn) {
    return { 
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresGuest && isLoggedIn) {
    return { name: 'home' }
  }

  return true
})

export default router
