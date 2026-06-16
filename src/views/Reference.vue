<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMovementStore } from '@/stores/movement'
import type { ReferenceMovement } from '@/types'
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  GitCompare,
  X,
  AlertTriangle,
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  ListChecks,
  Shield,
  ChevronDown,
  ChevronUp,
  Gauge,
  Ruler,
  Timer,
  Target
} from 'lucide-vue-next'

const movementStore = useMovementStore()

const activeTab = ref<'movement' | 'fault' | 'calibration'>('movement')
const loading = ref(false)

function getTabClass(tab: string) {
  if (activeTab.value === tab) {
    return 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[var(--accent-gold)]/5'
  }
  return 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'
}

function getFaultCategoryClass(category: string) {
  const classMap: Record<string, string> = {
    '走时故障': 'bg-blue-900/30',
    '精度故障': 'bg-purple-900/30',
    '擒纵故障': 'bg-yellow-900/30',
    '传动故障': 'bg-orange-900/30',
    '自动系统': 'bg-green-900/30'
  }
  return classMap[category] || 'bg-gray-900/30'
}

function getFaultCategoryBadgeClass(category: string) {
  const classMap: Record<string, string> = {
    '走时故障': 'text-blue-400',
    '精度故障': 'text-purple-400',
    '擒纵故障': 'text-yellow-400',
    '传动故障': 'text-orange-400',
    '自动系统': 'text-green-400'
  }
  return classMap[category] || 'text-gray-400'
}

function getBrandFilterClass(brand: string) {
  if (calibrationBrandFilter.value === brand) {
    return 'bg-[var(--accent-gold)] text-[var(--bg-primary)]'
  }
  return 'bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
}
const searchKeyword = ref('')
const faultSearchKeyword = ref('')
const faultCategoryFilter = ref('all')
const calibrationBrandFilter = ref('all')

const showCompareModal = ref(false)
const showReferenceDialog = ref(false)
const isEditReference = ref(false)
const compareIds = ref<number[]>([])
const expandedFaultId = ref<number | null>(null)
const expandedSpecId = ref<number | null>(null)

const referenceForm = reactive({
  id: undefined as number | undefined,
  model: '',
  brand: '',
  std_frequency: 4.0,
  std_lift_angle: 50.0,
  min_amplitude: 220.0,
  max_amplitude: 300.0,
  allow_rate_error: 6.0,
  allow_position_error: 15.0,
  description: '',
  beat_rate: 28800,
  train_count: 30,
  power_reserve: 48
})

const filteredReferences = computed(() => {
  if (!searchKeyword.value) return movementStore.references
  const kw = searchKeyword.value.toLowerCase()
  return movementStore.references.filter(r =>
    r.model.toLowerCase().includes(kw) ||
    (r.brand && r.brand.toLowerCase().includes(kw)) ||
    (r.description && r.description.toLowerCase().includes(kw))
  )
})

const filteredFaultCases = computed(() => {
  let result = movementStore.faultCases
  if (faultCategoryFilter.value !== 'all') {
    result = result.filter(f => f.category === faultCategoryFilter.value)
  }
  if (faultSearchKeyword.value) {
    const kw = faultSearchKeyword.value.toLowerCase()
    result = result.filter(f =>
      f.title.toLowerCase().includes(kw) ||
      f.phenomenon.toLowerCase().includes(kw) ||
      f.cause.toLowerCase().includes(kw) ||
      f.solution.toLowerCase().includes(kw)
    )
  }
  return result
})

const filteredCalibrationSpecs = computed(() => {
  if (calibrationBrandFilter.value === 'all') return movementStore.calibrationSpecs
  return movementStore.calibrationSpecs.filter(s => s.brand === calibrationBrandFilter.value)
})

const faultCategories = computed(() => {
  const cats = new Set(movementStore.faultCases.map(f => f.category))
  return ['all', ...Array.from(cats)]
})

const calibrationBrands = computed(() => {
  const brands = new Set(movementStore.calibrationSpecs.map(s => s.brand))
  return ['all', ...Array.from(brands)]
})

const compareReferences = computed(() => {
  return movementStore.references.filter(r => compareIds.value.includes(r.id))
})

const compareFields = [
  { key: 'brand', label: '品牌' },
  { key: 'std_frequency', label: '振频 (Hz)', unit: 'Hz' },
  { key: 'beat_rate', label: '节拍率 (A/h)', unit: 'A/h' },
  { key: 'std_lift_angle', label: '升角 (°)', unit: '°' },
  { key: 'min_amplitude', label: '最小摆幅 (°)', unit: '°' },
  { key: 'max_amplitude', label: '最大摆幅 (°)', unit: '°' },
  { key: 'allow_rate_error', label: '日差允许 (±s/d)', unit: 's/d', prefix: '±' },
  { key: 'allow_position_error', label: '位置差允许 (s/d)', unit: 's/d' },
  { key: 'power_reserve', label: '动力储备 (h)', unit: 'h' },
  { key: 'train_count', label: '传动轮数' },
  { key: 'description', label: '说明' }
]

function toggleCompare(id: number) {
  const index = compareIds.value.indexOf(id)
  if (index === -1) {
    if (compareIds.value.length >= 4) {
      ElMessage.warning('最多只能选择4个机芯进行对比')
      return
    }
    compareIds.value.push(id)
  } else {
    compareIds.value.splice(index, 1)
  }
}

function openCompare() {
  if (compareIds.value.length < 2) {
    ElMessage.warning('请至少选择2个机芯进行对比')
    return
  }
  showCompareModal.value = true
}

function clearCompare() {
  compareIds.value = []
}

function openNewReference() {
  isEditReference.value = false
  Object.assign(referenceForm, {
    id: undefined,
    model: '',
    brand: '',
    std_frequency: 4.0,
    std_lift_angle: 50.0,
    min_amplitude: 220.0,
    max_amplitude: 300.0,
    allow_rate_error: 6.0,
    allow_position_error: 15.0,
    description: '',
    beat_rate: 28800,
    train_count: 30,
    power_reserve: 48
  })
  showReferenceDialog.value = true
}

function openEditReference(ref: ReferenceMovement) {
  isEditReference.value = true
  Object.assign(referenceForm, { ...ref })
  showReferenceDialog.value = true
}

async function saveReference() {
  if (!referenceForm.model) {
    ElMessage.warning('请输入机芯型号')
    return
  }
  loading.value = true
  try {
    const data = { ...referenceForm }
    if (!isEditReference.value) {
      delete data.id
    }
    const id = await movementStore.saveReference(data)
    if (id) {
      ElMessage.success(isEditReference.value ? '更新成功' : '保存成功')
      showReferenceDialog.value = false
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    loading.value = false
  }
}

async function deleteReference(ref: ReferenceMovement) {
  try {
    await ElMessageBox.confirm(
      `确定要删除参照机芯 ${ref.brand} ${ref.model} 吗？`,
      '删除确认',
      { type: 'warning' }
    )
    const success = await movementStore.deleteReference(ref.id)
    if (success) {
      ElMessage.success('删除成功')
      if (compareIds.value.includes(ref.id)) {
        compareIds.value = compareIds.value.filter(id => id !== ref.id)
      }
    } else {
      ElMessage.error('删除失败')
    }
  } catch {
  }
}

function getDifficultyConfig(difficulty: string) {
  switch (difficulty) {
    case 'easy':
      return { label: '简单', class: 'status-excellent', color: 'text-green-400' }
    case 'medium':
      return { label: '中等', class: 'status-normal', color: 'text-yellow-400' }
    case 'hard':
      return { label: '困难', class: 'status-poor', color: 'text-red-400' }
    default:
      return { label: '未知', class: 'status-normal', color: 'text-gray-400' }
  }
}

function toggleFaultExpand(id: number) {
  expandedFaultId.value = expandedFaultId.value === id ? null : id
}

function toggleSpecExpand(id: number) {
  expandedSpecId.value = expandedSpecId.value === id ? null : id
}

async function loadAllData() {
  loading.value = true
  try {
    await Promise.all([
      movementStore.loadReferences(),
      movementStore.loadFaultCases(),
      movementStore.loadCalibrationSpecs()
    ])
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAllData()
})
</script>

<template>
  <div class="space-y-6 h-full overflow-hidden flex flex-col">
    <div class="watch-card flex-shrink-0">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
            <BookOpen class="w-6 h-6 text-[var(--accent-gold)]" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-[var(--text-primary)]">调校参照库</h2>
            <p class="text-sm text-[var(--text-secondary)]">机芯参数、故障案例、调校规范一站式查询</p>
          </div>
        </div>
        <button v-if="activeTab === 'movement'" @click="openNewReference" class="watch-btn watch-btn-primary flex items-center gap-2">
          <Plus class="w-4 h-4" />
          新增参照机芯
        </button>
      </div>

      <div class="border-b border-[var(--border-color)]">
        <div class="flex gap-1">
          <button @click="activeTab = 'movement'"
                  class="py-3 px-6 border-b-2 transition-all font-medium"
                  :class="getTabClass('movement')">
            <span class="flex items-center gap-2">
              <Gauge class="w-4 h-4" />
              机芯参数库
              <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)]">
                {{ movementStore.references.length }}
              </span>
            </span>
          </button>
          <button @click="activeTab = 'fault'"
                  class="py-3 px-6 border-b-2 transition-all font-medium"
                  :class="getTabClass('fault')">
            <span class="flex items-center gap-2">
              <AlertTriangle class="w-4 h-4" />
              故障案例库
              <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)]">
                {{ movementStore.faultCases.length }}
              </span>
            </span>
          </button>
          <button @click="activeTab = 'calibration'"
                  class="py-3 px-6 border-b-2 transition-all font-medium"
                  :class="getTabClass('calibration')">
            <span class="flex items-center gap-2">
              <ListChecks class="w-4 h-4" />
              调校规范库
              <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)]">
                {{ movementStore.calibrationSpecs.length }}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="activeTab === 'movement'" class="space-y-4">
        <div class="watch-card">
          <div class="flex items-center gap-4 flex-wrap">
            <div class="relative flex-1 max-w-lg">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input v-model="searchKeyword"
                     type="text"
                     placeholder="搜索机芯型号、品牌、描述..."
                     class="watch-input w-full pl-10" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-[var(--text-muted)]">
                已选择 {{ compareIds.length }} 个
              </span>
              <button @click="openCompare"
                      :disabled="compareIds.length < 2"
                      class="watch-btn watch-btn-secondary flex items-center gap-2"
                      :class="{ 'opacity-50 cursor-not-allowed': compareIds.length < 2 }">
                <GitCompare class="w-4 h-4" />
                参数对比
              </button>
              <button v-if="compareIds.length > 0" @click="clearCompare" class="watch-btn watch-btn-secondary flex items-center gap-2">
                <X class="w-4 h-4" />
                清空选择
              </button>
            </div>
            <span class="text-sm text-[var(--text-muted)] ml-auto">
              共 {{ filteredReferences.length }} 条记录
            </span>
          </div>
        </div>

        <div v-if="loading" class="watch-card h-96 flex items-center justify-center">
          <div class="animate-spin w-10 h-10 border-3 border-[var(--accent-gold)] border-t-transparent rounded-full"></div>
        </div>
        <div v-else-if="filteredReferences.length === 0" class="watch-card h-96 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <BookOpen class="w-16 h-16 mb-4 opacity-50" />
          <p class="text-lg">暂无匹配的参照机芯</p>
          <p class="text-sm">尝试修改搜索条件或点击右上角新增参照机芯</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="ref in filteredReferences" :key="ref.id"
               class="watch-card group relative overflow-hidden transition-all"
               :class="{ 'ring-2 ring-[var(--accent-gold)]': compareIds.includes(ref.id) }">
            <div class="absolute top-3 right-3">
              <input type="checkbox"
                     :checked="compareIds.includes(ref.id)"
                     @change="toggleCompare(ref.id)"
                     class="w-4 h-4 accent-[var(--accent-gold)] cursor-pointer" />
            </div>

            <div class="mb-3">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent-gold)]">
                  {{ ref.brand }}
                </span>
              </div>
              <h4 class="text-lg font-bold text-[var(--text-primary)] font-mono">{{ ref.model }}</h4>
              <p class="text-sm text-[var(--text-secondary)] mt-1">{{ ref.description }}</p>
            </div>

            <div class="grid grid-cols-2 gap-3 mb-4">
              <div class="bg-[var(--bg-tertiary)]/50 rounded-lg p-3">
                <p class="text-xs text-[var(--text-muted)] mb-1">振频</p>
                <p class="font-mono text-[var(--text-primary)]">{{ ref.std_frequency }} Hz</p>
                <p class="text-xs text-[var(--text-muted)]">{{ ref.beat_rate }} A/h</p>
              </div>
              <div class="bg-[var(--bg-tertiary)]/50 rounded-lg p-3">
                <p class="text-xs text-[var(--text-muted)] mb-1">升角</p>
                <p class="font-mono text-[var(--text-primary)]">{{ ref.std_lift_angle }}°</p>
                <p class="text-xs text-[var(--text-muted)]">摆幅 {{ ref.min_amplitude }}-{{ ref.max_amplitude }}°</p>
              </div>
              <div class="bg-[var(--bg-tertiary)]/50 rounded-lg p-3">
                <p class="text-xs text-[var(--text-muted)] mb-1">日差允许</p>
                <p class="font-mono text-[var(--success)]">±{{ ref.allow_rate_error }} s/d</p>
              </div>
              <div class="bg-[var(--bg-tertiary)]/50 rounded-lg p-3">
                <p class="text-xs text-[var(--text-muted)] mb-1">位置差允许</p>
                <p class="font-mono text-[var(--info)]">{{ ref.allow_position_error }} s/d</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
              <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Timer class="w-3 h-3" />
                <span>动力储备 {{ ref.power_reserve }}h</span>
              </div>
              <div class="flex items-center gap-1">
                <button @click="openEditReference(ref)"
                        class="p-2 rounded hover:bg-blue-500/20 text-blue-400 transition-colors"
                        title="编辑">
                  <Edit class="w-4 h-4" />
                </button>
                <button @click="deleteReference(ref)"
                        class="p-2 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        title="删除">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div v-if="compareIds.includes(ref.id)"
                 class="absolute top-0 left-0 w-1 h-full bg-[var(--accent-gold)]"></div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'fault'" class="space-y-4">
        <div class="watch-card">
          <div class="flex items-center gap-4 flex-wrap">
            <div class="relative flex-1 max-w-lg">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input v-model="faultSearchKeyword"
                     type="text"
                     placeholder="搜索故障现象、原因、解决方案..."
                     class="watch-input w-full pl-10" />
            </div>
            <select v-model="faultCategoryFilter" class="watch-input min-w-[140px]">
              <option v-for="cat in faultCategories" :key="cat" :value="cat">
                {{ cat === 'all' ? '全部分类' : cat }}
              </option>
            </select>
            <span class="text-sm text-[var(--text-muted)] ml-auto">
              共 {{ filteredFaultCases.length }} 条记录
            </span>
          </div>
        </div>

        <div v-if="filteredFaultCases.length === 0" class="watch-card h-96 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <AlertCircle class="w-16 h-16 mb-4 opacity-50" />
          <p class="text-lg">暂无匹配的故障案例</p>
          <p class="text-sm">尝试修改搜索条件</p>
        </div>

        <div v-else class="space-y-4">
          <div v-for="fault in filteredFaultCases" :key="fault.id" class="watch-card overflow-hidden">
            <div class="flex items-start gap-4 cursor-pointer" @click="toggleFaultExpand(fault.id)">
              <div class="flex-shrink-0">
                <div class="w-12 h-12 rounded-lg flex items-center justify-center"
                     :class="getFaultCategoryClass(fault.category)">
                  <AlertTriangle class="w-6 h-6"
                                 :class="getFaultCategoryBadgeClass(fault.category)" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <h4 class="text-lg font-bold text-[var(--text-primary)]">{{ fault.title }}</h4>
                  <span class="status-badge" :class="getDifficultyConfig(fault.difficulty).class">
                    {{ getDifficultyConfig(fault.difficulty).label }}
                  </span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                    {{ fault.category }}
                  </span>
                </div>
                <p class="text-[var(--text-secondary)]">
                  <span class="text-[var(--text-muted)]">现象：</span>{{ fault.phenomenon }}
                </p>
              </div>
              <div class="flex-shrink-0">
                <component :is="expandedFaultId === fault.id ? ChevronUp : ChevronDown"
                           class="w-5 h-5 text-[var(--text-muted)] transition-transform" />
              </div>
            </div>

            <div v-if="expandedFaultId === fault.id" class="mt-4 pt-4 border-t border-[var(--border-color)] space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-[var(--bg-tertiary)]/30 rounded-lg p-4">
                  <h5 class="font-medium text-[var(--accent-gold)] mb-2 flex items-center gap-2">
                    <AlertCircle class="w-4 h-4" />
                    原因分析
                  </h5>
                  <p class="text-sm text-[var(--text-secondary)]">{{ fault.cause }}</p>
                </div>
                <div class="bg-[var(--bg-tertiary)]/30 rounded-lg p-4">
                  <h5 class="font-medium text-[var(--info)] mb-2 flex items-center gap-2">
                    <Ruler class="w-4 h-4" />
                    诊断思路
                  </h5>
                  <p class="text-sm text-[var(--text-secondary)]">{{ fault.analysis }}</p>
                </div>
              </div>

              <div class="bg-[var(--bg-tertiary)]/30 rounded-lg p-4">
                <h5 class="font-medium text-[var(--success)] mb-3 flex items-center gap-2">
                  <Wrench class="w-4 h-4" />
                  调校方案
                </h5>
                <div class="space-y-2">
                  <div v-for="(step, idx) in fault.solution.split('\n').filter(Boolean)" :key="idx"
                       class="flex items-start gap-2">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] text-xs flex items-center justify-center font-bold">
                      {{ idx + 1 }}
                    </span>
                    <p class="text-sm text-[var(--text-secondary)] pt-0.5">{{ step.replace(/^\d+\.\s*/, '') }}</p>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-4">
                <div class="flex-1 min-w-[200px]">
                  <h5 class="font-medium text-[var(--text-primary)] mb-2 text-sm">所需工具</h5>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="tool in fault.tools" :key="tool"
                          class="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                      {{ tool }}
                    </span>
                  </div>
                </div>
                <div class="flex-1 min-w-[200px]">
                  <h5 class="font-medium text-[var(--text-primary)] mb-2 text-sm">相关机型</h5>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="model in fault.related_models" :key="model"
                          class="text-xs px-2 py-1 rounded bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] font-mono">
                      {{ model }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'calibration'" class="space-y-4">
        <div class="watch-card">
          <div class="flex items-center gap-4 flex-wrap">
            <div class="flex items-center gap-2">
              <Shield class="w-5 h-5 text-[var(--accent-gold)]" />
              <span class="text-[var(--text-primary)] font-medium">品牌筛选：</span>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button v-for="brand in calibrationBrands" :key="brand"
                      @click="calibrationBrandFilter = brand"
                      class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      :class="getBrandFilterClass(brand)">
                {{ brand === 'all' ? '全部' : brand }}
              </button>
            </div>
            <span class="text-sm text-[var(--text-muted)] ml-auto">
              共 {{ filteredCalibrationSpecs.length }} 条记录
            </span>
          </div>
        </div>

        <div v-if="filteredCalibrationSpecs.length === 0" class="watch-card h-96 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <ListChecks class="w-16 h-16 mb-4 opacity-50" />
          <p class="text-lg">暂无匹配的调校规范</p>
          <p class="text-sm">尝试修改品牌筛选条件</p>
        </div>

        <div v-else class="space-y-4">
          <div v-for="spec in filteredCalibrationSpecs" :key="spec.id" class="watch-card overflow-hidden">
            <div class="flex items-start gap-4 cursor-pointer" @click="toggleSpecExpand(spec.id)">
              <div class="flex-shrink-0">
                <div class="w-14 h-14 rounded-lg bg-gradient-to-br from-[var(--accent-gold)]/20 to-[var(--accent-gold)]/5 flex items-center justify-center border border-[var(--accent-gold)]/30">
                  <span class="text-xl font-bold text-[var(--accent-gold)]">
                    {{ spec.brand.charAt(0) }}
                  </span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2 flex-wrap">
                  <h4 class="text-lg font-bold text-[var(--text-primary)]">{{ spec.brand }} {{ spec.model_range }}</h4>
                  <span class="text-xs px-3 py-1 rounded-full bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] border border-[var(--accent-gold)]/30">
                    {{ spec.standard }}
                  </span>
                </div>
                <div class="flex items-center gap-6 text-sm text-[var(--text-secondary)]">
                  <span class="flex items-center gap-1">
                    <Clock class="w-4 h-4 text-[var(--accent-gold)]" />
                    预计工时：{{ spec.estimated_time }}
                  </span>
                  <span class="flex items-center gap-1">
                    <ListChecks class="w-4 h-4 text-[var(--success)]" />
                    {{ spec.procedure.length }} 个步骤
                  </span>
                  <span class="flex items-center gap-1">
                    <CheckCircle class="w-4 h-4 text-[var(--info)]" />
                    {{ spec.acceptance.length }} 项验收标准
                  </span>
                </div>
              </div>
              <div class="flex-shrink-0">
                <component :is="expandedSpecId === spec.id ? ChevronUp : ChevronDown"
                           class="w-5 h-5 text-[var(--text-muted)] transition-transform" />
              </div>
            </div>

            <div v-if="expandedSpecId === spec.id" class="mt-4 pt-4 border-t border-[var(--border-color)] space-y-4">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="bg-[var(--bg-tertiary)]/30 rounded-lg p-4">
                  <h5 class="font-medium text-[var(--accent-gold)] mb-3 flex items-center gap-2">
                    <ListChecks class="w-4 h-4" />
                    调校流程
                  </h5>
                  <div class="space-y-2">
                    <div v-for="(step, idx) in spec.procedure" :key="idx"
                         class="flex items-start gap-3">
                      <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent-gold)] text-[var(--bg-primary)] text-xs flex items-center justify-center font-bold">
                        {{ idx + 1 }}
                      </span>
                      <p class="text-sm text-[var(--text-secondary)] pt-0.5">{{ step }}</p>
                    </div>
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="bg-[var(--bg-tertiary)]/30 rounded-lg p-4">
                    <h5 class="font-medium text-[var(--success)] mb-3 flex items-center gap-2">
                      <CheckCircle class="w-4 h-4" />
                      验收标准
                    </h5>
                    <div class="space-y-2">
                      <div v-for="(item, idx) in spec.acceptance" :key="idx"
                           class="flex items-start gap-2">
                        <CheckCircle class="w-4 h-4 text-[var(--success)] flex-shrink-0 mt-0.5" />
                        <p class="text-sm text-[var(--text-secondary)]">{{ item }}</p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-[var(--bg-tertiary)]/30 rounded-lg p-4">
                    <h5 class="font-medium text-[var(--warning)] mb-3 flex items-center gap-2">
                      <AlertTriangle class="w-4 h-4" />
                      注意事项
                    </h5>
                    <div class="space-y-2">
                      <div v-for="(item, idx) in spec.precautions" :key="idx"
                           class="flex items-start gap-2">
                        <AlertTriangle class="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                        <p class="text-sm text-[var(--text-secondary)]">{{ item }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-4">
                <div class="flex-1 min-w-[200px]">
                  <h5 class="font-medium text-[var(--text-primary)] mb-2 text-sm">所需工具</h5>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="tool in spec.tools_required" :key="tool"
                          class="text-xs px-3 py-1.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                      {{ tool }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showCompareModal"
               title="机芯参数对比"
               width="900px"
               :close-on-click-modal="false"
               custom-class="watch-dialog">
      <template #header>
        <div class="flex items-center gap-3">
          <GitCompare class="w-5 h-5 text-[var(--accent-gold)]" />
          <span class="text-lg font-bold text-[var(--text-primary)]">机芯参数对比</span>
        </div>
      </template>

      <div class="overflow-auto max-h-[600px]">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-[var(--bg-tertiary)]">
              <th class="text-left p-3 text-[var(--text-secondary)] font-medium border border-[var(--border-color)] sticky left-0 bg-[var(--bg-tertiary)] z-10">
                参数项
              </th>
              <th v-for="ref in compareReferences" :key="ref.id"
                  class="text-center p-3 font-medium border border-[var(--border-color)] min-w-[150px]">
                <div class="text-[var(--accent-gold)] text-sm">{{ ref.brand }}</div>
                <div class="text-[var(--text-primary)] font-mono">{{ ref.model }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="field in compareFields" :key="field.key"
                class="hover:bg-[var(--bg-tertiary)]/30 transition-colors">
              <td class="p-3 text-[var(--text-secondary)] border border-[var(--border-color)] sticky left-0 bg-[var(--bg-secondary)] z-10 font-medium">
                {{ field.label }}
              </td>
              <td v-for="ref in compareReferences" :key="ref.id"
                  class="p-3 text-center border border-[var(--border-color)]">
                <span class="font-mono text-[var(--text-primary)]">
                  {{ field.prefix || '' }}{{ (ref as any)[field.key] || '-' }}{{ field.unit ? ' ' + field.unit : '' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <button @click="showCompareModal = false" class="watch-btn watch-btn-secondary">
          关闭
        </button>
      </template>
    </el-dialog>

    <el-dialog v-model="showReferenceDialog"
               :title="isEditReference ? '编辑参照机芯' : '新增参照机芯'"
               width="700px"
               :close-on-click-modal="false"
               custom-class="watch-dialog">
      <template #header>
        <div class="flex items-center gap-3">
          <Target class="w-5 h-5 text-[var(--accent-gold)]" />
          <span class="text-lg font-bold text-[var(--text-primary)]">
            {{ isEditReference ? '编辑参照机芯' : '新增参照机芯' }}
          </span>
        </div>
      </template>

      <div class="space-y-6">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="watch-label">机芯型号 *</label>
            <input v-model="referenceForm.model" class="watch-input w-full font-mono" placeholder="如: ETA2824-2" />
          </div>
          <div>
            <label class="watch-label">品牌</label>
            <input v-model="referenceForm.brand" class="watch-input w-full" placeholder="如: ETA, Rolex" />
          </div>
        </div>

        <div class="watch-card">
          <h5 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
            <Gauge class="w-4 h-4" />
            振荡系统参数
          </h5>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="watch-label">标准振频 (Hz)</label>
              <input v-model.number="referenceForm.std_frequency" type="number" step="0.5"
                     class="watch-input w-full font-mono" />
            </div>
            <div>
              <label class="watch-label">节拍率 (A/h)</label>
              <input v-model.number="referenceForm.beat_rate" type="number" step="600"
                     class="watch-input w-full font-mono" />
            </div>
            <div>
              <label class="watch-label">标准升角 (°)</label>
              <input v-model.number="referenceForm.std_lift_angle" type="number" step="0.5"
                     class="watch-input w-full font-mono" />
            </div>
            <div>
              <label class="watch-label">最小摆幅 (°)</label>
              <input v-model.number="referenceForm.min_amplitude" type="number" step="5"
                     class="watch-input w-full font-mono" />
            </div>
            <div>
              <label class="watch-label">最大摆幅 (°)</label>
              <input v-model.number="referenceForm.max_amplitude" type="number" step="5"
                     class="watch-input w-full font-mono" />
            </div>
            <div>
              <label class="watch-label">传动轮数</label>
              <input v-model.number="referenceForm.train_count" type="number" step="1"
                     class="watch-input w-full font-mono" />
            </div>
          </div>
        </div>

        <div class="watch-card">
          <h5 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
            <Target class="w-4 h-4" />
            精度标准
          </h5>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="watch-label">日差允许 (±s/d)</label>
              <input v-model.number="referenceForm.allow_rate_error" type="number" step="0.5"
                     class="watch-input w-full font-mono" />
            </div>
            <div>
              <label class="watch-label">位置差允许 (s/d)</label>
              <input v-model.number="referenceForm.allow_position_error" type="number" step="0.5"
                     class="watch-input w-full font-mono" />
            </div>
            <div>
              <label class="watch-label">动力储备 (h)</label>
              <input v-model.number="referenceForm.power_reserve" type="number" step="1"
                     class="watch-input w-full font-mono" />
            </div>
          </div>
        </div>

        <div>
          <label class="watch-label">说明描述</label>
          <textarea v-model="referenceForm.description"
                    class="watch-input w-full min-h-[80px] resize-none"
                    placeholder="输入机芯特点、适用场景等说明..."></textarea>
        </div>
      </div>

      <template #footer>
        <button @click="showReferenceDialog = false" class="watch-btn watch-btn-secondary">
          取消
        </button>
        <button @click="saveReference" :disabled="loading" class="watch-btn watch-btn-primary">
          {{ loading ? '保存中...' : '保存' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.watch-dialog :deep(.el-dialog) {
  background-color: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
}

.watch-dialog :deep(.el-dialog__title) {
  color: var(--accent-gold) !important;
}

.watch-dialog :deep(.el-dialog__headerbtn .el-dialog__close) {
  color: var(--text-secondary) !important;
}

.watch-dialog :deep(.el-dialog__headerbtn:hover .el-dialog__close) {
  color: var(--accent-gold) !important;
}
</style>
