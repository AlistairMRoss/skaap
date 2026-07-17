import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useAuthStore } from './stores/auth'
import { configureApi } from './lib/api'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const auth = useAuthStore(pinia)
configureApi({
  getToken: () => auth.accessToken,
  refresh: () => auth.refresh()
})

auth
  .init()
  .catch((err) => console.error('Auth init failed', err))
  .finally(() => {
    app.use(router)
    app.mount('#app')
  })
