<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMovementStore } from '@/stores/movement'
import { useDiagnosisStore } from '@/stores/diagnosis'
import * as echarts from 'echarts'
import {
  AlertTriangle,
  Watch,
  TrendingUp,
  Clock,
  CheckCircle2,
  Activity,
  BarChart3,
  ChevronRight
} from 'lucide-vue-next'

const router = useRouter()
const movementStore = useMovementStore()
const diagnosisStore = useDiagnosisStore()

const loading = ref(false)
const trendChartRef = ref<HTMLElement | null>(null)
let trendChartInstance: echarts.ECharts | null = null

const stats = computed(() => {
  const movements = movementStore.movements
  const totalMovements = movements.length

  let lowAmplitudeCount = 0
  let overRateCount = 0
  const lowAmplitudeMovements: { id?: number; brand?: string; model: string; serial?: string; amplitude?: number }[] = []
  const overRateMovements: { id?: number; brand?: string; model: string; serial?: string; rate?: number }[] = []

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 86400000
  let recentNewCount = 0
  const recentNewMovements: { id?: number; brand?: string; model: string; serial?: string; create_time?: string }[] = []

  movements.forEach(m => {
    if (m.create_time && new Date(m.create_time).getTime() > sevenDaysAgo) {
      recentNewCount++
      recentNewMovements.push(m)
    }
  })

  const weeklyTrend: { date: string; newCount: number; completedCount: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const dayStart = new Date(dateStr).getTime()
    const dayEnd = dayStart + 86400000
    const newCount = movements.filter(m => {
      const t = m.create_time ? new Date(m.create_time).getTime() : 0
      return t >= dayStart && t < dayEnd
    }).length
    weeklyTrend.push({ date: dateStr, newCount, completedCount: 0 })
  }

  return {
    totalMovements,
    lowAmplitudeCount,
    overRateCount,
    recentNewCount,
    recentCompletedCount: 0,
    lowAmplitudeMovements,
    overRateMovements,
    recentNewMovements,
    weeklyTrend
  }
})

function goTo(path: string) {
  router.push(path)
}

function goToMovement(m: any) {
  movementStore.setCurrentMovement(m)
  if (m.id) {
    diagnosisStore.loadDiagnosisHistory(m.id)
  }
  router.push('/diagnosis')
}

function initTrendChart() {
  if (!trendChartRef.value) return
  if (!trendChartInstance) {
    trendChartInstance = echarts.init(trendChartRef.value)
  }

  const trend = stats.value.weeklyTrend
  const dates = trend.map(t => t.date.slice(5))
  const newCounts = trend.map(t => t.newCount)

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(19, 39, 68, 0.95)',
      borderColor: '#B8860B',
      textStyle: { color: '#E8E8E8' }
    },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#2A4A6E' } },
      axisLabel: { color: '#A0AEC0', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: '数量',
      nameTextStyle: { color: '#A0AEC0' },
      axisLine: { lineStyle: { color: '#2A4A6E' } },
      axisLabel: { color: '#A0AEC0' },
      splitLine: { lineStyle: { color: 'rgba(42, 74, 110, 0.3)' } },
      minInterval: 1
    },
    series: [
      {
        name: '新增档案',
        type: 'bar',
        data: newCounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#DAA520' },
            { offset: 1, color: '#B8860B' }
          ])
        },
        barWidth: '40%'
      }
    ]
  }

  trendChartInstance.setOption(option)
}

onMounted(async () => {
  loading.value = true
  try {
    await movementStore.loadMovements()
    await movementStore.loadReferences()
    nextTick(() => {
      initTrendChart()
    })
  } finally {
    loading.value = false
  }
  window.addEventListener('resize', () => {
    trendChartInstance?.resize()
  })
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <BarChart3 class="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-[var(--text-primary)]">统计概览</h2>
          <p class="text-sm text-[var(--text-secondary)]">跨机芯工作量与风险一览</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-4">
      <div class="watch-card flex items-center gap-4">
        <div class="w-12 h-12 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
          <Watch class="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <p class="text-2xl font-bold text-[var(--text-primary)] font-mono">{{ stats.totalMovements }}</p>
          <p class="text-sm text-[var(--text-secondary)]">在修机芯</p>
        </div>
      </div>
      <div class="watch-card flex items-center gap-4 cursor-pointer hover:border-red-600 transition-colors">
        <div class="w-12 h-12 rounded-lg bg-red-900/30 flex items-center justify-center">
          <AlertTriangle class="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p class="text-2xl font-bold text-red-400 font-mono">{{ stats.lowAmplitudeCount }}</p>
          <p class="text-sm text-[var(--text-secondary)]">摆幅过低</p>
        </div>
      </div>
      <div class="watch-card flex items-center gap-4 cursor-pointer hover:border-yellow-600 transition-colors">
        <div class="w-12 h-12 rounded-lg bg-yellow-900/30 flex items-center justify-center">
          <Activity class="w-6 h-6 text-yellow-400" />
        </div>
        <div>
          <p class="text-2xl font-bold text-yellow-400 font-mono">{{ stats.overRateCount }}</p>
          <p class="text-sm text-[var(--text-secondary)]">日差超差</p>
        </div>
      </div>
      <div class="watch-card flex items-center gap-4">
        <div class="w-12 h-12 rounded-lg bg-green-900/30 flex items-center justify-center">
          <TrendingUp class="w-6 h-6 text-green-400" />
        </div>
        <div>
          <p class="text-2xl font-bold text-green-400 font-mono">{{ stats.recentNewCount }}</p>
          <p class="text-sm text-[var(--text-secondary)]">近7天新增</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2 watch-card">
        <h3 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
          <BarChart3 class="w-5 h-5" />
          近7天新增趋势
        </h3>
        <div ref="trendChartRef" class="h-64"></div>
      </div>

      <div class="watch-card">
        <h3 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
          <Clock class="w-5 h-5" />
          最近新增档案
        </h3>
        <div v-if="stats.recentNewMovements.length === 0" class="h-48 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <CheckCircle2 class="w-12 h-12 mb-2 opacity-30" />
          <p>近7天无新增档案</p>
        </div>
        <div v-else class="space-y-2 max-h-56 overflow-auto">
          <div v-for="m in stats.recentNewMovements" :key="m.id"
               @click="goToMovement(m)"
               class="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors">
            <div class="flex items-center gap-2">
              <Watch class="w-4 h-4 text-[var(--accent-gold)]" />
              <div>
                <p class="text-sm text-[var(--text-primary)] font-medium">{{ m.brand || '' }} {{ m.model }}</p>
                <p class="text-xs text-[var(--text-muted)]">{{ m.serial || '未编号' }}</p>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-6">
      <div class="watch-card">
        <h3 class="text-red-400 font-medium mb-4 flex items-center gap-2">
          <AlertTriangle class="w-5 h-5" />
          摆幅过低机芯
          <span v-if="stats.lowAmplitudeCount > 0" class="status-badge status-poor ml-2">{{ stats.lowAmplitudeCount }}</span>
        </h3>
        <div v-if="stats.lowAmplitudeMovements.length === 0" class="py-8 text-center text-[var(--text-muted)]">
          <CheckCircle2 class="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p>所有机芯摆幅正常</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="m in stats.lowAmplitudeMovements" :key="m.id"
               @click="goToMovement(m)"
               class="flex items-center justify-between p-3 rounded-lg bg-red-900/10 border border-red-600/30 hover:bg-red-900/20 cursor-pointer transition-colors">
            <div>
              <p class="text-sm text-[var(--text-primary)] font-medium">{{ m.brand || '' }} {{ m.model }}</p>
              <p class="text-xs text-red-400">摆幅: {{ m.amplitude || '-' }}°</p>
            </div>
            <ChevronRight class="w-4 h-4 text-red-400" />
          </div>
        </div>
      </div>

      <div class="watch-card">
        <h3 class="text-yellow-400 font-medium mb-4 flex items-center gap-2">
          <Activity class="w-5 h-5" />
          日差超差机芯
          <span v-if="stats.overRateCount > 0" class="status-badge status-poor ml-2">{{ stats.overRateCount }}</span>
        </h3>
        <div v-if="stats.overRateMovements.length === 0" class="py-8 text-center text-[var(--text-muted)]">
          <CheckCircle2 class="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p>所有机芯日差正常</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="m in stats.overRateMovements" :key="m.id"
               @click="goToMovement(m)"
               class="flex items-center justify-between p-3 rounded-lg bg-yellow-900/10 border border-yellow-600/30 hover:bg-yellow-900/20 cursor-pointer transition-colors">
            <div>
              <p class="text-sm text-[var(--text-primary)] font-medium">{{ m.brand || '' }} {{ m.model }}</p>
              <p class="text-xs text-yellow-400">日差: {{ m.rate !== undefined ? (m.rate > 0 ? '+' : '') + m.rate + ' s/d' : '-' }}</p>
            </div>
            <ChevronRight class="w-4 h-4 text-yellow-400" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
