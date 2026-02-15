import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/session/:id',
      name: 'session',
      component: { render: () => null },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/plugins',
      name: 'plugins',
      component: () => import('../views/PluginView.vue'),
    },
  ],
})

export default router
