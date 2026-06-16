<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMovementStore } from '@/stores/movement'
import { useDiagnosisStore } from '@/stores/diagnosis'
import type { Movement, Diagnosis, Maintenance, AmplitudeRateData, RiskAlert } from '@/types'
import * as echarts from 'echarts'
import {
  FolderOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  Eye,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  Save,
  X,
  ChevronRight,
  Watch,
  Calendar,
  User,
  FileText,
  BarChart3,
  History,
  AlertCircle,
  CheckCircle2
} from 'lucide-vue-next'

const movementStore = useMovementStore()
const diagnosisStore = useDiagnosisStore()

const searchKeyword = ref('')
const loading = ref(false)
const selectedMovement = ref<Movement | null>(null)
const showCalibrationDialog = ref(false)
const showMaintenanceDialog = ref(false)
const showDetailDialog = ref(false)
const isEditing = ref(false)
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const calibrationForm = reactive({
  amplitude: 260,
  rate: 0,
  beat_error: 0,
  isochronism: '',
  lock_status: '',
  impulse_status: '',
  position_analysis: '',
  risk_warning: ''
})

const maintenanceForm = reactive({
  operation: '',
  before_amplitude: 0,
  after_amplitude: 0,
  before_rate: 0,
  after_rate: 0,
  technician: '',
  notes: ''
})

const editingRecord = ref<Diagnosis | null>(null)

function getMovementRowClass(id: number | undefined) {
  if (id && selectedMovement.value?.id === id) {
    return 'bg-[var(--accent-gold)]/20 border border-[var(--accent-gold)]'
  }
  return 'bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] border border-transparent'
}

function getAlertCardClass(level: string) {
  return level === 'danger' ? 'bg-red-900/20 border-red-600' : 'bg-yellow-900/20 border-yellow-600'
}

function getAlertIconClass(level: string) {
  return level === 'danger' ? 'text-red-400' : 'text-yellow-400'
}

function getAmplitudeStatusClass(amplitude: number | undefined) {
  if (amplitude === undefined) return 'status-excellent'
  if (amplitude < 220) return 'status-poor'
  if (amplitude < 240) return 'status-normal'
  return 'status-excellent'
}

const filteredMovements = computed(() => {
  if (!searchKeyword.value) return movementStore.movements
  const kw = searchKeyword.value.toLowerCase()
  return movementStore.movements.filter(m =>
    m.model?.toLowerCase().includes(kw) ||
    m.brand?.toLowerCase().includes(kw) ||
    m.serial?.toLowerCase().includes(kw) ||
    m.customer?.toLowerCase().includes(kw)
  )
})

const amplitudeRateData = computed(() => {
  if (!selectedMovement.value) return []
  return diagnosisStore.diagnosisHistory.map(d => ({
    amplitude: d.amplitude || 0,
    rate: d.rate || 0,
    time: d.diagnose_time || ''
  }))
})

const riskAlerts = computed((): RiskAlert[] => {
  const alerts: RiskAlert[] = []
  diagnosisStore.diagnosisHistory.forEach(d => {
    if (d.amplitude !== undefined && d.amplitude < 220) {
      alerts.push({
        type: 'low_amplitude',
        level: 'danger',
        message: `摆幅过低: ${d.amplitude}°`,
        suggestion: '可能存在动力不足或润滑油干涩，建议检查发条盒和重新点油'
      })
    }
    if (d.risk_warning) {
      alerts.push({
        type: 'escapement_risk',
        level: 'warning',
        message: d.risk_warning,
        suggestion: '建议进行详细的擒纵机构检查'
      })
    }
  })
  return alerts
})

const hasLowAmplitudeRisk = computed(() => {
  return diagnosisStore.diagnosisHistory.some(d =>
    d.amplitude !== undefined && d.amplitude < 220
  )
})

function selectMovement(m: Movement) {
  selectedMovement.value = m
  movementStore.setCurrentMovement(m)
  if (m.id) {
    diagnosisStore.loadDiagnosisHistory(m.id)
    diagnosisStore.loadMaintenanceHistory(m.id)
  }
  nextTick(() => {
    initChart()
  })
}

function initChart() {
  if (!chartRef.value) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const data = amplitudeRateData.value.map(d => [d.amplitude, d.rate, d.time])

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    grid: {
      left: '10%',
      right: '10%',
      top: '15%',
      bottom: '15%'
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(19, 39, 68, 0.95)',
      borderColor: '#B8860B',
      borderWidth: 1,
      textStyle: {
        color: '#E8E8E8'
      },
      formatter: (params: any) => {
        const [amplitude, rate, time] = params.value
        return `<div style="padding: 8px;">
          <div style="color: #B8860B; margin-bottom: 4px;">调校记录</div>
          <div>摆幅: <span style="color: #E8E8E8; font-family: monospace;">${amplitude}°</span></div>
          <div>日差: <span style="color: ${Math.abs(rate) > 5 ? '#DC3545' : '#28A745'}; font-family: monospace;">${rate > 0 ? '+' : ''}${rate} s/d</span></div>
          <div style="color: #6B7280; font-size: 12px; margin-top: 4px;">${time ? new Date(time).toLocaleString('zh-CN') : '-'}</div>
        </div>`
      }
    },
    xAxis: {
      type: 'value',
      name: '摆幅 (°)',
      nameTextStyle: {
        color: '#A0AEC0',
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: '#2A4A6E'
        }
      },
      axisLabel: {
        color: '#A0AEC0',
        fontFamily: 'monospace'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(42, 74, 110, 0.3)'
        }
      },
      min: 150,
      max: 350
    },
    yAxis: {
      type: 'value',
      name: '日差 (s/d)',
      nameTextStyle: {
        color: '#A0AEC0',
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: '#2A4A6E'
        }
      },
      axisLabel: {
        color: '#A0AEC0',
        fontFamily: 'monospace'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(42, 74, 110, 0.3)'
        }
      },
      min: -30,
      max: 30
    },
    series: [
      {
        type: 'scatter',
        data: data,
        symbolSize: 12,
        itemStyle: {
          color: (params: any) => {
            const amplitude = params.value[0]
            if (amplitude < 220) return '#DC3545'
            return '#B8860B'
          },
          shadowBlur: 10,
          shadowColor: 'rgba(184, 134, 11, 0.5)'
        },
        emphasis: {
          itemStyle: {
            color: '#DAA520',
            borderColor: '#fff',
            borderWidth: 2
          }
        }
      },
      {
        type: 'line',
        data: data,
        smooth: true,
        showSymbol: false,
        lineStyle: {
          color: 'rgba(184, 134, 11, 0.3)',
          width: 2,
          type: 'dashed'
        }
      }
    ],
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: {
        color: '#DC3545',
        type: 'dashed',
        width: 1
      },
      data: [
        {
          xAxis: 220,
          label: {
            show: true,
            formatter: '最低摆幅 220度',
            color: '#DC3545',
            fontSize: 10
          }
        },
        {
          yAxis: 0,
          label: {
            show: true,
            formatter: '0 s/d',
            color: '#28A745',
            fontSize: 10
          },
          lineStyle: {
            color: '#28A745',
            type: 'solid'
          }
        }
      ]
    }
  }

  chartInstance.setOption(option)
}

function openCalibrationDialog() {
  if (!selectedMovement.value) {
    ElMessage.warning('请先选择一个机芯档案')
    return
  }
  calibrationForm.amplitude = 260
  calibrationForm.rate = 0
  calibrationForm.beat_error = 0
  calibrationForm.isochronism = ''
  calibrationForm.lock_status = ''
  calibrationForm.impulse_status = ''
  calibrationForm.position_analysis = ''
  calibrationForm.risk_warning = ''
  isEditing.value = false
  editingRecord.value = null
  showCalibrationDialog.value = true
}

function openEditCalibrationDialog(record: Diagnosis) {
  calibrationForm.amplitude = record.amplitude || 0
  calibrationForm.rate = record.rate || 0
  calibrationForm.beat_error = record.beat_error || 0
  calibrationForm.isochronism = record.isochronism || ''
  calibrationForm.lock_status = record.lock_status || ''
  calibrationForm.impulse_status = record.impulse_status || ''
  calibrationForm.position_analysis = record.position_analysis || ''
  calibrationForm.risk_warning = record.risk_warning || ''
  editingRecord.value = { ...record }
  isEditing.value = true
  showCalibrationDialog.value = true
}

async function saveCalibration() {
  if (!selectedMovement.value?.id) return

  if (calibrationForm.amplitude < 220) {
    calibrationForm.risk_warning = '摆幅过低，可能存在动力不足或润滑油干涩'
  }

  const diagnosis: Diagnosis = {
    movement_id: selectedMovement.value.id,
    amplitude: calibrationForm.amplitude,
    rate: calibrationForm.rate,
    beat_error: calibrationForm.beat_error,
    isochronism: calibrationForm.isochronism,
    lock_status: calibrationForm.lock_status,
    impulse_status: calibrationForm.impulse_status,
    position_analysis: calibrationForm.position_analysis,
    risk_warning: calibrationForm.risk_warning
  }

  if (isEditing.value && editingRecord.value?.id) {
    diagnosis.id = editingRecord.value.id
    diagnosis.diagnose_time = editingRecord.value.diagnose_time || new Date().toISOString()
  } else {
    diagnosis.diagnose_time = new Date().toISOString()
  }

  const id = await diagnosisStore.saveDiagnosis(diagnosis)
  if (id) {
    ElMessage.success(isEditing.value ? '更新成功' : '保存成功')
    showCalibrationDialog.value = false
    nextTick(() => initChart())
  } else {
    ElMessage.error('保存失败')
  }
}

function openMaintenanceDialog() {
  if (!selectedMovement.value) {
    ElMessage.warning('请先选择一个机芯档案')
    return
  }
  maintenanceForm.operation = ''
  maintenanceForm.before_amplitude = 0
  maintenanceForm.after_amplitude = 0
  maintenanceForm.before_rate = 0
  maintenanceForm.after_rate = 0
  maintenanceForm.technician = ''
  maintenanceForm.notes = ''
  showMaintenanceDialog.value = true
}

async function saveMaintenance() {
  if (!selectedMovement.value?.id) return

  if (!maintenanceForm.operation) {
    ElMessage.warning('请输入维修操作内容')
    return
  }

  const maintenance: Maintenance = {
    movement_id: selectedMovement.value.id,
    operation: maintenanceForm.operation,
    before_amplitude: maintenanceForm.before_amplitude,
    after_amplitude: maintenanceForm.after_amplitude,
    before_rate: maintenanceForm.before_rate,
    after_rate: maintenanceForm.after_rate,
    technician: maintenanceForm.technician,
    maintain_time: new Date().toISOString(),
    notes: maintenanceForm.notes
  }

  const id = await diagnosisStore.saveMaintenance(maintenance)
  if (id) {
    ElMessage.success('维修记录保存成功')
    showMaintenanceDialog.value = false
  } else {
    ElMessage.error('保存失败')
  }
}

function openDetailDialog(record: Diagnosis) {
  editingRecord.value = { ...record }
  showDetailDialog.value = true
}

async function deleteDiagnosis(record: Diagnosis) {
  if (!record.id) return
  try {
    await ElMessageBox.confirm(
      '确定要删除这条校表记录吗？',
      '删除确认',
      { type: 'warning' }
    )
    if (!window.electronAPI) {
      diagnosisStore.diagnosisHistory = diagnosisStore.diagnosisHistory.filter(d => d.id !== record.id)
      ElMessage.success('删除成功')
      nextTick(() => initChart())
      return
    }
    const result = await window.electronAPI.remove('diagnosis', record.id)
    if (result.success) {
      await diagnosisStore.loadDiagnosisHistory(record.movement_id)
      ElMessage.success('删除成功')
      nextTick(() => initChart())
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch {
  }
}

function exportData() {
  if (!selectedMovement.value) {
    ElMessage.warning('请先选择一个机芯档案')
    return
  }

  const exportObj = {
    movement: selectedMovement.value,
    diagnosisHistory: diagnosisStore.diagnosisHistory,
    maintenanceHistory: diagnosisStore.maintenanceHistory,
    exportTime: new Date().toISOString()
  }

  const dataStr = JSON.stringify(exportObj, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `维修档案_${selectedMovement.value.model}_${selectedMovement.value.serial || '未编号'}_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('数据导出成功')
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function getStatusClass(amplitude?: number) {
  if (amplitude === undefined) return ''
  if (amplitude < 220) return 'text-red-400'
  if (amplitude < 240) return 'text-yellow-400'
  return 'text-green-400'
}

function getStatusText(amplitude?: number) {
  if (amplitude === undefined) return '-'
  if (amplitude < 220) return '过低'
  if (amplitude < 240) return '偏低'
  if (amplitude > 300) return '偏高'
  return '正常'
}

async function loadData() {
  loading.value = true
  try {
    await movementStore.loadMovements()
    await movementStore.loadReferences()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})

watch(() => diagnosisStore.diagnosisHistory, () => {
  nextTick(() => initChart())
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <div class="watch-card">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
            <FolderOpen class="w-6 h-6 text-[var(--accent-gold)]" />
          </div>
          <div>
            <h2 class="text-xl font-medium text-[var(--text-primary)]">维修档案管理</h2>
            <p class="text-sm text-[var(--text-secondary)]">校表仪记录、振幅日差趋势、维修历史追踪</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button @click="exportData" class="watch-btn watch-btn-secondary flex items-center gap-2">
            <Download class="w-4 h-4" />
            导出数据
          </button>
        </div>
      </div>

      <div class="flex gap-4 mb-6">
        <div class="relative flex-1 max-w-lg">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input v-model="searchKeyword"
                 type="text"
                 placeholder="搜索机芯型号、品牌、表号、客户..."
                 class="watch-input w-full pl-10" />
        </div>
        <span class="text-sm text-[var(--text-muted)] self-center">
          共 {{ movementStore.movements.length }} 条档案
        </span>
      </div>

      <div class="grid grid-cols-5 gap-4">
        <div class="col-span-2 border-r border-[var(--border-color)] pr-4">
          <h3 class="text-[var(--accent-gold)] font-medium mb-3 flex items-center gap-2">
            <Watch class="w-4 h-4" />
            机芯档案列表
          </h3>
          <div v-if="loading" class="h-96 flex items-center justify-center">
            <div class="animate-spin w-8 h-8 border-2 border-[var(--accent-gold)] border-t-transparent rounded-full"></div>
          </div>
          <div v-else-if="filteredMovements.length === 0" class="h-96 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <FolderOpen class="w-12 h-12 mb-3 opacity-50" />
            <p>暂无档案记录</p>
          </div>
          <div v-else class="space-y-2 max-h-[500px] overflow-auto pr-2">
            <div v-for="m in filteredMovements" :key="m.id"
                 @click="selectMovement(m)"
                 class="p-3 rounded-lg cursor-pointer transition-all"
                 :class="getMovementRowClass(m.id)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                    <Watch class="w-4 h-4 text-[var(--accent-gold)]" />
                  </div>
                  <div>
                    <p class="text-[var(--text-primary)] font-medium text-sm">{{ m.brand || '-' }} {{ m.model }}</p>
                    <p class="text-xs text-[var(--text-muted)]">
                      表号: {{ m.serial || '-' }}
                    </p>
                  </div>
                </div>
                <ChevronRight class="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div class="mt-2 pt-2 border-t border-[var(--border-color)]">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-[var(--text-secondary)] flex items-center gap-1">
                    <User class="w-3 h-3" />
                    {{ m.customer || '未登记' }}
                  </span>
                  <span class="text-[var(--text-muted)]">
                    {{ m.create_time ? new Date(m.create_time).toLocaleDateString('zh-CN') : '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-span-3 pl-2">
          <div v-if="!selectedMovement" class="h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
            <BarChart3 class="w-16 h-16 mb-4 opacity-30" />
            <p class="text-lg">请选择左侧机芯档案查看详情</p>
            <p class="text-sm">查看校表记录、振幅日差趋势和维修历史</p>
          </div>

          <div v-else class="space-y-4">
            <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]/50">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <h3 class="text-[var(--text-primary)] font-medium">
                    {{ selectedMovement.brand || '-' }} {{ selectedMovement.model }}
                  </h3>
                  <p class="text-sm text-[var(--text-muted)]">
                    表号: {{ selectedMovement.serial || '-' }} | 客户: {{ selectedMovement.customer || '-' }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button @click="openCalibrationDialog"
                          class="watch-btn watch-btn-primary flex items-center gap-1 text-sm px-3 py-1.5">
                    <Plus class="w-4 h-4" />
                    录入校表数据
                  </button>
                  <button @click="openMaintenanceDialog"
                          class="watch-btn watch-btn-secondary flex items-center gap-1 text-sm px-3 py-1.5">
                    <Plus class="w-4 h-4" />
                    记录维修
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-4 gap-3 text-sm">
                <div class="p-2 rounded bg-[var(--bg-secondary)]">
                  <p class="text-[var(--text-muted)] text-xs">振频</p>
                  <p class="font-mono text-[var(--text-primary)]">{{ selectedMovement.frequency || '-' }} Hz</p>
                </div>
                <div class="p-2 rounded bg-[var(--bg-secondary)]">
                  <p class="text-[var(--text-muted)] text-xs">升角</p>
                  <p class="font-mono text-[var(--text-primary)]">{{ selectedMovement.lift_angle || '-' }}°</p>
                </div>
                <div class="p-2 rounded bg-[var(--bg-secondary)]">
                  <p class="text-[var(--text-muted)] text-xs">调校次数</p>
                  <p class="font-mono text-[var(--accent-gold)]">{{ diagnosisStore.diagnosisHistory.length }}</p>
                </div>
                <div class="p-2 rounded bg-[var(--bg-secondary)]">
                  <p class="text-[var(--text-muted)] text-xs">维修次数</p>
                  <p class="font-mono text-[var(--accent-gold)]">{{ diagnosisStore.maintenanceHistory.length }}</p>
                </div>
              </div>
            </div>

            <div class="watch-card">
              <h4 class="text-[var(--accent-gold)] font-medium mb-3 flex items-center gap-2">
                <AlertTriangle class="w-4 h-4" :class="hasLowAmplitudeRisk ? 'text-red-400' : 'text-yellow-400'" />
                风险告警
                <span v-if="riskAlerts.length > 0" class="status-badge status-poor ml-2">{{ riskAlerts.length }} 项</span>
              </h4>
              <div v-if="riskAlerts.length === 0" class="py-4 text-center text-[var(--text-muted)] text-sm">
                <CheckCircle2 class="w-8 h-8 mx-auto mb-2 text-green-400" />
                暂无风险告警
              </div>
              <div v-else class="space-y-2 max-h-32 overflow-auto">
                <div v-for="(alert, index) in riskAlerts" :key="index"
                     class="p-2 rounded border transition-all"
                     :class="getAlertCardClass(alert.level)">
                  <div class="flex items-start gap-2">
                    <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5"
                                :class="getAlertIconClass(alert.level)" />
                    <div class="text-sm">
                      <p :class="getAlertIconClass(alert.level)">
                        {{ alert.message }}
                      </p>
                      <p class="text-xs text-[var(--text-secondary)] mt-0.5">{{ alert.suggestion }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedMovement" class="grid grid-cols-2 gap-6">
      <div class="watch-card">
        <h3 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
          <BarChart3 class="w-5 h-5" />
          振幅日差图
        </h3>
        <div ref="chartRef" class="h-80 w-full"></div>
        <div class="mt-3 flex items-center justify-center gap-6 text-xs text-[var(--text-muted)]">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-[var(--accent-gold)]"></span>
            <span>正常摆幅 (≥220°)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-red-500"></span>
            <span>摆幅过低 (<220°)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-0.5 bg-green-500"></span>
            <span>标准日差 0s/d</span>
          </div>
        </div>
      </div>

      <div class="watch-card">
        <h3 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
          <Timeline class="w-5 h-5" />
          维修历史时间轴
        </h3>
        <div v-if="diagnosisStore.maintenanceHistory.length === 0"
             class="h-80 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Clock class="w-12 h-12 mb-3 opacity-30" />
          <p>暂无维修记录</p>
        </div>
        <div v-else class="relative max-h-80 overflow-auto pl-4">
          <div class="absolute left-1.5 top-0 bottom-0 w-0.5 bg-[var(--border-color)]"></div>
          <div class="space-y-4">
            <div v-for="(m, index) in diagnosisStore.maintenanceHistory" :key="m.id"
                 class="relative pl-6">
              <div class="absolute left-0 w-3 h-3 rounded-full border-2 border-[var(--accent-gold)] bg-[var(--bg-secondary)]"
                   :style="{ top: '6px' }"></div>
              <div class="p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[var(--text-primary)] font-medium text-sm">{{ m.operation }}</span>
                  <span class="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Calendar class="w-3 h-3" />
                    {{ formatDate(m.maintain_time) }}
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div class="p-2 rounded bg-[var(--bg-secondary)]">
                    <p class="text-[var(--text-muted)]">调校前</p>
                    <p class="font-mono">
                      <span :class="getStatusClass(m.before_amplitude)">{{ m.before_amplitude || '-' }}°</span>
                      <span class="text-[var(--text-muted)] mx-1">/</span>
                      <span class="text-[var(--text-primary)]">{{ m.before_rate || 0 }}s/d</span>
                    </p>
                  </div>
                  <div class="p-2 rounded bg-[var(--bg-secondary)]">
                    <p class="text-[var(--text-muted)]">调校后</p>
                    <p class="font-mono">
                      <span :class="getStatusClass(m.after_amplitude)">{{ m.after_amplitude || '-' }}°</span>
                      <span class="text-[var(--text-muted)] mx-1">/</span>
                      <span class="text-[var(--text-primary)]">{{ m.after_rate || 0 }}s/d</span>
                    </p>
                  </div>
                </div>
                <div v-if="m.technician || m.notes" class="mt-2 pt-2 border-t border-[var(--border-color)]">
                  <p v-if="m.technician" class="text-xs text-[var(--text-secondary)]">
                    <span class="text-[var(--text-muted)]">技师:</span> {{ m.technician }}
                  </p>
                  <p v-if="m.notes" class="text-xs text-[var(--text-muted)] mt-1">{{ m.notes }}</p>
                </div>
              </div>
              <div v-if="index < diagnosisStore.maintenanceHistory.length - 1"
                   class="absolute left-1.5 w-0.5 bg-[var(--border-color)]"
                   :style="{ top: '24px', height: '20px' }"></div>
            </div>
          </div>
          <div v-if="diagnosisStore.diagnosisHistory.length > 0"
               class="relative pl-6">
            <div class="absolute left-0 w-3 h-3 rounded-full border-2 border-blue-500 bg-[var(--bg-secondary)]"
                 :style="{ top: '6px' }"></div>
            <div class="p-3 rounded-lg bg-blue-900/20 border border-blue-600/50">
              <div class="flex items-center gap-2 text-sm text-blue-400">
                <Activity class="w-4 h-4" />
                <span>最新校表记录</span>
              </div>
              <p class="text-xs text-[var(--text-secondary)] mt-1">
                共 {{ diagnosisStore.diagnosisHistory.length }} 条校表记录
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedMovement" class="watch-card">
      <h3 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FileText class="w-5 h-5" />
          校表仪记录
        </div>
        <span class="text-sm font-normal text-[var(--text-muted)]">
          共 {{ diagnosisStore.diagnosisHistory.length }} 条记录
        </span>
      </h3>
      <div v-if="diagnosisStore.diagnosisHistory.length === 0"
           class="h-48 flex flex-col items-center justify-center text-[var(--text-muted)]">
        <Activity class="w-12 h-12 mb-3 opacity-30" />
        <p>暂无校表记录</p>
        <p class="text-sm">点击"录入校表数据"添加第一条记录</p>
      </div>
      <div v-else class="overflow-auto max-h-96">
        <table class="w-full">
          <thead class="bg-[var(--bg-tertiary)] sticky top-0">
          <tr>
            <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">时间</th>
            <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">振幅</th>
            <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">日差</th>
            <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">偏振</th>
            <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">等时性</th>
            <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">状态</th>
            <th class="text-right p-3 text-[var(--text-secondary)] font-medium text-sm">操作</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="d in [...diagnosisStore.diagnosisHistory].reverse()" :key="d.id"
              class="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              :class="{ 'bg-red-900/10': d.amplitude !== undefined && d.amplitude < 220 }">
            <td class="p-3 text-sm text-[var(--text-secondary)]">
              {{ formatDate(d.diagnose_time) }}
            </td>
            <td class="p-3">
              <span class="font-mono text-lg" :class="getStatusClass(d.amplitude)">
                {{ d.amplitude || '-' }}°
              </span>
              <span v-if="d.amplitude !== undefined && d.amplitude < 220"
                    class="ml-2 text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle class="w-3 h-3" />
                过低
              </span>
            </td>
            <td class="p-3">
              <span class="font-mono text-lg"
                    :class="d.rate !== undefined && Math.abs(d.rate) > 5 ? 'text-red-400' : 'text-green-400'">
                {{ d.rate !== undefined ? (d.rate > 0 ? '+' : '') + d.rate : '-' }} s/d
              </span>
            </td>
            <td class="p-3">
              <span class="font-mono" :class="d.beat_error !== undefined && d.beat_error > 1 ? 'text-yellow-400' : 'text-[var(--text-primary)]'">
                {{ d.beat_error !== undefined ? d.beat_error + ' ms' : '-' }}
              </span>
            </td>
            <td class="p-3 text-sm text-[var(--text-secondary)]">
              {{ d.isochronism || '-' }}
            </td>
            <td class="p-3">
              <span class="status-badge"
                    :class="getAmplitudeStatusClass(d.amplitude)">
                {{ getStatusText(d.amplitude) }}
              </span>
            </td>
            <td class="p-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button @click="openDetailDialog(d)"
                        class="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors"
                        title="查看详情">
                  <Eye class="w-4 h-4" />
                </button>
                <button @click="openEditCalibrationDialog(d)"
                        class="p-1.5 rounded hover:bg-blue-500/20 text-blue-400 transition-colors"
                        title="编辑">
                  <Edit class="w-4 h-4" />
                </button>
                <button @click="deleteDiagnosis(d)"
                        class="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        title="删除">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <el-dialog v-model="showCalibrationDialog"
               :title="isEditing ? '编辑校表记录' : '录入校表数据'"
               width="600px"
               :close-on-click-modal="false">
      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="watch-label">振幅 (°)</label>
            <input v-model.number="calibrationForm.amplitude" type="number" step="1" min="150" max="350"
                   class="watch-input w-full font-mono"
                   :class="{ 'border-red-500': calibrationForm.amplitude < 220 }" />
            <p v-if="calibrationForm.amplitude < 220" class="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle class="w-3 h-3" />
              摆幅过低，可能存在动力不足或油干涩
            </p>
          </div>
          <div>
            <label class="watch-label">日差 (s/d)</label>
            <input v-model.number="calibrationForm.rate" type="number" step="0.1"
                   class="watch-input w-full font-mono" placeholder="如: +2.5" />
          </div>
          <div>
            <label class="watch-label">偏振 (ms)</label>
            <input v-model.number="calibrationForm.beat_error" type="number" step="0.1"
                   class="watch-input w-full font-mono" placeholder="如: 0.5" />
          </div>
        </div>
        <div>
          <label class="watch-label">等时性评估</label>
          <input v-model="calibrationForm.isochronism"
                 class="watch-input w-full" placeholder="良好 / 需调校" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="watch-label">锁接状态</label>
            <input v-model="calibrationForm.lock_status"
                   class="watch-input w-full" placeholder="正常 / 过深 / 过浅" />
          </div>
          <div>
            <label class="watch-label">冲量状态</label>
            <input v-model="calibrationForm.impulse_status"
                   class="watch-input w-full" placeholder="正常 / 不足 / 过度" />
          </div>
        </div>
        <div>
          <label class="watch-label">位置差分析</label>
          <input v-model="calibrationForm.position_analysis"
                 class="watch-input w-full" placeholder="6位置误差分析结果" />
        </div>
        <div>
          <label class="watch-label">风险提示</label>
          <input v-model="calibrationForm.risk_warning"
                 class="watch-input w-full" placeholder="自动检测或手动输入" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showCalibrationDialog = false" class="watch-btn watch-btn-secondary">
            取消
          </button>
          <button @click="saveCalibration" class="watch-btn watch-btn-primary flex items-center gap-2">
            <Save class="w-4 h-4" />
            {{ isEditing ? '更新' : '保存' }}
          </button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="showMaintenanceDialog"
               title="记录维修操作"
               width="600px"
               :close-on-click-modal="false">
      <div class="space-y-4">
        <div>
          <label class="watch-label">维修操作内容 <span class="text-red-400">*</span></label>
          <input v-model="maintenanceForm.operation"
                 class="watch-input w-full" placeholder="如: 清洗加油、游丝调校、更换零件" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="watch-label">调校前振幅 (°)</label>
            <input v-model.number="maintenanceForm.before_amplitude" type="number"
                   class="watch-input w-full font-mono" />
          </div>
          <div>
            <label class="watch-label">调校后振幅 (°)</label>
            <input v-model.number="maintenanceForm.after_amplitude" type="number"
                   class="watch-input w-full font-mono" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="watch-label">调校前日差 (s/d)</label>
            <input v-model.number="maintenanceForm.before_rate" type="number" step="0.1"
                   class="watch-input w-full font-mono" />
          </div>
          <div>
            <label class="watch-label">调校后日差 (s/d)</label>
            <input v-model.number="maintenanceForm.after_rate" type="number" step="0.1"
                   class="watch-input w-full font-mono" />
          </div>
        </div>
        <div>
          <label class="watch-label">技师</label>
          <input v-model="maintenanceForm.technician"
                 class="watch-input w-full" placeholder="维修技师姓名" />
        </div>
        <div>
          <label class="watch-label">备注</label>
          <textarea v-model="maintenanceForm.notes"
                    class="watch-input w-full min-h-[80px]" placeholder="维修过程中的特殊情况说明"
                    rows="3"></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showMaintenanceDialog = false" class="watch-btn watch-btn-secondary">
            取消
          </button>
          <button @click="saveMaintenance" class="watch-btn watch-btn-primary flex items-center gap-2">
            <Save class="w-4 h-4" />
            保存
          </button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="showDetailDialog"
               title="校表记录详情"
               width="500px">
      <div v-if="editingRecord" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]">
            <p class="text-sm text-[var(--text-muted)] mb-1">振幅</p>
            <p class="text-2xl font-mono font-bold" :class="getStatusClass(editingRecord.amplitude)">
              {{ editingRecord.amplitude || '-' }}°
            </p>
            <span v-if="editingRecord.amplitude !== undefined && editingRecord.amplitude < 220"
                  class="text-xs text-red-400 flex items-center gap-1 mt-1">
              <AlertTriangle class="w-3 h-3" />
              摆幅过低
            </span>
          </div>
          <div class="p-4 rounded-lg bg-[var(--bg-tertiary)]">
            <p class="text-sm text-[var(--text-muted)] mb-1">日差</p>
            <p class="text-2xl font-mono font-bold"
               :class="editingRecord.rate !== undefined && Math.abs(editingRecord.rate) > 5 ? 'text-red-400' : 'text-green-400'">
              {{ editingRecord.rate !== undefined ? (editingRecord.rate > 0 ? '+' : '') + editingRecord.rate : '-' }} s/d
            </p>
          </div>
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between py-2 border-b border-[var(--border-color)]">
            <span class="text-[var(--text-muted)]">偏振</span>
            <span class="font-mono">{{ editingRecord.beat_error || '-' }} ms</span>
          </div>
          <div class="flex justify-between py-2 border-b border-[var(--border-color)]">
            <span class="text-[var(--text-muted)]">等时性</span>
            <span>{{ editingRecord.isochronism || '-' }}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-[var(--border-color)]">
            <span class="text-[var(--text-muted)]">锁接状态</span>
            <span>{{ editingRecord.lock_status || '-' }}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-[var(--border-color)]">
            <span class="text-[var(--text-muted)]">冲量状态</span>
            <span>{{ editingRecord.impulse_status || '-' }}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-[var(--border-color)]">
            <span class="text-[var(--text-muted)]">位置差分析</span>
            <span>{{ editingRecord.position_analysis || '-' }}</span>
          </div>
          <div v-if="editingRecord.risk_warning"
               class="p-3 rounded-lg bg-red-900/20 border border-red-600 mt-3">
            <p class="text-red-400 flex items-center gap-2">
              <AlertTriangle class="w-4 h-4" />
              {{ editingRecord.risk_warning }}
            </p>
          </div>
          <div class="text-xs text-[var(--text-muted)] mt-4 text-right">
            记录时间: {{ formatDate(editingRecord.diagnose_time) }}
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showDetailDialog = false" class="watch-btn watch-btn-primary">
            关闭
          </button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
