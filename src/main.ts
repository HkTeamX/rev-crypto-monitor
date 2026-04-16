import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router/index.ts'
import { useDisableContextmenu } from '@/utils/useDisableContextmenu.ts'
import '@/assets/css/index.css'

useDisableContextmenu()

const app = createApp(App)
app.use(router)
app.mount('#app')
