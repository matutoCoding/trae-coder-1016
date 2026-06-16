<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMovementStore } from '@/stores/movement'
import { useDiagnosisStore } from '@/stores/diagnosis'
import {
  checkIsochronism,
  calculatePositionMatrix,
  checkEscapementClearance,
  analyzePositionErrorCauses,
  checkLockAndImpulse,
  generateRiskAlerts,
  calculateIdealRate,
  calculateEccentricityAdjustment
} from '@/utils/calculator'
import type {
  PositionErrors,
  PositionMatrixResult,
  IsochronismResult,
  ClearanceCheckResult,
  RiskAlert
} from '@/types'
import * as echarts from 'echarts'
import {
  Activity,
  Watch,
  Gauge,
  Compass,
  AlertTriangle,
  FileText,
  Save,
  RotateCcw,
  Download,
  ChevronDown,
  Clock,
  Target,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Thermometer,
  Zap
} from 'lucide-vue-next'

const movementStore = useMovementStore()
const diagnosisStore = useDiagnosisStore()

const loading = ref(false)
const saving = ref(false)

const amplitudePoints = [270, 240, 210, 180]

interface AmplitudeRatePoint {
  amplitude: number
  rate: number
  beatError: number
}

const form = reactive({
  movementId: null as number | null,
  amplitude: 260,
  rate: 0,
  beatError: 0,
  lockAngle: 12,
  impulseAngle: 40,
  measuredClearance: 0,
  amplitudeRatePoints: amplitudePoints.map(ap => ({
    amplitude: ap,
    rate: 0,
    beatError: 0
  })) as AmplitudeRatePoint[],
  positionErrors: {
    face_up: 0,
    face_down: 0,
    crown_left: 0,
    crown_right: 0,
    crown_up: 0,
    crown_down: 0
  } as PositionErrors
})

const movementOptions = computed(() => movementStore.movements)
const currentReference = computed(() => movementStore.currentReference)
const currentMovement = computed(() => movementStore.currentMovement)

const isochronismResults = computed<Map<number, IsochronismResult>>(() => {
  const results = new Map<number, IsochronismResult>()
  if (!currentReference.value) return results
  form.amplitudeRatePoints.forEach(point => {
    const result = checkIsochronism(point.amplitude, point.rate, currentReference.value!)
    results.set(point.amplitude, result)
  })
  return results
})

const lockImpulseAnalysis = computed(() => {
  if (!currentReference.value) return null
  return checkLockAndImpulse(
    form.amplitude,
    form.lockAngle,
    form.impulseAngle,
    currentReference.value
  )
})

const positionMatrixResult = computed<PositionMatrixResult | null>(() => {
  if (!currentReference.value) return null
  return calculatePositionMatrix(
    form.positionErrors,
    currentReference.value.allow_position_error
  )
})

const positionErrorAnalysis = computed(() => {
  return analyzePositionErrorCauses(form.positionErrors)
})

const eccentricityAdjustment = computed(() => {
  return calculateEccentricityAdjustment(form.positionErrors)
})

const clearanceResult = computed<ClearanceCheckResult | null>(() => {
  if (!currentMovement.value?.teeth) return null
  return checkEscapementClearance(
    form.lockAngle,
    form.impulseAngle,
    currentMovement.value.teeth,
    form.measuredClearance
  )
})

const riskAlerts = computed<RiskAlert[]>(() => {
  if (!currentReference.value) return []
  return generateRiskAlerts(
    form.amplitude,
    form.rate,
    positionMatrixResult.value?.maxDeviation || 0,
    clearanceResult.value?.hasRisk || false,
    currentReference.value
  )
})

const overallStatus = computed(() => {
  if (riskAlerts.value.length === 0) return 'excellent'
  if (riskAlerts.value.some(a => a.level === 'danger')) return 'poor'
  if (riskAlerts.value.length >= 2) return 'normal'
  return 'good'
})

const overallStatusText = computed(() => {
  const statusMap: Record<string, string> = {
    excellent: '运行状态优秀',
    good: '运行状态良好',
    normal: '需要关注调整',
    poor: '存在严重问题'
  }
  return statusMap[overallStatus.value]
})

const positionLabels = [
  { key: 'face_up', label: '面上', icon: '↑' },
  { key: 'face_down', label: '面下', icon: '↓' },
  { key: 'crown_left', label: '柄左', icon: '←' },
  { key: 'crown_right', label: '柄右', icon: '→' },
  { key: 'crown_up', label: '柄上', icon: '↗' },
  { key: 'crown_down', label: '柄下', icon: '↘' }
]

function getPositionErrorCardClass(key: string) {
  if (isPositionErrorOverLimit(key as keyof PositionErrors)) {
    return 'bg-red-900/20 border-red-600'
  }
  return 'bg-[var(--bg-tertiary)]/30 border-[var(--border-color)]'
}

function getPositionErrorIconClass(key: string) {
  return isPositionErrorOverLimit(key as keyof PositionErrors) ? 'text-red-400' : 'text-[var(--accent-gold)]'
}

function getPositionErrorInputClass(key: string) {
  if (isPositionErrorOverLimit(key as keyof PositionErrors)) {
    return '!border-red-500 !bg-red-900/20'
  }
  return ''
}

function getAlertCardClass(level: string) {
  return level === 'danger' ? 'bg-red-900/20 border-red-600 alert-pulse' : 'bg-yellow-900/20 border-yellow-600'
}

function getAlertIconClass(level: string) {
  return level === 'danger' ? 'text-red-400' : 'text-yellow-400'
}

let amplitudeGaugeChart: echarts.ECharts | null = null
let rateGaugeChart: echarts.ECharts | null = null
let positionRadarChart: echarts.ECharts | null = null
let positionHeatmapChart: echarts.ECharts | null = null
let isochronismChart: echarts.ECharts | null = null

function initCharts() {
  const amplitudeGaugeDom = document.getElementById('amplitude-gauge')
  const rateGaugeDom = document.getElementById('rate-gauge')
  const positionRadarDom = document.getElementById('position-radar')
  const positionHeatmapDom = document.getElementById('position-heatmap')
  const isochronismDom = document.getElementById('isochronism-chart')

  if (amplitudeGaugeDom) {
    amplitudeGaugeChart = echarts.init(amplitudeGaugeDom)
    updateAmplitudeGauge()
  }
  if (rateGaugeDom) {
    rateGaugeChart = echarts.init(rateGaugeDom)
    updateRateGauge()
  }
  if (positionRadarDom) {
    positionRadarChart = echarts.init(positionRadarDom)
    updatePositionRadar()
  }
  if (positionHeatmapDom) {
    positionHeatmapChart = echarts.init(positionHeatmapDom)
    updatePositionHeatmap()
  }
  if (isochronismDom) {
    isochronismChart = echarts.init(isochronismDom)
    updateIsochronismChart()
  }
}

function updateAmplitudeGauge() {
  if (!amplitudeGaugeChart || !currentReference.value) return
  const minAmp = currentReference.value.min_amplitude
  const maxAmp = currentReference.value.max_amplitude

  amplitudeGaugeChart.setOption({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 100,
      max: 360,
      splitNumber: 13,
      itemStyle: {
        color: '#B8860B'
      },
      progress: {
        show: true,
        width: 20
      },
      pointer: {
        show: true,
        length: '60%',
        width: 6,
        itemStyle: {
          color: '#DAA520'
        }
      },
      axisLine: {
        lineStyle: {
          width: 20,
          color: [
            [0.28, '#DC3545'],
            [0.5, '#FFC107'],
            [0.86, '#28A745'],
            [1, '#DC3545']
          ]
        }
      },
      axisTick: {
        distance: -25,
        splitNumber: 2,
        lineStyle: {
          color: '#A0AEC0',
          width: 1
        }
      },
      splitLine: {
        distance: -30,
        length: 10,
        lineStyle: {
          color: '#A0AEC0',
          width: 2
        }
      },
      axisLabel: {
        distance: -45,
        color: '#A0AEC0',
        fontSize: 10,
        fontFamily: 'JetBrains Mono'
      },
      anchor: {
        show: true,
        showAbove: true,
        size: 20,
        itemStyle: {
          borderWidth: 4,
          borderColor: '#B8860B'
        }
      },
      title: {
        show: false
      },
      detail: {
        valueAnimation: true,
        fontFamily: 'JetBrains Mono',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#E8E8E8',
        offsetCenter: [0, '65%'],
        formatter: `{value}°`
      },
      data: [{ value: form.amplitude }]
    }]
  })
}

function updateRateGauge() {
  if (!rateGaugeChart || !currentReference.value) return
  const maxRate = currentReference.value.allow_rate_error * 3

  rateGaugeChart.setOption({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: -maxRate,
      max: maxRate,
      splitNumber: 12,
      itemStyle: {
        color: '#B8860B'
      },
      progress: {
        show: true,
        width: 20
      },
      pointer: {
        show: true,
        length: '60%',
        width: 6,
        itemStyle: {
          color: '#DAA520'
        }
      },
      axisLine: {
        lineStyle: {
          width: 20,
          color: [
            [0.17, '#28A745'],
            [0.33, '#FFC107'],
            [0.5, '#DC3545'],
            [0.67, '#DC3545'],
            [0.83, '#FFC107'],
            [1, '#28A745']
          ]
        }
      },
      axisTick: {
        distance: -25,
        splitNumber: 2,
        lineStyle: {
          color: '#A0AEC0',
          width: 1
        }
      },
      splitLine: {
        distance: -30,
        length: 10,
        lineStyle: {
          color: '#A0AEC0',
          width: 2
        }
      },
      axisLabel: {
        distance: -45,
        color: '#A0AEC0',
        fontSize: 10,
        fontFamily: 'JetBrains Mono',
        formatter: (value: number) => value > 0 ? '+' + value : '' + value
      },
      anchor: {
        show: true,
        showAbove: true,
        size: 20,
        itemStyle: {
          borderWidth: 4,
          borderColor: '#B8860B'
        }
      },
      title: {
        show: false
      },
      detail: {
        valueAnimation: true,
        fontFamily: 'JetBrains Mono',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#E8E8E8',
        offsetCenter: [0, '65%'],
        formatter: (value: number) => (value > 0 ? '+' + value.toFixed(1) : '' + value.toFixed(1)) + ' s/d'
      },
      data: [{ value: form.rate }]
    }]
  })
}

function updatePositionRadar() {
  if (!positionRadarChart) return
  const values = positionLabels.map(label => form.positionErrors[label.key as keyof PositionErrors])
  const maxAbs = Math.max(...values.map(v => Math.abs(v)), 10)

  positionRadarChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(19, 39, 68, 0.95)',
      borderColor: '#2A4A6E',
      textStyle: {
        color: '#E8E8E8',
        fontFamily: 'JetBrains Mono'
      },
      formatter: (params: any) => {
        let result = `${params.name}<br/>`
        positionLabels.forEach((label, i) => {
          const val = params.value[i]
          result += `${label.label}: ${val > 0 ? '+' : ''}${val.toFixed(1)} s/d<br/>`
        })
        return result
      }
    },
    radar: {
      indicator: positionLabels.map(label => ({
        name: label.label,
        max: maxAbs,
        min: -maxAbs
      })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#E8E8E8',
        fontSize: 12,
        fontFamily: 'JetBrains Mono'
      },
      splitLine: {
        lineStyle: {
          color: '#2A4A6E'
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(30, 58, 95, 0.3)', 'rgba(19, 39, 68, 0.3)']
        }
      },
      axisLine: {
        lineStyle: {
          color: '#2A4A6E'
        }
      }
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '位置误差',
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          color: '#B8860B',
          width: 2
        },
        areaStyle: {
          color: 'rgba(184, 134, 11, 0.3)'
        },
        itemStyle: {
          color: '#DAA520',
          borderColor: '#B8860B',
          borderWidth: 2
        }
      }]
    }]
  })
}

function updatePositionHeatmap() {
  if (!positionHeatmapChart) return
  const matrix = positionMatrixResult.value?.matrix || [[0, 0], [0, 0], [0, 0]]
  const data: any[] = []
  const rowLabels = ['水平', '侧向', '垂直']
  const colLabels = ['位置1', '位置2']
  const maxVal = Math.max(...matrix.flat().map(v => Math.abs(v)), 5)

  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      data.push([j, i, matrix[i][j]])
    }
  }

  positionHeatmapChart.setOption({
    tooltip: {
      position: 'top',
      backgroundColor: 'rgba(19, 39, 68, 0.95)',
      borderColor: '#2A4A6E',
      textStyle: {
        color: '#E8E8E8',
        fontFamily: 'JetBrains Mono'
      },
      formatter: (params: any) => {
        const val = params.value[2]
        return `${rowLabels[params.value[1]]}-${colLabels[params.value[0]]}<br/>${val > 0 ? '+' : ''}${val.toFixed(1)} s/d`
      }
    },
    grid: {
      left: '15%',
      right: '15%',
      top: '5%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: colLabels,
      splitArea: { show: true },
      axisLabel: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono'
      },
      axisLine: {
        lineStyle: { color: '#2A4A6E' }
      }
    },
    yAxis: {
      type: 'category',
      data: rowLabels,
      splitArea: { show: true },
      axisLabel: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono'
      },
      axisLine: {
        lineStyle: { color: '#2A4A6E' }
      }
    },
    visualMap: {
      min: -maxVal,
      max: maxVal,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      textStyle: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono'
      },
      inRange: {
        color: ['#DC3545', '#FFC107', '#28A745', '#FFC107', '#DC3545']
      },
      formatter: (value: number) => value > 0 ? '+' + value.toFixed(0) : '' + value.toFixed(0)
    },
    series: [{
      type: 'heatmap',
      data: data,
      label: {
        show: true,
        color: '#E8E8E8',
        fontFamily: 'JetBrains Mono',
        fontSize: 14,
        fontWeight: 'bold',
        formatter: (params: any) => {
          const val = params.value[2]
          return val > 0 ? '+' + val.toFixed(1) : '' + val.toFixed(1)
        }
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(184, 134, 11, 0.5)'
        }
      }
    }]
  })
}

function updateIsochronismChart() {
  if (!isochronismChart || !currentReference.value) return

  const points = form.amplitudeRatePoints
  const idealCurve = points.map(p => ({
    amplitude: p.amplitude,
    idealRate: calculateIdealRate(p.amplitude, currentReference.value!)
  }))

  isochronismChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(19, 39, 68, 0.95)',
      borderColor: '#2A4A6E',
      textStyle: {
        color: '#E8E8E8',
        fontFamily: 'JetBrains Mono'
      },
      formatter: (params: any) => {
        let result = `摆幅 ${params[0].value[0]}°<br/>`
        params.forEach((p: any) => {
          const val = p.value[1]
          result += `${p.seriesName}: ${val > 0 ? '+' : ''}${val.toFixed(2)} s/d<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['实测日差', '理想曲线', '允许范围'],
      textStyle: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono'
      },
      top: 0
    },
    grid: {
      left: '10%',
      right: '10%',
      top: '15%',
      bottom: '15%'
    },
    xAxis: {
      type: 'value',
      name: '摆幅 (°)',
      nameTextStyle: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono'
      },
      min: 160,
      max: 290,
      inverse: true,
      axisLabel: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono'
      },
      axisLine: {
        lineStyle: { color: '#2A4A6E' }
      },
      splitLine: {
        lineStyle: { color: 'rgba(42, 74, 110, 0.5)' }
      }
    },
    yAxis: {
      type: 'value',
      name: '日差 (s/d)',
      nameTextStyle: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono'
      },
      axisLabel: {
        color: '#A0AEC0',
        fontFamily: 'JetBrains Mono',
        formatter: (value: number) => value > 0 ? '+' + value : '' + value
      },
      axisLine: {
        lineStyle: { color: '#2A4A6E' }
      },
      splitLine: {
        lineStyle: { color: 'rgba(42, 74, 110, 0.5)' }
      }
    },
    series: [
      {
        name: '允许范围',
        type: 'line',
        data: idealCurve.map(p => [p.amplitude, p.idealRate + currentReference.value!.allow_rate_error]),
        lineStyle: { color: 'transparent' },
        stack: 'band',
        symbol: 'none'
      },
      {
        name: '允许范围',
        type: 'line',
        data: idealCurve.map(p => [p.amplitude, -currentReference.value!.allow_rate_error * 2]),
        lineStyle: { color: 'transparent' },
        stack: 'band',
        areaStyle: {
          color: 'rgba(40, 167, 69, 0.15)'
        },
        symbol: 'none',
        tooltip: { show: false },
        legendHoverLink: false
      },
      {
        name: '理想曲线',
        type: 'line',
        data: idealCurve.map(p => [p.amplitude, p.idealRate]),
        lineStyle: {
          color: '#28A745',
          type: 'dashed',
          width: 2
        },
        symbol: 'none'
      },
      {
        name: '实测日差',
        type: 'line',
        data: points.map(p => [p.amplitude, p.rate]),
        lineStyle: {
          color: '#B8860B',
          width: 3
        },
        itemStyle: {
          color: (params: any) => {
            const result = isochronismResults.value.get(params.value[0])
            if (!result) return '#DAA520'
            if (result.level === 'excellent') return '#28A745'
            if (result.level === 'good') return '#17A2B8'
            if (result.level === 'normal') return '#FFC107'
            return '#DC3545'
          },
          borderColor: '#B8860B',
          borderWidth: 2
        },
        symbol: 'circle',
        symbolSize: 12
      }
    ]
  })
}

watch(() => form.amplitude, updateAmplitudeGauge)
watch(() => form.rate, updateRateGauge)
watch(() => form.positionErrors, () => {
  updatePositionRadar()
  updatePositionHeatmap()
}, { deep: true })
watch(() => form.amplitudeRatePoints, () => {
  updateIsochronismChart()
}, { deep: true })
watch(currentReference, () => {
  updateAmplitudeGauge()
  updateRateGauge()
  updateIsochronismChart()
})

function selectMovement(m: any) {
  movementStore.setCurrentMovement(m)
  form.movementId = m.id || null
  if (m.lock_angle) form.lockAngle = m.lock_angle
  if (m.impulse_angle) form.impulseAngle = m.impulse_angle
  diagnosisStore.loadDiagnosisHistory(m.id)
  diagnosisStore.loadMaintenanceHistory(m.id)
}

function resetForm() {
  form.amplitude = 260
  form.rate = 0
  form.beatError = 0
  form.lockAngle = currentMovement.value?.lock_angle || 12
  form.impulseAngle = currentMovement.value?.impulse_angle || 40
  form.measuredClearance = 0
  form.amplitudeRatePoints = amplitudePoints.map(ap => ({
    amplitude: ap,
    rate: 0,
    beatError: 0
  }))
  form.positionErrors = {
    face_up: 0,
    face_down: 0,
    crown_left: 0,
    crown_right: 0,
    crown_up: 0,
    crown_down: 0
  }
}

function isPositionErrorOverLimit(key: keyof PositionErrors): boolean {
  if (!currentReference.value) return false
  const val = Math.abs(form.positionErrors[key])
  return val > currentReference.value.allow_position_error
}

function getIsochronismClass(level: string): string {
  const classMap: Record<string, string> = {
    excellent: 'text-green-400',
    good: 'text-blue-400',
    normal: 'text-yellow-400',
    poor: 'text-red-400'
  }
  return classMap[level] || 'text-[var(--text-muted)]'
}

function getLockImpulseClass(status: string): string {
  if (status === 'normal') return 'text-green-400'
  if (status === 'too_large' || status === 'too_small') return 'text-red-400'
  return 'text-[var(--text-muted)]'
}

function generateReport(): string {
  const m = currentMovement.value
  const ref = currentReference.value
  if (!m || !ref) return ''

  const now = new Date().toLocaleString('zh-CN')
  const posMatrix = positionMatrixResult.value
  const clearance = clearanceResult.value
  const posAnalysis = positionErrorAnalysis.value
  const lockImpulse = lockImpulseAnalysis.value

  let report = `╔══════════════════════════════════════════════════════════════╗\n`
  report += `║              机械腕表擒纵调校系统 - 等时性诊断报告               ║\n`
  report += `╚══════════════════════════════════════════════════════════════╝\n\n`
  report += `【诊断时间】${now}\n`
  report += `【机芯信息】${m.brand || '-'} ${m.model} (表号: ${m.serial || '-'})\n`
  report += `【客户信息】${m.customer || '-'}\n\n`

  report += `+--------------------------------------------------------------+\n`
  report += `|                    一、基础参数测量结果                         |\n`
  report += `+--------------------------------------------------------------+\n`
  report += `|  当前摆幅: ${form.amplitude.toString().padEnd(25)}° |\n`
  report += `|  当前日差: ${(form.rate > 0 ? '+' : '') + form.rate.toFixed(1).padEnd(22)} s/d |\n`
  report += `|  偏振值:   ${form.beatError.toFixed(2).padEnd(25)} ms |\n`
  report += `|  锁接角:   ${form.lockAngle.toFixed(1).padEnd(25)}° |\n`
  report += `|  冲量角:   ${form.impulseAngle.toFixed(1).padEnd(25)}° |\n`
  report += `|  振频:     ${(m.frequency || '-').toString().padEnd(25)} Hz |\n`
  report += `|  升角:     ${(m.lift_angle || '-').toString().padEnd(25)}° |\n`
  report += `+--------------------------------------------------------------+\n\n`

  report += `+--------------------------------------------------------------+\n`
  report += `|                    二、四摆幅点等时性校验                       |\n`
  report += `+--------------+-----------+-----------+-----------------------+\n`
  report += `|  摆幅点(°)   |  日差(s/d) |  偏差量    |  等级                  |\n`
  report += `+--------------+-----------+-----------+-----------------------+\n`
  form.amplitudeRatePoints.forEach(point => {
    const result = isochronismResults.value.get(point.amplitude)
    const rateStr = (point.rate > 0 ? '+' : '') + point.rate.toFixed(1)
    const devStr = result ? result.deviation.toFixed(2) : '-'
    const levelStr = result ? result.level : '-'
    report += `|  ${point.amplitude.toString().padEnd(12)}| ${rateStr.padEnd(10)}| ${devStr.padEnd(10)}| ${levelStr.padEnd(21)}|\n`
  })
  report += `+--------------+-----------+-----------+-----------------------+\n\n`

  report += `+--------------------------------------------------------------+\n`
  report += `|                    三、擒纵机构分析                           |\n`
  report += `+--------------------------------------------------------------+\n`
  if (lockImpulse) {
    report += `|  ${lockImpulse.message.padEnd(56)} |\n`
  }
  if (clearance) {
    report += `+--------------------------------------------------------------+\n`
    report += `|  理论余隙: ${clearance.theoreticalClearance.toFixed(2).padEnd(22)}° |\n`
    report += `|  实测余隙: ${form.measuredClearance.toFixed(2).padEnd(24)}° |\n`
    report += `|  容差范围: ±${clearance.tolerance.toFixed(2).padEnd(24)}° |\n`
    report += `|  ${clearance.suggestion.padEnd(56)} |\n`
  }
  report += `+--------------------------------------------------------------+\n\n`

  report += `+--------------------------------------------------------------+\n`
  report += `|                    四、六方位位置误差分析                       |\n`
  report += `+--------------+-----------+--------------+-------------------+\n`
  report += `|  方位        |  误差(s/d) |  是否超差     |  方位              |\n`
  report += `+--------------+-----------+--------------+-------------------+\n`
  const posData: [string, number][] = [
    ['面上', form.positionErrors.face_up],
    ['面下', form.positionErrors.face_down],
    ['柄左', form.positionErrors.crown_left],
    ['柄右', form.positionErrors.crown_right],
    ['柄上', form.positionErrors.crown_up],
    ['柄下', form.positionErrors.crown_down]
  ]
  for (let i = 0; i < 3; i++) {
    const [label1, val1] = posData[i]
    const [label2, val2] = posData[i + 3]
    const str1 = (val1 > 0 ? '+' : '') + val1.toFixed(1)
    const str2 = (val2 > 0 ? '+' : '') + val2.toFixed(1)
    const over1 = Math.abs(val1) > ref.allow_position_error ? '是' : '否'
    const over2 = Math.abs(val2) > ref.allow_position_error ? '是' : '否'
    report += '|  ' + label1.padEnd(12) + '| ' + str1.padEnd(10) + '| ' + over1.padEnd(13) + '| ' + label2.padEnd(18) + '|\n'
    report += '|              |           |              | ' + str2.padEnd(10) + over2.padEnd(9) + '|\n'
  }
  report += `+--------------+-----------+--------------+-------------------+\n`
  if (posMatrix) {
    report += `|  最大位置差: ${posMatrix.maxDeviation.toFixed(2).padEnd(18)} s/d |\n`
    report += `|  平均误差:   ${posMatrix.average.toFixed(2).padEnd(20)} s/d |\n`
    report += `|  评判结果:   ${(posMatrix.isPass ? '合格' : '不合格').padEnd(22)}   |\n`
  }
  report += `+--------------------------------------------------------------+\n`
  report += `|  ${posAnalysis.analysis.padEnd(56)} |\n`
  report += `+--------------------------------------------------------------+\n\n`

  if (riskAlerts.value.length > 0) {
    report += `+--------------------------------------------------------------+\n`
    report += `|                    五、风险告警                               |\n`
    report += `+--------------------------------------------------------------+\n`
    riskAlerts.value.forEach((alert, i) => {
      report += `|  ${i + 1}. [${alert.level === 'danger' ? '危险' : '警告'}] ${alert.message.padEnd(47)} |\n`
      report += `|     ${alert.suggestion.padEnd(53)} |\n`
    })
    report += `+--------------------------------------------------------------+\n\n`
  }

  let suggestionText = ''
  if (overallStatus.value === 'excellent') suggestionText = '机芯运行状态优秀，无需调校'
  else if (overallStatus.value === 'good') suggestionText = '机芯状态良好，建议定期观察'
  else if (overallStatus.value === 'normal') suggestionText = '建议根据上述分析进行相应调校'
  else suggestionText = '请立即进行维修调校，避免故障扩大'

  report += '+--------------------------------------------------------------+\n'
  report += '|                    六、总体评估                               |\n'
  report += '+--------------------------------------------------------------+\n'
  report += '|  综合状态: ' + overallStatusText.value.padEnd(32) + '        |\n'
  report += '|  建议: ' + suggestionText.padEnd(47) + ' |\n'
  report += '+--------------------------------------------------------------+\n\n'
  report += '诊断技师: ______________     日期: ______________\n'

  return report
}

async function saveDiagnosis() {
  if (!form.movementId) {
    ElMessage.warning('请先选择机芯')
    return
  }

  saving.value = true
  try {
    const diagnosisData = {
      movement_id: form.movementId,
      amplitude: form.amplitude,
      rate: form.rate,
      beat_error: form.beatError,
      isochronism: Array.from(isochronismResults.value.entries())
        .map(([amp, r]) => amp + '度:' + r.level).join('; '),
      lock_status: lockImpulseAnalysis.value?.lockStatus || '',
      impulse_status: lockImpulseAnalysis.value?.impulseStatus || '',
      position_analysis: positionErrorAnalysis.value.analysis,
      risk_warning: riskAlerts.value.map(a => a.message).join('; '),
      diagnose_time: new Date().toISOString()
    }

    const posRecord = {
      movement_id: form.movementId,
      ...form.positionErrors,
      max_deviation: positionMatrixResult.value?.maxDeviation || 0,
      result: positionMatrixResult.value?.isPass ? 'pass' : 'fail'
    }

    const diagId = await diagnosisStore.saveDiagnosis(diagnosisData)
    await diagnosisStore.savePositionError(posRecord)
    diagnosisStore.setRiskAlerts(riskAlerts.value)

    if (diagId) {
      ElMessage.success('诊断报告保存成功')
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    saving.value = false
  }
}

function downloadReport() {
  const report = generateReport()
  if (!report) {
    ElMessage.warning('请先选择机芯')
    return
  }

  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '等时性诊断报告_' + (currentMovement.value?.model || 'unknown') + '_' + new Date().toISOString().slice(0, 10) + '.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  ElMessage.success('报告已下载')
}

function handleResize() {
  amplitudeGaugeChart?.resize()
  rateGaugeChart?.resize()
  positionRadarChart?.resize()
  positionHeatmapChart?.resize()
  isochronismChart?.resize()
}

async function loadData() {
  loading.value = true
  try {
    await movementStore.loadReferences()
    await movementStore.loadMovements()

    if (movementStore.currentMovement) {
      selectMovement(movementStore.currentMovement)
    } else if (movementStore.movements.length > 0) {
      selectMovement(movementStore.movements[0])
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  setTimeout(initCharts, 100)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  amplitudeGaugeChart?.dispose()
  rateGaugeChart?.dispose()
  positionRadarChart?.dispose()
  positionHeatmapChart?.dispose()
  isochronismChart?.dispose()
})
</script>

<template>
  <div class="space-y-6 h-full overflow-y-auto pb-6">
    <div class="watch-card">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--accent-gold)] to-[var(--accent-gold-light)] flex items-center justify-center">
            <Activity class="w-6 h-6 text-[var(--bg-primary)]" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-[var(--text-primary)]">等时性诊断</h2>
            <p class="text-sm text-[var(--text-secondary)]">机械腕表擒纵机构调校分析系统</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="status-badge" :class="'status-' + overallStatus">
            {{ overallStatusText }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="col-span-2">
          <label class="watch-label">选择机芯档案</label>
          <el-select v-model="form.movementId"
                     placeholder="请选择已录入的机芯..."
                     filterable
                     @change="(val: number) => {
                       const m = movementOptions.find(opt => opt.id === val)
                       if (m) selectMovement(m)
                     }"
                     class="w-full">
            <el-option v-for="m in movementOptions" :key="m.id"
                       :label="(m.brand || '') + ' ' + m.model + ' - ' + (m.serial || '无表号')"
                       :value="m.id">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <Watch class="w-4 h-4 text-[var(--accent-gold)]" />
                  <span>{{ m.brand || '-' }} {{ m.model }}</span>
                </div>
                <span class="text-[var(--text-muted)] text-sm">{{ m.frequency }}Hz</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <div v-if="currentReference" class="watch-card bg-[var(--bg-tertiary)]/50 border-dashed">
          <div class="flex items-center gap-2 mb-2">
            <Target class="w-4 h-4 text-[var(--accent-gold)]" />
            <span class="text-sm text-[var(--text-secondary)]">标准参数</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-[var(--text-muted)]">摆幅范围:</span>
              <span class="ml-1 font-mono text-[var(--text-primary)]">{{ currentReference.min_amplitude }}°-{{ currentReference.max_amplitude }}°</span>
            </div>
            <div>
              <span class="text-[var(--text-muted)]">日差允差:</span>
              <span class="ml-1 font-mono text-[var(--text-primary)]">±{{ currentReference.allow_rate_error }}s/d</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-6">
      <div class="col-span-3 space-y-6">
        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Gauge class="w-5 h-5 text-[var(--accent-gold)]" />
            实时测量参数
          </h3>
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="watch-label">当前摆幅 (°)</label>
                <input v-model.number="form.amplitude" type="number" step="1"
                       class="watch-input w-full font-mono text-xl" />
              </div>
              <div>
                <label class="watch-label">当前日差 (s/d)</label>
                <input v-model.number="form.rate" type="number" step="0.1"
                       class="watch-input w-full font-mono text-xl" />
              </div>
              <div>
                <label class="watch-label">偏振 (ms)</label>
                <input v-model.number="form.beatError" type="number" step="0.01"
                       class="watch-input w-full font-mono text-xl" />
              </div>
            </div>
            <div class="space-y-4">
              <div>
                <label class="watch-label">锁接角 (°)</label>
                <input v-model.number="form.lockAngle" type="number" step="0.5"
                       class="watch-input w-full font-mono text-xl" />
              </div>
              <div>
                <label class="watch-label">冲量角 (°)</label>
                <input v-model.number="form.impulseAngle" type="number" step="0.5"
                       class="watch-input w-full font-mono text-xl" />
              </div>
              <div>
                <label class="watch-label">实测余隙 (°)</label>
                <input v-model.number="form.measuredClearance" type="number" step="0.1"
                       class="watch-input w-full font-mono text-xl" />
              </div>
            </div>
          </div>
        </div>

        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <TrendingUp class="w-5 h-5 text-[var(--accent-gold)]" />
            四摆幅点等时性校验
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-[var(--bg-tertiary)]">
                  <th class="p-3 text-left text-[var(--text-secondary)] font-medium">摆幅点</th>
                  <th class="p-3 text-center text-[var(--text-secondary)] font-medium">摆幅 (°)</th>
                  <th class="p-3 text-center text-[var(--text-secondary)] font-medium">日差 (s/d)</th>
                  <th class="p-3 text-center text-[var(--text-secondary)] font-medium">偏振 (ms)</th>
                  <th class="p-3 text-center text-[var(--text-secondary)] font-medium">偏差量</th>
                  <th class="p-3 text-center text-[var(--text-secondary)] font-medium">等级</th>
                  <th class="p-3 text-center text-[var(--text-secondary)] font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(point, index) in form.amplitudeRatePoints" :key="point.amplitude"
                    class="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30">
                  <td class="p-3 text-[var(--text-primary)] font-medium">
                    第{{ ['一', '二', '三', '四'][index] }}点
                  </td>
                  <td class="p-3 text-center">
                    <input v-model.number="point.amplitude" type="number" step="1"
                           class="watch-input w-24 font-mono text-center" />
                  </td>
                  <td class="p-3 text-center">
                    <input v-model.number="point.rate" type="number" step="0.1"
                           class="watch-input w-24 font-mono text-center" />
                  </td>
                  <td class="p-3 text-center">
                    <input v-model.number="point.beatError" type="number" step="0.01"
                           class="watch-input w-24 font-mono text-center" />
                  </td>
                  <td class="p-3 text-center font-mono"
                      :class="getIsochronismClass(isochronismResults.get(point.amplitude)?.level || '')">
                    {{ isochronismResults.get(point.amplitude)?.deviation.toFixed(2) || '-' }}
                  </td>
                  <td class="p-3 text-center">
                    <span class="status-badge"
                          :class="'status-' + (isochronismResults.get(point.amplitude)?.level || 'normal')">
                      {{ isochronismResults.get(point.amplitude)?.level || '-' }}
                    </span>
                  </td>
                  <td class="p-3 text-center">
                    <component :is="isochronismResults.get(point.amplitude)?.isInRange ? CheckCircle2 : XCircle"
                               class="w-5 h-5 mx-auto"
                               :class="isochronismResults.get(point.amplitude)?.isInRange ? 'text-green-400' : 'text-red-400'" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Compass class="w-5 h-5 text-[var(--accent-gold)]" />
            六方位位置误差测量
          </h3>
          <div class="grid grid-cols-6 gap-4">
            <div v-for="label in positionLabels" :key="label.key"
                 class="text-center p-4 rounded-lg border transition-all"
                 :class="getPositionErrorCardClass(label.key)">
              <div class="text-2xl mb-1" :class="getPositionErrorIconClass(label.key)">
                {{ label.icon }}
              </div>
              <div class="text-sm text-[var(--text-secondary)] mb-2">{{ label.label }}</div>
              <input v-model.number="form.positionErrors[label.key as keyof PositionErrors]"
                     type="number" step="0.1"
                     class="watch-input w-full font-mono text-center text-lg"
                     :class="getPositionErrorInputClass(label.key)" />
              <div v-if="isPositionErrorOverLimit(label.key as keyof PositionErrors)"
                   class="text-xs text-red-400 mt-1">超差</div>
            </div>
          </div>

          <div v-if="positionMatrixResult" class="mt-4 p-4 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center">
                <div class="text-sm text-[var(--text-secondary)]">最大位置差</div>
                <div class="text-2xl font-mono font-bold"
                     :class="positionMatrixResult.isPass ? 'text-green-400' : 'text-red-400'">
                  {{ positionMatrixResult.maxDeviation.toFixed(2) }} s/d
                </div>
              </div>
              <div class="text-center">
                <div class="text-sm text-[var(--text-secondary)]">平均误差</div>
                <div class="text-2xl font-mono font-bold text-[var(--text-primary)]">
                  {{ positionMatrixResult.average.toFixed(2) }} s/d
                </div>
              </div>
              <div class="text-center">
                <div class="text-sm text-[var(--text-secondary)]">评判结果</div>
                <div class="text-2xl font-bold"
                     :class="positionMatrixResult.isPass ? 'text-green-400' : 'text-red-400'">
                  {{ positionMatrixResult.isPass ? '合格' : '不合格' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Zap class="w-5 h-5 text-[var(--accent-gold)]" />
            擒纵机构分析
          </h3>
          <div class="grid grid-cols-2 gap-6">
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
              <h4 class="text-[var(--accent-gold)] font-medium mb-3">锁接与冲量传递</h4>
              <div v-if="lockImpulseAnalysis" class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-[var(--text-secondary)]">锁接角状态</span>
                  <span class="font-mono font-bold" :class="getLockImpulseClass(lockImpulseAnalysis.lockStatus)">
                    {{ lockImpulseAnalysis.lockStatus === 'normal' ? '正常' :
                       lockImpulseAnalysis.lockStatus === 'too_large' ? '过大' : '过小' }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[var(--text-secondary)]">冲量角状态</span>
                  <span class="font-mono font-bold" :class="getLockImpulseClass(lockImpulseAnalysis.impulseStatus)">
                    {{ lockImpulseAnalysis.impulseStatus === 'normal' ? '正常' :
                       lockImpulseAnalysis.impulseStatus === 'too_large' ? '过大' : '过小' }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[var(--text-secondary)]">等时区间</span>
                  <span class="font-mono font-bold" :class="lockImpulseAnalysis.isochronismZone ? 'text-green-400' : 'text-red-400'">
                    {{ lockImpulseAnalysis.isochronismZone ? '是' : '否' }}
                  </span>
                </div>
                <div class="mt-4 p-3 rounded bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)]">
                  {{ lockImpulseAnalysis.message }}
                </div>
              </div>
            </div>

            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
              <h4 class="text-[var(--accent-gold)] font-medium mb-3">擒纵余隙校验</h4>
              <div v-if="clearanceResult" class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-[var(--text-secondary)]">理论余隙</span>
                  <span class="font-mono font-bold text-[var(--text-primary)]">
                    {{ clearanceResult.theoreticalClearance.toFixed(2) }}°
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[var(--text-secondary)]">实测余隙</span>
                  <span class="font-mono font-bold"
                        :class="clearanceResult.hasRisk ? 'text-red-400' : 'text-green-400'">
                    {{ form.measuredClearance.toFixed(2) }}°
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[var(--text-secondary)]">容差范围</span>
                  <span class="font-mono font-bold text-[var(--text-primary)]">
                    ±{{ clearanceResult.tolerance.toFixed(2) }}°
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[var(--text-secondary)]">脱跳风险</span>
                  <span class="font-mono font-bold"
                        :class="clearanceResult.hasRisk ? 'text-red-400' : 'text-green-400'">
                    {{ clearanceResult.hasRisk ? '存在' : '无' }}
                  </span>
                </div>
                <div class="mt-4 p-3 rounded bg-[var(--bg-secondary)] text-sm"
                     :class="clearanceResult.hasRisk ? 'text-red-400' : 'text-[var(--text-secondary)]'">
                  {{ clearanceResult.suggestion }}
                </div>
              </div>
              <div v-else class="text-[var(--text-muted)] text-center py-8">
                请先设置擒纵轮齿数
              </div>
            </div>
          </div>
        </div>

        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Thermometer class="w-5 h-5 text-[var(--accent-gold)]" />
            位置差原因分析
          </h3>
          <div class="grid grid-cols-2 gap-6">
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center"
                       :class="positionErrorAnalysis.hasEccentricity ? 'bg-red-900/30' : 'bg-green-900/30'">
                    <component :is="positionErrorAnalysis.hasEccentricity ? XCircle : CheckCircle2"
                               class="w-5 h-5"
                               :class="positionErrorAnalysis.hasEccentricity ? 'text-red-400' : 'text-green-400'" />
                  </div>
                  <div>
                    <div class="font-medium" :class="positionErrorAnalysis.hasEccentricity ? 'text-red-400' : 'text-green-400'">
                      游丝偏心
                    </div>
                    <div class="text-sm text-[var(--text-muted)]">
                      {{ positionErrorAnalysis.hasEccentricity ? '检测到偏心' : '正常' }}
                    </div>
                  </div>
                </div>
                <div v-if="positionErrorAnalysis.eccentricityDirection"
                     class="p-3 rounded bg-red-900/20 border border-red-600 text-red-400 text-sm">
                  {{ positionErrorAnalysis.eccentricityDirection }}
                </div>
              </div>
            </div>

            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center"
                       :class="positionErrorAnalysis.hasEndCurveIssue ? 'bg-red-900/30' : 'bg-green-900/30'">
                    <component :is="positionErrorAnalysis.hasEndCurveIssue ? XCircle : CheckCircle2"
                               class="w-5 h-5"
                               :class="positionErrorAnalysis.hasEndCurveIssue ? 'text-red-400' : 'text-green-400'" />
                  </div>
                  <div>
                    <div class="font-medium" :class="positionErrorAnalysis.hasEndCurveIssue ? 'text-red-400' : 'text-green-400'">
                      末端曲线问题
                    </div>
                    <div class="text-sm text-[var(--text-muted)]">
                      {{ positionErrorAnalysis.hasEndCurveIssue ? '检测到异常' : '正常' }}
                    </div>
                  </div>
                </div>
                <div v-if="positionErrorAnalysis.hasEndCurveIssue"
                     class="p-3 rounded bg-red-900/20 border border-red-600 text-red-400 text-sm">
                  建议检查游丝末端曲线的曲率和高度
                </div>
              </div>
            </div>
          </div>

          <div v-if="positionErrorAnalysis.hasEccentricity"
               class="mt-4 p-4 rounded-lg bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]">
            <h4 class="text-[var(--accent-gold)] font-medium mb-3">偏心校正建议</h4>
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center">
                <div class="text-sm text-[var(--text-secondary)]">偏心量</div>
                <div class="text-xl font-mono font-bold text-[var(--text-primary)]">
                  {{ eccentricityAdjustment.eccentricity.toFixed(1) }} s/d
                </div>
              </div>
              <div class="text-center">
                <div class="text-sm text-[var(--text-secondary)]">偏移方向</div>
                <div class="text-xl font-bold text-[var(--accent-gold)]">
                  {{ eccentricityAdjustment.direction }}
                </div>
              </div>
              <div class="text-center">
                <div class="text-sm text-[var(--text-secondary)]">建议位移</div>
                <div class="text-xl font-mono font-bold text-[var(--text-primary)]">
                  {{ eccentricityAdjustment.displacement.toFixed(2) }} mm
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 p-4 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
            <p class="text-[var(--text-secondary)]">
              {{ positionErrorAnalysis.analysis }}
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Gauge class="w-5 h-5 text-[var(--accent-gold)]" />
            摆幅仪表盘
          </h3>
          <div id="amplitude-gauge" class="h-64"></div>
        </div>

        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Clock class="w-5 h-5 text-[var(--accent-gold)]" />
            日差仪表盘
          </h3>
          <div id="rate-gauge" class="h-64"></div>
        </div>

        <div class="watch-card">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <ShieldAlert class="w-5 h-5 text-[var(--accent-gold)]" />
            风险告警
            <span class="ml-auto status-badge" :class="riskAlerts.length > 0 ? 'status-poor' : 'status-excellent'">
              {{ riskAlerts.length }} 项
            </span>
          </h3>
          <div v-if="riskAlerts.length === 0"
               class="py-8 text-center text-[var(--text-muted)]">
            <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 class="w-8 h-8 text-green-400" />
            </div>
            <p class="text-green-400">运行状态良好</p>
            <p class="text-sm">暂无风险告警</p>
          </div>
          <div v-else class="space-y-3 max-h-96 overflow-y-auto">
            <div v-for="(alert, index) in riskAlerts" :key="index"
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

        <div class="watch-card space-y-3">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <FileText class="w-5 h-5 text-[var(--accent-gold)]" />
            诊断报告
          </h3>
          <button @click="saveDiagnosis"
                  :disabled="saving || !form.movementId"
                  class="w-full watch-btn watch-btn-primary flex items-center justify-center gap-2">
            <Save class="w-4 h-4" />
            {{ saving ? '保存中...' : '保存诊断' }}
          </button>
          <button @click="downloadReport"
                  :disabled="!form.movementId"
                  class="w-full watch-btn watch-btn-secondary flex items-center justify-center gap-2">
            <Download class="w-4 h-4" />
            下载报告
          </button>
          <button @click="resetForm"
                  class="w-full watch-btn flex items-center justify-center gap-2
                         border-[var(--border-color)] text-[var(--text-secondary)]
                         hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]">
            <RotateCcw class="w-4 h-4" />
            重置数据
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-6">
      <div class="watch-card">
        <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <Compass class="w-5 h-5 text-[var(--accent-gold)]" />
          六方位误差雷达图
        </h3>
        <div id="position-radar" class="h-80"></div>
      </div>

      <div class="watch-card">
        <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <Activity class="w-5 h-5 text-[var(--accent-gold)]" />
          3×2姿态误差矩阵
        </h3>
        <div id="position-heatmap" class="h-80"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6">
      <div class="watch-card">
        <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <TrendingUp class="w-5 h-5 text-[var(--accent-gold)]" />
          等时性曲线分析
          <span class="ml-auto text-sm text-[var(--text-muted)]">
            摆幅从高到低 (270°→180°)，日差变化越小等时性越好
          </span>
        </h3>
        <div id="isochronism-chart" class="h-96"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.watch-input::-webkit-outer-spin-button,
.watch-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.watch-input[type=number] {
  -moz-appearance: textfield;
}
</style>