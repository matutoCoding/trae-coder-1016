import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '工作台' }
  },
  {
    path: '/movement',
    name: 'Movement',
    component: () => import('@/views/MovementInput.vue'),
    meta: { title: '机芯录入' }
  },
  {
    path: '/diagnosis',
    name: 'Diagnosis',
    component: () => import('@/views/Diagnosis.vue'),
    meta: { title: '等时诊断' }
  },
  {
    path: '/hairspring',
    name: 'Hairspring',
    component: () => import('@/views/Hairspring.vue'),
    meta: { title: '游丝配平' }
  },
  {
    path: '/archive',
    name: 'Archive',
    component: () => import('@/views/Archive.vue'),
    meta: { title: '维修档案' }
  },
  {
    path: '/reference',
    name: 'Reference',
    component: () => import('@/views/Reference.vue'),
    meta: { title: '参照库' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
