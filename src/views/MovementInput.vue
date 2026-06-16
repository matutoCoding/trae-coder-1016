<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMovementStore } from '@/stores/movement'
import type { Movement, ReferenceMovement } from '@/types'
import {
  Save,
  RotateCcw,
  Search,
  Watch,
  Cog,
  Ruler,
  Plus,
  Edit,
  Trash2,
  ChevronRight
} from 'lucide-vue-next'

const router = useRouter()
const movementStore = useMovementStore()

const searchKeyword = ref('')
const activeTab = ref<'list' | 'form'>('list')

function getTabClass(tab: string) {
  if (activeTab.value === tab) {
    return 'border-[var(--accent-gold)] text-[var(--accent-gold)]'
  }
  return 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
}
const isEdit = ref(false)
const loading = ref(false)

const form = reactive<Movement>({
  model: '',
  brand: '',
  serial: '',
  customer: '',
  frequency: 4.0,
  inertia: undefined,
  hs_thickness: undefined,
  hs_width: undefined,
  hs_coils: undefined,
  lock_angle: 12,
  impulse_angle: 40,
  lift_angle: 50,
  teeth: 20
})

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

const referenceOptions = computed(() => movementStore.references)

function selectReference(ref: ReferenceMovement) {
  movementStore.setSelectedReference(ref)
  if (ref && form) {
    form.model = ref.model
    form.brand = ref.brand || ''
    form.frequency = ref.std_frequency
    form.lift_angle = ref.std_lift_angle
  }
}

function resetForm() {
  const newForm = movementStore.createNewMovement()
  Object.assign(form, newForm)
  form.id = undefined
  form.create_time = undefined
  movementStore.setSelectedReference(null)
  isEdit.value = false
}

function editMovement(m: Movement) {
  movementStore.setCurrentMovement(m)
  Object.assign(form, { ...m })
  const ref = movementStore.references.find(r => r.model === m.model)
  if (ref) movementStore.setSelectedReference(ref)
  isEdit.value = true
  activeTab.value = 'form'
}

function newMovement() {
  resetForm()
  activeTab.value = 'form'
}

async function saveMovement() {
  if (!form.model) {
    ElMessage.warning('请输入机芯型号')
    return
  }

  loading.value = true
  try {
    const id = await movementStore.saveMovement(form)
    if (id) {
      ElMessage.success(isEdit.value ? '更新成功' : '保存成功')
      resetForm()
      activeTab.value = 'list'
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    loading.value = false
  }
}

async function deleteMovement(m: Movement) {
  if (!m.id) return
  try {
    await ElMessageBox.confirm(
      `确定要删除机芯 ${m.brand} ${m.model} (${m.serial}) 的档案吗？`,
      '删除确认',
      { type: 'warning' }
    )
    if (!window.electronAPI) {
      movementStore.movements = movementStore.movements.filter(item => item.id !== m.id)
      ElMessage.success('删除成功')
      return
    }
    const result = await window.electronAPI.remove('movement', m.id)
    if (result.success) {
      await movementStore.loadMovements()
      ElMessage.success('删除成功')
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch {
    // 用户取消
  }
}

function goToDiagnosis(m: Movement) {
  movementStore.setCurrentMovement(m)
  router.push('/diagnosis')
}

async function loadData() {
  loading.value = true
  try {
    await movementStore.loadReferences()
    await movementStore.loadMovements()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch(() => movementStore.currentMovement, (m) => {
  if (m && activeTab.value === 'form' && isEdit.value) {
    Object.assign(form, { ...m })
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="watch-card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
            <Watch class="w-5 h-5 text-[var(--accent-gold)]" />
          </div>
          <div>
            <h3 class="text-lg font-medium text-[var(--text-primary)]">机芯档案管理</h3>
            <p class="text-sm text-[var(--text-secondary)]">录入摆轮游丝与擒纵机构参数</p>
          </div>
        </div>
        <button @click="newMovement" class="watch-btn watch-btn-primary flex items-center gap-2">
          <Plus class="w-4 h-4" />
          新建档案
        </button>
      </div>

      <div class="border-b border-[var(--border-color)] mb-6">
        <div class="flex gap-6">
          <button @click="activeTab = 'list'"
                  class="py-3 px-1 border-b-2 transition-colors"
                  :class="getTabClass('list')">
            档案列表
          </button>
          <button @click="activeTab = 'form'"
                  class="py-3 px-1 border-b-2 transition-colors"
                  :class="getTabClass('form')">
            {{ isEdit ? '编辑档案' : '新建档案' }}
          </button>
        </div>
      </div>

      <div v-if="activeTab === 'list'">
        <div class="flex items-center gap-4 mb-4">
          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input v-model="searchKeyword"
                   type="text"
                   placeholder="搜索机芯型号、品牌、表号、客户..."
                   class="watch-input w-full pl-10" />
          </div>
          <span class="text-sm text-[var(--text-muted)]">
            共 {{ movementStore.movements.length }} 条记录
          </span>
        </div>

        <div v-if="loading" class="h-96 flex items-center justify-center">
          <div class="animate-spin w-10 h-10 border-3 border-[var(--accent-gold)] border-t-transparent rounded-full"></div>
        </div>
        <div v-else-if="filteredMovements.length === 0" class="h-96 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Watch class="w-16 h-16 mb-4 opacity-50" />
          <p class="text-lg">暂无机芯档案</p>
          <p class="text-sm">点击右上角"新建档案"开始录入</p>
        </div>
        <div v-else class="overflow-auto max-h-[600px]">
          <table class="w-full">
            <thead class="bg-[var(--bg-tertiary)] sticky top-0">
              <tr>
                <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">机芯信息</th>
                <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">振频/升角</th>
                <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">游丝参数</th>
                <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">擒纵参数</th>
                <th class="text-left p-3 text-[var(--text-secondary)] font-medium text-sm">创建时间</th>
                <th class="text-right p-3 text-[var(--text-secondary)] font-medium text-sm">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in filteredMovements" :key="m.id"
                  class="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                <td class="p-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                      <Watch class="w-5 h-5 text-[var(--accent-gold)]" />
                    </div>
                    <div>
                      <p class="text-[var(--text-primary)] font-medium">{{ m.brand || '-' }} {{ m.model }}</p>
                      <p class="text-sm text-[var(--text-muted)]">
                        表号: {{ m.serial || '-' }} | 客户: {{ m.customer || '-' }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="p-3">
                  <p class="font-mono text-[var(--text-primary)]">{{ m.frequency || '-' }} Hz</p>
                  <p class="text-sm text-[var(--text-muted)]">升角 {{ m.lift_angle || '-' }}°</p>
                </td>
                <td class="p-3">
                  <p class="font-mono text-[var(--text-primary)]">
                    {{ m.hs_thickness ? m.hs_thickness + '×' + (m.hs_width || '?') : '-' }} mm
                  </p>
                  <p class="text-sm text-[var(--text-muted)]">{{ m.hs_coils || '-' }} 圈</p>
                </td>
                <td class="p-3">
                  <p class="font-mono text-[var(--text-primary)]">
                    锁{{ m.lock_angle || '-' }}° / 冲{{ m.impulse_angle || '-' }}°
                  </p>
                  <p class="text-sm text-[var(--text-muted)]">{{ m.teeth || '-' }} 齿</p>
                </td>
                <td class="p-3 text-sm text-[var(--text-secondary)]">
                  {{ m.create_time ? new Date(m.create_time).toLocaleString('zh-CN') : '-' }}
                </td>
                <td class="p-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button @click="goToDiagnosis(m)"
                            class="p-2 rounded hover:bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] transition-colors"
                            title="开始诊断">
                      <ChevronRight class="w-4 h-4" />
                    </button>
                    <button @click="editMovement(m)"
                            class="p-2 rounded hover:bg-blue-500/20 text-blue-400 transition-colors"
                            title="编辑">
                      <Edit class="w-4 h-4" />
                    </button>
                    <button @click="deleteMovement(m)"
                            class="p-2 rounded hover:bg-red-500/20 text-red-400 transition-colors"
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

      <div v-else class="grid grid-cols-3 gap-6">
        <div class="col-span-2 space-y-6">
          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
              <Watch class="w-5 h-5" />
              基础信息
            </h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="watch-label">参照机芯型号</label>
                <el-select v-model="form.model"
                           placeholder="选择或输入机芯型号"
                           filterable
                           @change="(val: string) => {
                             const ref = referenceOptions.find(r => r.model === val)
                             if (ref) selectReference(ref)
                           }"
                           class="w-full">
                  <el-option v-for="ref in referenceOptions" :key="ref.id"
                             :label="(ref.brand || '') + ' ' + ref.model"
                             :value="ref.model">
                    <div class="flex justify-between">
                      <span>{{ ref.brand }} {{ ref.model }}</span>
                      <span class="text-[var(--text-muted)] text-sm">{{ ref.std_frequency }}Hz</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
              <div>
                <label class="watch-label">品牌</label>
                <input v-model="form.brand" class="watch-input w-full" placeholder="如: Rolex, Omega" />
              </div>
              <div>
                <label class="watch-label">表号</label>
                <input v-model="form.serial" class="watch-input w-full" placeholder="机芯序列号" />
              </div>
              <div>
                <label class="watch-label">客户</label>
                <input v-model="form.customer" class="watch-input w-full" placeholder="客户姓名" />
              </div>
            </div>
          </div>

          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
              <Cog class="w-5 h-5" />
              摆轮游丝参数
            </h4>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="watch-label">振频 (Hz)</label>
                <input v-model.number="form.frequency" type="number" step="0.1"
                       class="watch-input w-full font-mono" placeholder="4.0" />
              </div>
              <div>
                <label class="watch-label">A/h (次/时)</label>
                <input :value="(form.frequency || 0) * 3600" type="text"
                       class="watch-input w-full font-mono bg-[var(--bg-secondary)]" readonly />
              </div>
              <div>
                <label class="watch-label">转动惯量 (g·cm²)</label>
                <input v-model.number="form.inertia" type="number" step="0.001"
                       class="watch-input w-full font-mono" placeholder="如: 0.025" />
              </div>
              <div>
                <label class="watch-label">游丝厚度 (mm)</label>
                <input v-model.number="form.hs_thickness" type="number" step="0.001"
                       class="watch-input w-full font-mono" placeholder="如: 0.018" />
              </div>
              <div>
                <label class="watch-label">游丝宽度 (mm)</label>
                <input v-model.number="form.hs_width" type="number" step="0.01"
                       class="watch-input w-full font-mono" placeholder="如: 0.12" />
              </div>
              <div>
                <label class="watch-label">有效圈数</label>
                <input v-model.number="form.hs_coils" type="number" step="0.125"
                       class="watch-input w-full font-mono" placeholder="如: 12.5" />
              </div>
            </div>
          </div>

          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4 flex items-center gap-2">
              <Ruler class="w-5 h-5" />
              擒纵机构参数
            </h4>
            <div class="grid grid-cols-4 gap-4">
              <div>
                <label class="watch-label">锁接角 (°)</label>
                <input v-model.number="form.lock_angle" type="number" step="0.5"
                       class="watch-input w-full font-mono" placeholder="理想 12°" />
              </div>
              <div>
                <label class="watch-label">冲量角 (°)</label>
                <input v-model.number="form.impulse_angle" type="number" step="0.5"
                       class="watch-input w-full font-mono" placeholder="理想 40°" />
              </div>
              <div>
                <label class="watch-label">升角 (°)</label>
                <input v-model.number="form.lift_angle" type="number" step="0.5"
                       class="watch-input w-full font-mono" placeholder="如: 50°" />
              </div>
              <div>
                <label class="watch-label">擒纵轮齿数</label>
                <input v-model.number="form.teeth" type="number" step="1"
                       class="watch-input w-full font-mono" placeholder="如: 20" />
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4">参数摘要</h4>
            <div class="space-y-3">
              <div class="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span class="text-[var(--text-secondary)]">机芯型号</span>
                <span class="font-mono text-[var(--text-primary)]">{{ form.model || '-' }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span class="text-[var(--text-secondary)]">振频</span>
                <span class="font-mono text-[var(--text-primary)]">{{ form.frequency || '-' }} Hz</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span class="text-[var(--text-secondary)]">游丝尺寸</span>
                <span class="font-mono text-[var(--text-primary)]">
                  {{ form.hs_thickness || '?' }}×{{ form.hs_width || '?' }} mm
                </span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span class="text-[var(--text-secondary)]">锁接/冲量</span>
                <span class="font-mono text-[var(--text-primary)]">
                  {{ form.lock_angle || '?' }}°/{{ form.impulse_angle || '?' }}°
                </span>
              </div>
              <div class="flex justify-between items-center py-2">
                <span class="text-[var(--text-secondary)]">总转角</span>
                <span class="font-mono text-[var(--accent-gold)]">
                  {{ (form.lock_angle || 0) + (form.impulse_angle || 0) }}°
                </span>
              </div>
            </div>
          </div>

          <div v-if="movementStore.currentReference" class="watch-card">
            <h4 class="text-[var(--accent-gold)] font-medium mb-4">标准参数参照</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-[var(--text-secondary)]">标准振频</span>
                <span class="font-mono">{{ movementStore.currentReference.std_frequency }} Hz</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-secondary)]">标准升角</span>
                <span class="font-mono">{{ movementStore.currentReference.std_lift_angle }}°</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-secondary)]">摆幅范围</span>
                <span class="font-mono">{{ movementStore.currentReference.min_amplitude }}°-{{ movementStore.currentReference.max_amplitude }}°</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-secondary)]">日差允许</span>
                <span class="font-mono">±{{ movementStore.currentReference.allow_rate_error }} s/d</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-secondary)]">位置差允许</span>
                <span class="font-mono">{{ movementStore.currentReference.allow_position_error }} s/d</span>
              </div>
            </div>
          </div>

          <div class="watch-card space-y-3">
            <button @click="saveMovement"
                    :disabled="loading"
                    class="w-full watch-btn watch-btn-primary flex items-center justify-center gap-2">
              <Save class="w-4 h-4" />
              {{ loading ? '保存中...' : (isEdit ? '更新档案' : '保存档案') }}
            </button>
            <button @click="resetForm" class="w-full watch-btn watch-btn-secondary flex items-center justify-center gap-2">
              <RotateCcw class="w-4 h-4" />
              重置表单
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
