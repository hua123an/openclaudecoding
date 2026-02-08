import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './styles/global.scss'
import '@xterm/xterm/css/xterm.css'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
