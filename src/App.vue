<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMovementStore } from '@/stores/movement'
import {
  Gauge,
  Settings,
  Watch,
  Activity,
  Scissors,
  FolderOpen,
  BookOpen,
  Home
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const movementStore = useMovementStore()

const currentPath = computed(() => route.path)

const menuItems = [
  { path: '/', icon: Home, label: '工作台' },
  { path: '/movement', icon: Watch, label: '机芯录入' },
  { path: '/diagnosis', icon: Activity, label: '等时诊断' },
  { path: '/hairspring', icon: Scissors, label: '游丝配平' },
  { path: '/archive', icon: FolderOpen, label: '维修档案' },
  { path: '/reference', icon: BookOpen, label: '参照库' }
]

const currentMovementInfo = computed(() => {
  const m = movementStore.currentMovement
  if (!m) return null
  return `${m.brand || ''} ${m.model || ''} ${m.serial ? '#' + m.serial : ''}`.trim()
})

function navigateTo(path: string) {
  router.push(path)
}

onMounted(() => {
  movementStore.loadReferences()
  movementStore.loadMovements()
})
</script>

<template>
  <div class="flex h-screen bg-[var(--bg-primary)]">
    <aside class="w-56 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col">
      <div class="p-5 border-b border-[var(--border-color)]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-gold)] to-[var(--accent-gold-light)] flex items-center justify-center">
            <Gauge class="w-6 h-6 text-[var(--bg-primary)]" />
          </div>
          <div>
            <h1 class="text-lg font-bold text-[var(--accent-gold)]">擒纵调校</h1>
            <p class="text-xs text-[var(--text-muted)]">精密诊断系统</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 py-4">
        <div v-for="item in menuItems" :key="item.path"
             @click="navigateTo(item.path)"
             class="flex items-center gap-3 px-5 py-3 cursor-pointer transition-all duration-200"
             :class="currentPath === item.path
               ? 'bg-[var(--bg-tertiary)] text-[var(--accent-gold)] border-r-2 border-[var(--accent-gold)]'
               : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'">
          <component :is="item.icon" class="w-5 h-5" />
          <span class="text-sm font-medium">{{ item.label }}</span>
        </div>
      </nav>

      <div v-if="currentMovementInfo" class="p-4 border-t border-[var(--border-color)]">
        <p class="text-xs text-[var(--text-muted)] mb-1">当前机芯</p>
        <p class="text-sm text-[var(--accent-gold)] font-mono truncate">{{ currentMovementInfo }}</p>
      </div>

      <div class="p-4 border-t border-[var(--border-color)]">
        <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Settings class="w-4 h-4" />
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>

    <main class="flex-1 overflow-hidden flex flex-col">
      <header class="h-14 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-6">
        <h2 class="text-lg font-medium text-[var(--text-primary)]">
          {{ menuItems.find(m => m.path === currentPath)?.label }}
        </h2>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="text-xs text-[var(--text-muted)]">{{ new Date().toLocaleDateString('zh-CN') }}</p>
            <p class="text-sm text-[var(--accent-gold)] font-mono">{{ new Date().toLocaleTimeString('zh-CN') }}</p>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-auto p-6">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>