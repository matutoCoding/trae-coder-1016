<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMovementStore } from '@/stores/movement'
import { useDiagnosisStore } from '@/stores/diagnosis'
import {
  Watch,
  Activity,
  Scissors,
  FolderOpen,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  Clock,
  Plus,
  ChevronRight
} from 'lucide-vue-next'

const router = useRouter()
const movementStore = useMovementStore()
const diagnosisStore = useDiagnosisStore()

const loading = ref(false)

const quickActions = [
  { path: '/movement', icon: Plus, label: '新建机芯档案', color: 'from-blue-500 to-blue-600' },
  { path: '/diagnosis', icon: Activity, label: '开始等时诊断', color: 'from-green-500 to-green-600' },
  { path: '/hairspring', icon: Scissors, label: '游丝配平计算', color: 'from-yellow-500 to-yellow-600' },
  { path: '/archive', icon: FolderOpen, label: '查询维修档案', color: 'from-purple-500 to-purple-600' }
]

const stats = computed(() => [
  { label: '今日维修', value: movementStore.movements.length, icon: Watch, color: 'text-blue-400' },
  { label: '待调校', value: diagnosisStore.riskAlerts.length, icon: AlertTriangle, color: 'text-yellow-400' },
  { label: '本月完成', value: diagnosisStore.diagnosisHistory.length, icon: TrendingUp, color: 'text-green-400' },
  { label: '参照库', value: movementStore.references.length, icon: BookOpen, color: 'text-purple-400' }
])

const recentMovements = computed(() => {
  return [...movementStore.movements].sort((a, b) =>
    new Date(b.create_time || 0).getTime() - new Date(a.create_time || 0).getTime()
  ).slice(0, 5)
})

const activeAlerts = computed(() => diagnosisStore.riskAlerts.slice(0, 3))

function goTo(path: string) {
  router.push(path)
}

function getAlertCardClass(level: string) {
  return level === 'danger' ? 'bg-red-900/20 border-red-600 alert-pulse' : 'bg-yellow-900/20 border-yellow-600'
}

function getAlertIconClass(level: string) {
  return level === 'danger' ? 'text-red-400' : 'text-yellow-400'
}

function selectMovement(m: any) {
  movementStore.setCurrentMovement(m)
  if (m.id) {
    diagnosisStore.loadDiagnosisHistory(m.id)
    diagnosisStore.loadMaintenanceHistory(m.id)
  }
  router.push('/diagnosis')
}

onMounted(async () => {
  loading.value = true
  await movementStore.loadMovements()
  loading.value = false
})
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-4 gap-4">
      <div v-for="stat in stats" :key="stat.label"
           class="watch-card flex items-center gap-4">
        <div class="w-12 h-12 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
          <component :is="stat.icon" class="w-6 h-6" :class="stat.color" />
        </div>
        <div>
          <p class="text-2xl font-bold text-[var(--text-primary)] font-mono">{{ stat.value }}</p>
          <p class="text-sm text-[var(--text-secondary)]">{{ stat.label }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-4">
      <div v-for="action in quickActions" :key="action.path"
           @click="goTo(action.path)"
           class="watch-card cursor-pointer group hover:scale-[1.02] transition-transform">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center"
               :class="action.color">
            <component :is="action.icon" class="w-5 h-5 text-white" />
          </div>
          <ChevronRight class="w-5 h-5 text-[var(--text-muted)] ml-auto group-hover:translate-x-1 transition-transform" />
        </div>
        <h3 class="text-lg font-medium text-[var(--text-primary)]">{{ action.label }}</h3>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2 watch-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
            <Clock class="w-5 h-5 text-[var(--accent-gold)]" />
            最近机芯档案
          </h3>
          <button @click="goTo('/movement')" class="text-sm text-[var(--accent-gold)] hover:underline">
            查看全部
          </button>
        </div>
        <div v-if="loading" class="h-64 flex items-center justify-center">
          <div class="animate-spin w-8 h-8 border-2 border-[var(--accent-gold)] border-t-transparent rounded-full"></div>
        </div>
        <div v-else-if="recentMovements.length === 0" class="h-64 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Watch class="w-12 h-12 mb-3 opacity-50" />
          <p>暂无机芯档案</p>
          <button @click="goTo('/movement')" class="mt-3 text-[var(--accent-gold)] hover:underline">
            创建第一个机芯档案
          </button>
        </div>
        <div v-else class="space-y-2">
          <div v-for="m in recentMovements" :key="m.id"
               @click="selectMovement(m)"
               class="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                <Watch class="w-5 h-5 text-[var(--accent-gold)]" />
              </div>
              <div>
                <p class="text-[var(--text-primary)] font-medium">{{ m.brand }} {{ m.model }}</p>
                <p class="text-sm text-[var(--text-muted)]">表号: {{ m.serial || '未登记' }} | 客户: {{ m.customer || '未登记' }}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm text-[var(--text-secondary)]">
                {{ m.frequency }} Hz / {{ m.lift_angle }}°
              </p>
              <p class="text-xs text-[var(--text-muted)]">
                {{ new Date(m.create_time || 0).toLocaleDateString('zh-CN') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="watch-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangle class="w-5 h-5 text-[var(--danger)]" />
            风险告警
          </h3>
          <span class="status-badge" :class="activeAlerts.length > 0 ? 'status-poor' : 'status-excellent'">
            {{ activeAlerts.length }} 项
          </span>
        </div>
        <div v-if="activeAlerts.length === 0" class="h-64 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <div class="w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center mb-3">
            <TrendingUp class="w-8 h-8 text-green-400" />
          </div>
          <p class="text-green-400">运行状态良好</p>
          <p class="text-sm">暂无待处理告警</p>
        </div>
        <div v-else class="space-y-3">
          <div v-for="(alert, index) in activeAlerts" :key="index"
               class="p-3 rounded-lg border transition-all"
               :class="getAlertCardClass(alert.level)">
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5"
                             :class="getAlertIconClass(alert.level)" />
              <div>
                <p class="font-medium" :class="getAlertIconClass(alert.level)">
                  {{ alert.message }}
                </p>
                <p class="text-sm text-[var(--text-secondary)] mt-1">{{ alert.suggestion }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
