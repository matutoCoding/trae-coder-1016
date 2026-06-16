<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { useMovementStore } from '@/stores/movement'
import { useDiagnosisStore } from '@/stores/diagnosis'
import {
  Thermometer,
  Scissors,
  Compass,
  Ruler,
  CircleDot,
  Save,
  RotateCcw,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-vue-next'
import type { PositionErrors, TrimCoilsResult, ClearanceCheckResult, TemperatureDriftPoint, Calibration, EccentricitySnapshot } from '@/types'
import {
  simulateTemperatureDrift,
  simulateTemperatureDriftByMaterial,
  calculateWearingRangeDeviation,
  HAIRSPRING_MATERIALS,
  calculateTrimCoils,
  checkEscapementClearance,
  analyzePositionErrorCauses,
  calculateEccentricityAdjustment,
  calculatePositionMatrix
} from '@/utils/calculator'

const movementStore = useMovementStore()
const diagnosisStore = useDiagnosisStore()

const loading = ref(false)
const tempChartRef = ref<HTMLElement | null>(null)
const vectorChartRef = ref<HTMLElement | null>(null)
let tempChartInstance: echarts.ECharts | null = null
let vectorChartInstance: echarts.ECharts | null = null

const activeTab = ref<'temp' | 'trim' | 'eccentric' | 'clearance'>('temp')

function getTabClass(tab: string) {
  if (activeTab.value === tab) {
    return 'border-[var(--accent-gold)] text-[var(--accent-gold)]'
  }
  return 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
}

function getPositionAnalysisCardClass() {
  if (positionAnalysis.value.hasEccentricity || positionAnalysis.value.hasEndCurveIssue) {
    return 'border-yellow-600 bg-yellow-900/20'
  }
  return 'border-green-600 bg-green-900/20'
}

function getPositionAnalysisTextClass() {
  if (positionAnalysis.value.hasEccentricity || positionAnalysis.value.hasEndCurveIssue) {
    return 'text-yellow-400'
  }
  return 'text-green-400'
}

function getClearanceStatusTextClass() {
  if (clearanceResult.value.hasRisk) {
    return 'text-red-400'
  }
  if (clearanceParams.measuredClearance < clearanceResult.value.theoreticalClearance - clearanceResult.value.tolerance) {
    return 'text-yellow-400'
  }
  return 'text-green-400'
}

function getClearanceCardClass() {
  if (clearanceResult.value.hasRisk) {
    return 'border-red-600 bg-red-900/20'
  }
  if (clearanceParams.measuredClearance < clearanceResult.value.theoreticalClearance - clearanceResult.value.tolerance) {
    return 'border-yellow-600 bg-yellow-900/20'
  }
  return 'border-green-600 bg-green-900/20'
}

const tempParams = reactive({
  baseModulus: 180,
  frequency: 4.0
})

const trimParams = reactive({
  currentRate: 0,
  targetRate: 0,
  currentCoils: 12.5
})

const positionErrors = reactive<PositionErrors>({
  face_up: 0,
  face_down: 0,
  crown_left: 0,
  crown_right: 0,
  crown_up: 0,
  crown_down: 0
})

const clearanceParams = reactive({
  lockAngle: 12,
  impulseAngle: 40,
  teeth: 20,
  measuredClearance: 2
})

const hairspringParams = reactive({
  thickness: 0.018,
  width: 0.12,
  coils: 12.5,
  innerDiameter: 2.5,
  outerDiameter: 8.0
})

const temperatureDriftData = ref<TemperatureDriftPoint[]>([])
const trimResult = ref<TrimCoilsResult | null>(null)
const clearanceResult = ref<ClearanceCheckResult | null>(null)
const eccentricityAdjustment = ref<{
  eccentricity: number
  direction: string
  displacement: number
} | null>(null)
const positionAnalysis = ref<{
  hasEccentricity: boolean
  hasEndCurveIssue: boolean
  eccentricityDirection?: string
  analysis: string
} | null>(null)
const positionMatrix = ref<{
  matrix: number[][]
  maxDeviation: number
  average: number
  isPass: boolean
} | null>(null)

const savedSchemes = ref<Calibration[]>([])
const selectedMaterial = ref<string>('普通钢游丝')
const compareMaterials = ref<string[]>(['Nivarox'])
const hairspringMaterials = HAIRSPRING_MATERIALS
const eccentricitySnapshots = ref<EccentricitySnapshot[]>([])
const wearingRangeDeviation = ref<number>(0)

function updateTempChart() {
  if (!tempChartRef.value) return
  if (!tempChartInstance || tempChartInstance.isDisposed()) {
    tempChartInstance = echarts.init(tempChartRef.value)
  }

  const currentMaterial = hairspringMaterials.find(m => m.name === selectedMaterial.value) || hairspringMaterials[0]
  temperatureDriftData.value = simulateTemperatureDriftByMaterial(
    tempParams.baseModulus,
    tempParams.frequency,
    [-10, 60],
    currentMaterial
  )

  wearingRangeDeviation.value = calculateWearingRangeDeviation(
    tempParams.baseModulus,
    tempParams.frequency,
    currentMaterial
  )

  const tempData = temperatureDriftData.value.map(d => d.temp)
  const rateData = temperatureDriftData.value.map(d => d.rate)
  const modulusData = temperatureDriftData.value.map(d => d.modulus)

  const legendData: string[] = [`${currentMaterial.name} 日差`, '弹性模量']
  const seriesList: any[] = [
    {
      name: `${currentMaterial.name} 日差`,
      type: 'line',
      data: rateData,
      smooth: true,
      lineStyle: {
        color: currentMaterial.color,
        width: 3
      },
      itemStyle: {
        color: currentMaterial.color
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: currentMaterial.color + '4D' },
          { offset: 1, color: currentMaterial.color + '0D' }
        ])
      },
      markLine: {
        symbol: 'none',
        data: [
          { yAxis: 0, lineStyle: { color: '#28A745', type: 'dashed', width: 2 } }
        ],
        label: { show: false }
      },
      markArea: {
        silent: true,
        data: [[
          { xAxis: '8', itemStyle: { color: 'rgba(40, 167, 69, 0.08)' } },
          { xAxis: '38' }
        ]],
        label: { show: false }
      }
    },
    {
      name: '弹性模量',
      type: 'line',
      yAxisIndex: 1,
      data: modulusData,
      smooth: true,
      lineStyle: {
        color: '#17A2B8',
        width: 2,
        type: 'dashed'
      },
      itemStyle: {
        color: '#17A2B8'
      }
    }
  ]

  compareMaterials.value.forEach(matName => {
    if (matName === selectedMaterial.value) return
    const mat = hairspringMaterials.find(m => m.name === matName)
    if (!mat) return
    const matData = simulateTemperatureDriftByMaterial(tempParams.baseModulus, tempParams.frequency, [-10, 60], mat)
    const matRateData = matData.map(d => d.rate)
    legendData.push(`${mat.name} 日差`)
    seriesList.push({
      name: `${mat.name} 日差`,
      type: 'line',
      data: matRateData,
      smooth: true,
      lineStyle: {
        color: mat.color,
        width: 2,
        type: 'dashed'
      },
      itemStyle: {
        color: mat.color
      }
    })
  })

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(19, 39, 68, 0.95)',
      borderColor: '#B8860B',
      textStyle: { color: '#E8E8E8' },
      formatter: (params: any) => {
        const tempIdx = params[0]?.dataIndex
        const temp = temperatureDriftData.value[tempIdx]?.temp
        if (temp == null) return ''
        let html = `<div style="font-family: 'JetBrains Mono', monospace;"><div style="margin-bottom: 8px; font-weight: bold; color: #B8860B;">温度: ${temp}°C</div>`
        params.forEach((p: any) => {
          const color = p.color || '#E8E8E8'
          html += `<div style="color: ${color};">${p.seriesName}: ${p.value > 0 ? '+' : ''}${Number(p.value).toFixed(2)}${p.seriesName.includes('日差') ? ' s/d' : ' GPa'}</div>`
        })
        html += '</div>'
        return html
      }
    },
    legend: {
      data: legendData,
      textStyle: { color: '#A0AEC0' },
      top: 10
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'category',
      data: tempData,
      name: '温度 (°C)',
      nameTextStyle: { color: '#A0AEC0' },
      axisLine: { lineStyle: { color: '#2A4A6E' } },
      axisLabel: { color: '#A0AEC0' },
      splitLine: { lineStyle: { color: '#1E3A5F' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '日差 (s/d)',
        nameTextStyle: { color: '#DAA520' },
        axisLine: { lineStyle: { color: '#2A4A6E' } },
        axisLabel: { color: '#A0AEC0' },
        splitLine: { lineStyle: { color: '#1E3A5F' } }
      },
      {
        type: 'value',
        name: '弹性模量 (GPa)',
        nameTextStyle: { color: '#17A2B8' },
        axisLine: { lineStyle: { color: '#2A4A6E' } },
        axisLabel: { color: '#A0AEC0' },
        splitLine: { show: false }
      }
    ],
    series: seriesList
  }

  tempChartInstance.setOption(option, true)
}

function updateVectorChart() {
  if (!vectorChartRef.value) return
  if (!vectorChartInstance || vectorChartInstance.isDisposed()) {
    vectorChartInstance = echarts.init(vectorChartRef.value)
  }

  const { crown_left, crown_right, crown_up, crown_down } = positionErrors
  const lateralError = crown_right - crown_left
  const verticalError = crown_down - crown_up

  const maxVal = Math.max(Math.abs(lateralError), Math.abs(verticalError), 5)
  const scale = 80 / maxVal

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(19, 39, 68, 0.95)',
      borderColor: '#B8860B',
      textStyle: { color: '#E8E8E8' }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '10%',
      top: '10%'
    },
    xAxis: {
      type: 'value',
      min: -100,
      max: 100,
      show: false
    },
    yAxis: {
      type: 'value',
      min: -100,
      max: 100,
      show: false
    },
    series: [
      {
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 8,
        data: [[0, 0]],
        itemStyle: { color: '#B8860B' }
      },
      {
        type: 'line',
        smooth: false,
        lineStyle: {
          color: '#2A4A6E',
          width: 1
        },
        data: [
          { value: [0, 100] }, { value: [0, -100] },
          { value: [100, 0] }, { value: [-100, 0] }
        ],
        symbol: 'none'
      },
      {
        type: 'line',
        smooth: false,
        lineStyle: {
          color: '#1E3A5F',
          width: 1,
          type: 'dashed'
        },
        data: [
          { value: [70.7, 70.7] }, { value: [-70.7, -70.7] },
          { value: [70.7, -70.7] }, { value: [-70.7, 70.7] }
        ],
        symbol: 'none'
      },
      {
        type: 'line',
        smooth: false,
        lineStyle: {
          color: '#DC3545',
          width: 3
        },
        data: [
          { value: [0, 0] }, { value: [lateralError * scale, verticalError * scale] }
        ],
        symbol: 'none',
        markPoint: {
          symbol: 'arrow',
          symbolSize: [15, 25],
          itemStyle: { color: '#DC3545' },
          data: [{ name: '偏心方向', coord: [lateralError * scale, verticalError * scale] }]
        }
      },
      ...(eccentricitySnapshots.value.length >= 2 ? (() => {
        const prev = eccentricitySnapshots.value[eccentricitySnapshots.value.length - 2]
        const prevLateral = prev.position_errors.crown_right - prev.position_errors.crown_left
        const prevVertical = prev.position_errors.crown_down - prev.position_errors.crown_up
        return [{
          type: 'line' as const,
          smooth: false,
          lineStyle: { color: 'rgba(23, 162, 184, 0.6)', width: 2, type: 'dashed' as const },
          data: [[0, 0], [prevLateral * scale, prevVertical * scale]],
          symbol: 'none',
          markPoint: {
            symbol: 'arrow',
            symbolSize: [12, 20],
            itemStyle: { color: 'rgba(23, 162, 184, 0.8)' },
            data: [{ name: '上次偏心', coord: [prevLateral * scale, prevVertical * scale] }]
          }
        }]
      })() : []),
      {
        type: 'gauge' as const,
        radius: '90%',
        startAngle: 90,
        endAngle: -270,
        pointer: { show: false },
        axisLine: {
          lineStyle: {
            width: 2,
            color: [[1, '#2A4A6E']]
          }
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        detail: { show: false }
      }
    ],
    graphic: [
      {
        type: 'text',
        left: '50%',
        top: '5%',
        style: {
          text: '12点',
          fill: '#A0AEC0',
          fontSize: 12
        }
      },
      {
        type: 'text',
        left: '95%',
        top: '48%',
        style: {
          text: '3点',
          fill: '#A0AEC0',
          fontSize: 12
        }
      },
      {
        type: 'text',
        left: '50%',
        top: '90%',
        style: {
          text: '6点',
          fill: '#A0AEC0',
          fontSize: 12
        }
      },
      {
        type: 'text',
        left: '2%',
        top: '48%',
        style: {
          text: '9点',
          fill: '#A0AEC0',
          fontSize: 12
        }
      }
    ]
  }

  vectorChartInstance.setOption(option)
}

function calculateTrim() {
  if (trimParams.currentCoils <= 0) {
    ElMessage.warning('有效圈数必须大于0')
    return
  }
  trimResult.value = calculateTrimCoils(
    trimParams.currentRate,
    trimParams.targetRate,
    trimParams.currentCoils
  )
}

function calculateEccentric() {
  positionMatrix.value = calculatePositionMatrix(positionErrors)
  positionAnalysis.value = analyzePositionErrorCauses(positionErrors)
  eccentricityAdjustment.value = calculateEccentricityAdjustment(positionErrors)

  const snapshot: EccentricitySnapshot = {
    timestamp: new Date().toISOString(),
    position_errors: { ...positionErrors },
    eccentricity: eccentricityAdjustment.value.eccentricity,
    direction: eccentricityAdjustment.value.direction,
    displacement: eccentricityAdjustment.value.displacement
  }
  eccentricitySnapshots.value.push(snapshot)

  updateVectorChart()
}

function calculateClearance() {
  if (clearanceParams.teeth <= 0) {
    ElMessage.warning('齿数必须大于0')
    return
  }
  clearanceResult.value = checkEscapementClearance(
    clearanceParams.lockAngle,
    clearanceParams.impulseAngle,
    clearanceParams.teeth,
    clearanceParams.measuredClearance
  )
}

async function saveScheme() {
  const currentMovement = movementStore.currentMovement
  if (!currentMovement?.id) {
    ElMessage.warning('请先选择机芯档案')
    return
  }

  const now = new Date().toISOString()
  const calibration: Calibration = {
    movement_id: currentMovement.id,
    temperature: 20,
    elastic_modulus: tempParams.baseModulus,
    rate_drift: trimResult.value?.trimCoils,
    target_rate: trimParams.targetRate,
    trim_coils: trimResult.value?.trimCoils,
    eccentricity: eccentricityAdjustment.value?.eccentricity,
    adjust_direction: eccentricityAdjustment.value?.direction,
    timestamp: now,
    temp_params: { baseModulus: tempParams.baseModulus, frequency: tempParams.frequency },
    trim_params: { currentRate: trimParams.currentRate, targetRate: trimParams.targetRate, currentCoils: trimParams.currentCoils },
    position_errors: { ...positionErrors },
    clearance_params: { ...clearanceParams },
    hairspring_params: { ...hairspringParams },
    material: selectedMaterial.value,
    eccentricity_snapshots: [...eccentricitySnapshots.value]
  }

  loading.value = true
  try {
    if (window.electronAPI) {
      const result = await window.electronAPI.saveCalibration(calibration)
      if (result.success) {
        ElMessage.success('调整方案保存成功')
        loadSavedSchemes()
      } else {
        ElMessage.error(result.error || '保存失败')
      }
    } else {
      savedSchemes.value.push({ ...calibration, id: Date.now(), timestamp: now })
      ElMessage.success('调整方案保存成功')
    }
  } finally {
    loading.value = false
  }
}

async function loadSavedSchemes() {
  const currentMovement = movementStore.currentMovement
  if (!currentMovement?.id) return

  if (window.electronAPI) {
    const result = await window.electronAPI.getCalibrations(currentMovement.id)
    if (result.success) {
      savedSchemes.value = (result.data || []).sort((a: Calibration, b: Calibration) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return tb - ta
      })
    }
  }
}

function loadScheme(scheme: Calibration) {
  if (scheme.temp_params) {
    tempParams.baseModulus = scheme.temp_params.baseModulus
    tempParams.frequency = scheme.temp_params.frequency
  }
  if (scheme.trim_params) {
    trimParams.currentRate = scheme.trim_params.currentRate
    trimParams.targetRate = scheme.trim_params.targetRate
    trimParams.currentCoils = scheme.trim_params.currentCoils
  }
  if (scheme.position_errors) {
    Object.assign(positionErrors, scheme.position_errors)
  }
  if (scheme.clearance_params) {
    Object.assign(clearanceParams, scheme.clearance_params)
  }
  if (scheme.hairspring_params) {
    Object.assign(hairspringParams, scheme.hairspring_params)
  }
  if (scheme.material) {
    selectedMaterial.value = scheme.material
  }
  if (scheme.eccentricity_snapshots) {
    eccentricitySnapshots.value = [...scheme.eccentricity_snapshots]
  }
  if (scheme.eccentricity != null) {
    calculateEccentric()
  }
  if (scheme.clearance_params) {
    calculateClearance()
  }
  activeTab.value = 'temp'
  nextTick(() => {
    updateTempChart()
  })
  ElMessage.success('方案参数已回填')
}

async function deleteScheme(scheme: Calibration) {
  if (!scheme.id) return
  if (window.electronAPI) {
    const result = await window.electronAPI.remove('calibration', scheme.id)
    if (result.success) {
      ElMessage.success('方案已删除')
      loadSavedSchemes()
    } else {
      ElMessage.error('删除失败')
    }
  } else {
    savedSchemes.value = savedSchemes.value.filter(s => s.id !== scheme.id)
    ElMessage.success('方案已删除')
  }
}

async function renameScheme(scheme: Calibration) {
  const newName = window.prompt('请输入新的方案名称', scheme.name || '')
  if (!newName) return
  if (window.electronAPI && scheme.id) {
    const result = await window.electronAPI.update('calibration', scheme.id, { name: newName })
    if (result.success) {
      ElMessage.success('方案已重命名')
      loadSavedSchemes()
    } else {
      ElMessage.error('重命名失败')
    }
  } else {
    scheme.name = newName
    ElMessage.success('方案已重命名')
  }
}

function resetAll() {
  trimResult.value = null
  clearanceResult.value = null
  eccentricityAdjustment.value = null
  positionAnalysis.value = null
  positionMatrix.value = null
}

function exportScheme() {
  const data = {
    temperature: tempParams,
    trim: { params: trimParams, result: trimResult.value },
    position: { errors: positionErrors, adjustment: eccentricityAdjustment.value, analysis: positionAnalysis.value },
    clearance: { params: clearanceParams, result: clearanceResult.value },
    hairspring: hairspringParams,
    timestamp: new Date().toISOString()
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hairspring-calibration-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('方案已导出')
}

const hairspringPath = computed(() => {
  const coils = hairspringParams.coils
  const innerR = hairspringParams.innerDiameter / 2
  const outerR = hairspringParams.outerDiameter / 2

  const points: string[] = []
  const totalAngle = coils * Math.PI * 2
  const step = 0.1

  for (let t = 0; t <= totalAngle; t += step) {
    const progress = t / totalAngle
    const r = innerR + (outerR - innerR) * progress
    const x = 100 + r * Math.cos(t) * 20
    const y = 100 + r * Math.sin(t) * 20
    points.push(x.toFixed(2) + ',' + y.toFixed(2))
  }

  return 'M ' + points.join(' L ')
})

watch([() => tempParams.baseModulus, () => tempParams.frequency], () => {
  updateTempChart()
}, { deep: true })

watch([selectedMaterial, compareMaterials], () => {
  updateTempChart()
}, { deep: true })

watch(positionErrors, () => {
  if (activeTab.value === 'eccentric') {
    calculateEccentric()
  }
}, { deep: true })

watch(activeTab, (tab) => {
  nextTick(() => {
    if (tab === 'temp') {
      if (tempChartRef.value) {
        if (!tempChartInstance || !document.body.contains(tempChartInstance.getDom())) {
          tempChartInstance?.dispose()
          tempChartInstance = echarts.init(tempChartRef.value)
        }
        tempChartInstance.resize()
        updateTempChart()
      }
    } else if (tab === 'eccentric') {
      if (vectorChartRef.value) {
        if (!vectorChartInstance || !document.body.contains(vectorChartInstance.getDom())) {
          vectorChartInstance?.dispose()
          vectorChartInstance = echarts.init(vectorChartRef.value)
        }
        vectorChartInstance.resize()
        if (positionMatrix.value) {
          updateVectorChart()
        }
      }
    }
  })
})

onMounted(() => {
  if (tempChartRef.value) {
    tempChartInstance = echarts.init(tempChartRef.value)
    updateTempChart()
  }
  if (vectorChartRef.value) {
    vectorChartInstance = echarts.init(vectorChartRef.value)
  }

  loadSavedSchemes()

  window.addEventListener('resize', () => {
    tempChartInstance?.resize()
    vectorChartInstance?.resize()
  })
})

watch(() => movementStore.currentMovement, (m) => {
  if (m?.id) {
    loadSavedSchemes()
  }
})

onBeforeUnmount(() => {
  tempChartInstance?.dispose()
  vectorChartInstance?.dispose()
})
</script>

<template>
  <div class="space-y-6">
    <div class="watch-card">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-600 to-yellow-700 flex items-center justify-center">
            <Coil class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-[var(--text-primary)]">游丝配平计算</h2>
            <p class="text-sm text-[var(--text-secondary)]">
              游丝是机械表的心脏，精确调校是走时精度的关键
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <button @click="exportScheme" class="watch-btn watch-btn-secondary flex items-center gap-2">
            <Download class="w-4 h-4" />
            导出方案
          </button>
          <button @click="saveScheme" :disabled="loading" class="watch-btn watch-btn-primary flex items-center gap-2">
            <Save class="w-4 h-4" />
            {{ loading ? '保存中...' : '保存方案' }}
          </button>
        </div>
      </div>

      <div class="border-b border-[var(--border-color)] mb-6">
        <div class="flex gap-6">
          <button
            @click="activeTab = 'temp'"
            class="py-3 px-1 border-b-2 transition-colors flex items-center gap-2"
            :class="getTabClass('temp')">
            <Thermometer class="w-4 h-4" />
            温度漂移
          </button>
          <button
            @click="activeTab = 'trim'"
            class="py-3 px-1 border-b-2 transition-colors flex items-center gap-2"
            :class="getTabClass('trim')">
            <Scissors class="w-4 h-4" />
            修剪计算
          </button>
          <button
            @click="activeTab = 'eccentric'"
            class="py-3 px-1 border-b-2 transition-colors flex items-center gap-2"
            :class="getTabClass('eccentric')">
            <Compass class="w-4 h-4" />
            偏心检测
          </button>
          <button
            @click="activeTab = 'clearance'"
            class="py-3 px-1 border-b-2 transition-colors flex items-center gap-2"
            :class="getTabClass('clearance')">
            <Ruler class="w-4 h-4" />
            余隙校验
          </button>
        </div>
      </div>

      <div v-if="activeTab === 'temp'" class="grid grid-cols-3 gap-6">
        <div class="col-span-2 space-y-6">
          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
              <Thermometer class="w-5 h-5" />
              温度漂移模拟
            </h4>
            <div ref="tempChartRef" class="h-80"></div>
            <div class="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label class="watch-label">基础弹性模量 (GPa)</label>
                <input
                  v-model.number="tempParams.baseModulus"
                  type="number"
                  step="1"
                  class="watch-input w-full font-mono"
                />
              </div>
              <div>
                <label class="watch-label">振频 (Hz)</label>
                <input
                  v-model.number="tempParams.frequency"
                  type="number"
                  step="0.1"
                  class="watch-input w-full font-mono"
                />
              </div>
              <div>
                <label class="watch-label">游丝材质</label>
                <select v-model="selectedMaterial" class="watch-input w-full font-mono">
                  <option v-for="mat in hairspringMaterials" :key="mat.name" :value="mat.name">{{ mat.name }}</option>
                </select>
              </div>
              <div>
                <label class="watch-label">对比材质</label>
                <div class="flex flex-wrap gap-2">
                  <label v-for="mat in hairspringMaterials" :key="mat.name" class="flex items-center gap-1 text-sm">
                    <input type="checkbox" :value="mat.name" v-model="compareMaterials" class="accent-[var(--accent-gold)]" />
                    <span :style="{ color: mat.color }">{{ mat.name }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-6">
          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4">温度特性分析</h4>
            <div class="space-y-4">
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">当前材质</div>
                <div class="text-xl font-mono" :style="{ color: hairspringMaterials.find(m => m.name === selectedMaterial)?.color || '#DAA520' }">{{ selectedMaterial }}</div>
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">温度系数</div>
                <div class="text-xl font-mono text-[var(--text-primary)]">{{ hairspringMaterials.find(m => m.name === selectedMaterial)?.tempCoefficient || -0.0002 }} / °C</div>
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">测试范围</div>
                <div class="text-xl font-mono text-[var(--text-primary)]">-10°C ~ +60°C</div>
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">20°C日差</div>
                <div class="text-xl font-mono text-green-400">0.00 s/d</div>
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">最大漂移量</div>
                <div class="text-xl font-mono" :class="temperatureDriftData.length > 0 && Math.max(...temperatureDriftData.map(d => Math.abs(d.rate))) > 10 ? 'text-red-400' : 'text-green-400'">
                  {{ temperatureDriftData.length > 0 ? Math.max(...temperatureDriftData.map(d => Math.abs(d.rate))).toFixed(2) : '0.00' }} s/d
                </div>
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">佩戴温区最大日差 (8-38°C)</div>
                <div class="text-xl font-mono" :class="wearingRangeDeviation > 5 ? 'text-red-400' : wearingRangeDeviation > 2 ? 'text-yellow-400' : 'text-green-400'">
                  {{ wearingRangeDeviation.toFixed(2) }} s/d
                </div>
              </div>
            </div>
          </div>

          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4">游丝参数</h4>
            <div class="space-y-3">
              <div>
                <label class="watch-label">厚度 (mm)</label>
                <input v-model.number="hairspringParams.thickness" type="number" step="0.001" class="watch-input w-full font-mono" />
              </div>
              <div>
                <label class="watch-label">宽度 (mm)</label>
                <input v-model.number="hairspringParams.width" type="number" step="0.01" class="watch-input w-full font-mono" />
              </div>
              <div>
                <label class="watch-label">圈数</label>
                <input v-model.number="hairspringParams.coils" type="number" step="0.125" class="watch-input w-full font-mono" />
              </div>
              <div class="mt-4">
                <div class="text-sm text-[var(--text-secondary)] mb-2">游丝展开示意图</div>
                <div class="bg-[var(--bg-tertiary)]/30 rounded-lg p-4 aspect-square">
                  <svg viewBox="0 0 200 200" class="w-full h-full">
                    <defs>
                      <linearGradient id="hairspringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#B8860B;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#DAA520;stop-opacity:1" />
                      </linearGradient>
                    </defs>
                    <circle cx="100" cy="100" r="90" fill="none" stroke="#1E3A5F" stroke-width="1"/>
                    <circle cx="100" cy="100" r="60" fill="none" stroke="#1E3A5F" stroke-width="1"/>
                    <circle cx="100" cy="100" r="30" fill="none" stroke="#1E3A5F" stroke-width="1"/>
                    <path
                      :d="hairspringPath"
                      fill="none"
                      stroke="url(#hairspringGradient)"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                    <circle cx="100" cy="100" r="4" fill="#B8860B"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="text-center text-sm text-[var(--text-muted)] mt-2">
            游丝展开图 - 从内桩到外桩
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'trim'" class="grid grid-cols-2 gap-6">
        <div class="watch-card">
          <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
            <Scissors class="w-5 h-5" />
            反推修剪量
          </h4>
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label class="watch-label">当前日差 (s/d)</label>
              <input
                v-model.number="trimParams.currentRate"
                type="number"
                step="0.1"
                class="watch-input w-full font-mono"
                placeholder="+5.0"
              />
            </div>
            <div>
              <label class="watch-label">目标日差 (s/d)</label>
              <input
                v-model.number="trimParams.targetRate"
                type="number"
                step="0.1"
                class="watch-input w-full font-mono"
                placeholder="0.0"
              />
            </div>
            <div>
              <label class="watch-label">有效圈数</label>
              <input
                v-model.number="trimParams.currentCoils"
                type="number"
                step="0.125"
                class="watch-input w-full font-mono"
                placeholder="12.5"
              />
            </div>
          </div>
          <div class="flex gap-3">
            <button @click="calculateTrim" class="watch-btn watch-btn-primary flex items-center gap-2">
              <Scissors class="w-4 h-4" />
              计算修剪量
            </button>
            <button @click="resetAll" class="watch-btn watch-btn-secondary flex items-center gap-2">
              <RotateCcw class="w-4 h-4" />
              重置
            </button>
          </div>
        </div>
        <div class="watch-card">
          <h4 class="text-[var(--accent-gold)] font-medium mb-4">计算结果</h4>
          <div v-if="!trimResult" class="h-64 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <Scissors class="w-16 h-16 mb-4 opacity-50" />
            <p>输入参数后点击"计算修剪量"</p>
          </div>
          <div v-else class="space-y-4">
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
              <div class="text-sm text-[var(--text-secondary)] mb-2">日差偏差</div>
              <div class="text-3xl font-bold font-mono"
                   :class="trimParams.targetRate - trimParams.currentRate > 0 ? 'text-green-400' : 'text-red-400'">
                {{ trimParams.targetRate - trimParams.currentRate > 0 ? '+' : '' }}{{ (trimParams.targetRate - trimParams.currentRate).toFixed(1) }} s/d
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-2">操作方向</div>
                <div class="text-xl font-bold text-[var(--accent-gold)]">
                  {{ trimResult.direction === 'shorten' ? '剪短游丝' : '放长游丝' }}
                </div>
              </div>
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-2">修剪圈数</div>
                <div class="text-2xl font-bold font-mono text-[var(--accent-gold)]">
                  {{ trimResult.precision }} 圈
                </div>
              </div>
            </div>
            <div class="p-4 rounded-lg border-2" :class="trimResult.trimCoils > 1 ? 'border-red-600 bg-red-900/20' : 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'">
              <div class="flex items-start gap-3">
                <AlertTriangle v-if="trimResult.trimCoils > 1" class="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <CheckCircle v-else class="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div class="font-medium" :class="trimResult.trimCoils > 1 ? 'text-red-400' : 'text-green-400'">
                    {{ trimResult.trimCoils > 1 ? '修剪量较大' : '修剪量适中' }}
                  </div>
                  <div class="text-sm text-[var(--text-secondary)] mt-1">
                    {{ trimResult.trimCoils > 1
                      ? '建议检查是否存在其他问题，如游丝粘连、油丝变形等'
                      : trimResult.direction === 'shorten'
                        ? '使用游丝剪小心修剪外桩，精确到1/8圈'
                        : '松开外桩固定螺丝，缓慢放出适量游丝' }}
                  </div>
                </div>
              </div>
            </div>
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
              <div class="text-sm text-[var(--text-secondary)] mb-2">操作提示</div>
              <div class="text-[var(--text-primary)] text-sm">
                <ul class="list-disc list-inside space-y-1">
                  <li>使用游丝钳夹持游丝外端</li>
                  <li>沿游丝切线方向{{ trimResult.direction === 'shorten' ? '剪去' : '放出' }}{{ trimResult.precision }}圈</li>
                  <li>重新固定外桩，确保游丝平整</li>
                  <li>调校后需进行六方位测试</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'eccentric'" class="grid grid-cols-3 gap-6">
        <div class="col-span-2 space-y-6">
          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
              <Compass class="w-5 h-5" />
              六方位误差输入
            </h4>
            <div class="grid grid-cols-3 gap-4">
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/30">
                <label class="watch-label text-center">面上 (FU)</label>
                <input
                  v-model.number="positionErrors.face_up"
                  type="number"
                  step="0.1"
                  class="watch-input w-full font-mono text-center"
                />
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/30">
                <label class="watch-label text-center">面下 (FD)</label>
                <input
                  v-model.number="positionErrors.face_down"
                  type="number"
                  step="0.1"
                  class="watch-input w-full font-mono text-center"
                />
              </div>
              <div></div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/30">
                <label class="watch-label text-center">柄左 (CL)</label>
                <input
                  v-model.number="positionErrors.crown_left"
                  type="number"
                  step="0.1"
                  class="watch-input w-full font-mono text-center"
                />
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/30">
                <label class="watch-label text-center">柄右 (CR)</label>
                <input
                  v-model.number="positionErrors.crown_right"
                  step="0.1"
                  class="watch-input w-full font-mono text-center"
                />
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/30">
                <label class="watch-label text-center">柄上 (CU)</label>
                <input
                  v-model.number="positionErrors.crown_up"
                  type="number"
                  step="0.1"
                  class="watch-input w-full font-mono text-center"
                />
              </div>
              <div></div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/30">
                <label class="watch-label text-center">柄下 (CD)</label>
                <input
                  v-model.number="positionErrors.crown_down"
                  type="number"
                  step="0.1"
                  class="watch-input w-full font-mono text-center"
                />
              </div>
              <div></div>
            </div>
            <div class="mt-4 flex gap-3">
              <button @click="calculateEccentric" class="watch-btn watch-btn-primary flex items-center gap-2">
                <Compass class="w-4 h-4" />
                分析偏心
              </button>
              <button @click="resetAll" class="watch-btn watch-btn-secondary flex items-center gap-2">
                <RotateCcw class="w-4 h-4" />
                重置
              </button>
            </div>
          </div>

          <div v-if="positionMatrix" class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4">位置误差矩阵</h4>
            <div class="grid grid-cols-3 gap-4">
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">最大偏差</div>
                <div class="text-2xl font-mono font-bold"
                     :class="positionMatrix.maxDeviation > 15 ? 'text-red-400' : 'text-green-400'">
                  {{ positionMatrix.maxDeviation.toFixed(1) }} s/d
                </div>
              </div>
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">平均日差</div>
                <div class="text-2xl font-mono font-bold text-[var(--text-primary)]">
                  {{ positionMatrix.average.toFixed(1) }} s/d
                </div>
              </div>
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">判定结果</div>
                <span class="status-badge mt-1" :class="positionMatrix.isPass ? 'status-excellent' : 'status-poor'">
                  {{ positionMatrix.isPass ? '合格' : '不合格' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-6">
          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4">偏心矢量图</h4>
            <div ref="vectorChartRef" class="h-64"></div>
          </div>

          <div v-if="eccentricitySnapshots.length > 0" class="watch-card mt-4">
            <h4 class="text-[var(--accent-gold)] font-medium mb-3">偏心分析历史</h4>
            <div class="overflow-auto max-h-40">
              <table class="w-full">
                <thead class="bg-[var(--bg-tertiary)] sticky top-0">
                  <tr>
                    <th class="text-left p-2 text-xs text-[var(--text-secondary)]">时间</th>
                    <th class="text-left p-2 text-xs text-[var(--text-secondary)]">偏心度</th>
                    <th class="text-left p-2 text-xs text-[var(--text-secondary)]">方向</th>
                    <th class="text-left p-2 text-xs text-[var(--text-secondary)]">位移量</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(snap, idx) in [...eccentricitySnapshots].reverse()" :key="idx" class="border-b border-[var(--border-color)]">
                    <td class="p-2 text-xs text-[var(--text-secondary)]">{{ new Date(snap.timestamp).toLocaleString('zh-CN') }}</td>
                    <td class="p-2 text-xs font-mono" :class="snap.eccentricity > 5 ? 'text-red-400' : 'text-green-400'">{{ snap.eccentricity.toFixed(1) }} s/d</td>
                    <td class="p-2 text-xs text-[var(--text-primary)]">{{ snap.direction }}</td>
                    <td class="p-2 text-xs font-mono text-[var(--accent-gold)]">{{ snap.displacement.toFixed(2) }} mm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="eccentricityAdjustment && positionAnalysis" class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4">调整方案</h4>
            <div class="space-y-4">
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">偏心度</div>
                <div class="text-2xl font-mono font-bold"
                     :class="eccentricityAdjustment.eccentricity > 5 ? 'text-red-400' : 'text-green-400'">
                  {{ eccentricityAdjustment.eccentricity.toFixed(1) }} s/d
                </div>
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">调整方向</div>
                <div class="text-xl font-bold text-[var(--accent-gold)]">
                  {{ eccentricityAdjustment.direction }}
                </div>
              </div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-1">位移量</div>
                <div class="text-xl font-mono font-bold text-[var(--accent-gold)]">
                  {{ eccentricityAdjustment.displacement.toFixed(2) }} mm
                </div>
              </div>
              <div class="p-4 rounded-lg border-2"
                   :class="getPositionAnalysisCardClass()">
                <div class="flex items-start gap-3">
                  <AlertCircle v-if="positionAnalysis.hasEccentricity || positionAnalysis.hasEndCurveIssue"
                                 class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <CheckCircle v-else class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium"
                         :class="getPositionAnalysisTextClass()">
                      {{ positionAnalysis.hasEccentricity || positionAnalysis.hasEndCurveIssue ? '需要调整' : '状态良好' }}
                    </div>
                    <div class="text-sm text-[var(--text-secondary)] mt-1">
                      {{ positionAnalysis.analysis }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-2">调整步骤</div>
                <div class="text-[var(--text-primary)] text-sm">
                  <ul class="list-disc list-inside space-y-1">
                    <li>使用游丝校正器夹持内桩</li>
                    <li>向{{ eccentricityAdjustment.direction }}移动{{ eccentricityAdjustment.displacement.toFixed(2) }}mm</li>
                    <li>保持游丝平面度</li>
                    <li>调整后重新测试六方位</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="watch-card h-64 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <Compass class="w-16 h-16 mb-4 opacity-50" />
            <p>输入六方位误差后点击"分析偏心"</p>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'clearance'" class="grid grid-cols-2 gap-6">
        <div class="watch-card">
          <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
            <Ruler class="w-5 h-5" />
            擒纵余隙校验
          </h4>
          <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label class="watch-label">锁接角 (°)</label>
              <input
                v-model.number="clearanceParams.lockAngle"
                type="number"
                step="0.5"
                class="watch-input w-full font-mono"
              />
            </div>
            <div>
              <label class="watch-label">冲量角 (°)</label>
              <input
                v-model.number="clearanceParams.impulseAngle"
                type="number"
                step="0.5"
                class="watch-input w-full font-mono"
              />
            </div>
            <div>
              <label class="watch-label">擒纵轮齿数</label>
              <input
                v-model.number="clearanceParams.teeth"
                type="number"
                step="1"
                class="watch-input w-full font-mono"
              />
            </div>
            <div>
              <label class="watch-label">测量余隙 (°)</label>
              <input
                v-model.number="clearanceParams.measuredClearance"
                type="number"
                step="0.1"
                class="watch-input w-full font-mono"
              />
            </div>
          </div>
          <div class="flex gap-3">
            <button @click="calculateClearance" class="watch-btn watch-btn-primary flex items-center gap-2">
              <Ruler class="w-4 h-4" />
              校验余隙
            </button>
            <button @click="resetAll" class="watch-btn watch-btn-secondary flex items-center gap-2">
              <RotateCcw class="w-4 h-4" />
              重置
            </button>
          </div>
        </div>
        <div class="watch-card">
          <h4 class="text-[var(--accent-gold)] font-medium mb-4">校验结果</h4>
          <div v-if="!clearanceResult" class="h-64 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <Ruler class="w-16 h-16 mb-4 opacity-50" />
            <p>输入参数后点击"校验余隙"</p>
          </div>
          <div v-else class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-2">理论余隙</div>
                <div class="text-2xl font-mono font-bold text-[var(--text-primary)]">
                  {{ clearanceResult.theoreticalClearance.toFixed(2) }}°
                </div>
              </div>
              <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="text-sm text-[var(--text-secondary)] mb-2">公差范围</div>
                <div class="text-2xl font-mono font-bold text-[var(--text-primary)]">
                  ±{{ clearanceResult.tolerance.toFixed(2) }}°
                </div>
              </div>
            </div>
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
              <div class="text-sm text-[var(--text-secondary)] mb-2">允许范围</div>
              <div class="text-xl font-mono font-bold text-[var(--accent-gold)]">
              {{ (clearanceResult.theoreticalClearance - clearanceResult.tolerance).toFixed(2) }}°
               ~ 
              {{ (clearanceResult.theoreticalClearance + clearanceResult.tolerance).toFixed(2) }}°
              </div>
            </div>
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
              <div class="text-sm text-[var(--text-secondary)] mb-2">测量值</div>
              <div class="text-3xl font-mono font-bold"
                   :class="getClearanceStatusTextClass()">
                {{ clearanceParams.measuredClearance.toFixed(1) }}°
              </div>
            </div>
            <div class="p-4 rounded-lg border-2"
                 :class="getClearanceCardClass()">
              <div class="flex items-start gap-3">
                <AlertTriangle v-if="clearanceResult.hasRisk" class="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <AlertCircle v-else-if="clearanceParams.measuredClearance < clearanceResult.theoreticalClearance - clearanceResult.tolerance"
                              class="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                <CheckCircle v-else class="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div class="font-medium"
                       :class="getClearanceStatusTextClass()">
                    {{ clearanceResult.hasRisk ? '余隙异常' : clearanceParams.measuredClearance < clearanceResult.theoreticalClearance - clearanceResult.tolerance ? '余隙偏小' : '余隙正常' }}
                  </div>
                  <div class="text-sm text-[var(--text-secondary)] mt-1">
                    {{ clearanceResult.suggestion }}
                  </div>
                </div>
              </div>
            </div>
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
              <div class="text-sm text-[var(--text-secondary)] mb-2">计算公式</div>
              <div class="text-[var(--text-primary)] text-sm font-mono">
                余隙 = (360/齿数/2) - 锁接角 - 冲量角
              </div>
              <div class="text-[var(--text-muted)] text-xs mt-1">
                = (360/{{ clearanceParams.teeth }}/2) - {{ clearanceParams.lockAngle }}° - {{ clearanceParams.impulseAngle }}°
                = {{ clearanceResult.theoreticalClearance.toFixed(2) }}°
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="watch-card">
      <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
        <Clock class="w-5 h-5" />
        已保存的调整方案
      </h4>
      <div v-if="savedSchemes.length === 0" class="h-32 flex flex-col items-center justify-center text-[var(--text-muted)]">
        <Save class="w-12 h-12 mb-2 opacity-50" />
        <p>暂无保存的调整方案</p>
      </div>
      <div v-else class="overflow-auto max-h-64">
        <table class="w-full">
          <thead class="bg-[var(--bg-tertiary)] sticky top-0">
            <tr>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">方案名</th>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">时间</th>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">温度</th>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">日差</th>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">修剪圈数</th>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">偏心度</th>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">调整方向</th>
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="scheme in savedSchemes" :key="scheme.id"
                class="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30 transition-colors cursor-pointer"
                @click="loadScheme(scheme)">
              <td class="p-3 text-sm text-[var(--text-primary)]">{{ scheme.name || '方案 ' + (savedSchemes.length - savedSchemes.indexOf(scheme)) }}</td>
              <td class="p-3 text-sm text-[var(--text-secondary)]">
                {{ scheme.timestamp ? new Date(scheme.timestamp).toLocaleString('zh-CN') : '-' }}
              </td>
              <td class="p-3 font-mono text-[var(--text-primary)]">{{ scheme.temperature }}°C</td>
              <td class="p-3 font-mono" :class="(scheme.target_rate || 0) > 0 ? 'text-green-400' : 'text-red-400'">
                {{ (scheme.target_rate || 0) > 0 ? '+' : '' }}{{ (scheme.target_rate || 0).toFixed(1) }} s/d
              </td>
              <td class="p-3 font-mono text-[var(--accent-gold)]">{{ scheme.trim_coils?.toFixed(2) || '-' }} 圈</td>
              <td class="p-3 font-mono" :class="(scheme.eccentricity || 0) > 5 ? 'text-red-400' : 'text-green-400'">
                {{ (scheme.eccentricity || 0).toFixed(1) }} s/d
              </td>
              <td class="p-3 text-[var(--text-primary)]">{{ scheme.adjust_direction || '-' }}</td>
              <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button @click.stop="loadScheme(scheme)" class="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors" title="回填参数">
                    <RotateCcw class="w-4 h-4" />
                  </button>
                  <button @click.stop="renameScheme(scheme)" class="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors" title="重命名">
                    <Edit class="w-4 h-4" />
                  </button>
                  <button @click.stop="deleteScheme(scheme)" class="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-red-400 transition-colors" title="删除">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
