import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('../views/SignupView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/no-access',
    name: 'no-access',
    component: () => import('../views/NoAccessView.vue'),
    meta: { requiresAdmin: false }
  },
  {
    path: '/',
    name: 'animals',
    component: () => import('../views/AnimalsListView.vue')
  },
  {
    path: '/animals/new',
    name: 'animal-new',
    component: () => import('../views/AnimalFormView.vue')
  },
  {
    path: '/animals/:id',
    name: 'animal-detail',
    component: () => import('../views/AnimalDetailView.vue'),
    props: true
  },
  {
    path: '/animals/:id/edit',
    name: 'animal-edit',
    component: () => import('../views/AnimalFormView.vue'),
    props: true
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'animals' } }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const requiresAuth = to.meta.requiresAuth !== false

  if (!requiresAuth) {
    if ((to.name === 'login' || to.name === 'signup') && auth.isAuthenticated) {
      return auth.isAdmin ? { name: 'animals' } : { name: 'no-access' }
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const requiresAdmin = to.meta.requiresAdmin !== false
  if (requiresAdmin && !auth.isAdmin) {
    return { name: 'no-access' }
  }

  if (to.name === 'no-access' && auth.isAdmin) {
    return { name: 'animals' }
  }

  return true
})
