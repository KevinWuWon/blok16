import './assets/main.css'
import { createApp } from 'vue'
import { convexVue } from 'convex-vue'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// Convex initialization
const convexUrl = import.meta.env.VITE_CONVEX_URL as string

if (!convexUrl) {
  console.error("VITE_CONVEX_URL not set! Convex will not work.")
  console.error("Run 'npx convex dev' and add VITE_CONVEX_URL to your .env file")
}

app.use(router)
app.use(convexVue, {
  url: convexUrl || "https://placeholder.convex.cloud"
})
app.use(ui)
app.mount('#app')
