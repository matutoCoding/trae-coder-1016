import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Movement, ReferenceMovement, FaultCase, CalibrationSpec } from '@/types'

export const useMovementStore = defineStore('movement', () => {
  const currentMovement = ref<Movement | null>(null)
  const movements = ref<Movement[]>([])
  const references = ref<ReferenceMovement[]>([])
  const faultCases = ref<FaultCase[]>([])
  const calibrationSpecs = ref<CalibrationSpec[]>([])
  const selectedReference = ref<ReferenceMovement | null>(null)
  const loading = ref(false)

  const currentReference = computed(() => {
    if (selectedReference.value) return selectedReference.value
    if (currentMovement.value?.model) {
      return references.value.find(r => r.model === currentMovement.value!.model) || null
    }
    return null
  })

  async function loadReferences() {
    if (!window.electronAPI) {
      const mockReferences: ReferenceMovement[] = [
        { id: 1, model: 'ETA2824-2', brand: 'ETA', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 6.0, allow_position_error: 15.0, description: '经典自动机芯，大三针', beat_rate: 28800, train_count: 31, power_reserve: 42 },
        { id: 2, model: 'ETA7750', brand: 'ETA', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 6.0, allow_position_error: 15.0, description: '计时机芯，柱轮结构', beat_rate: 28800, train_count: 25, power_reserve: 48 },
        { id: 3, model: '2892A2', brand: 'ETA', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 4.0, allow_position_error: 12.0, description: '超薄自动机芯', beat_rate: 28800, train_count: 31, power_reserve: 42 },
        { id: 4, model: '3135', brand: 'Rolex', std_frequency: 4.0, std_lift_angle: 52.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 2.0, allow_position_error: 8.0, description: '劳力士自产机芯，蓝游丝', beat_rate: 28800, train_count: 31, power_reserve: 48 },
        { id: 5, model: '3235', brand: 'Rolex', std_frequency: 4.0, std_lift_angle: 52.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 2.0, allow_position_error: 8.0, description: '新一代劳力士机芯', beat_rate: 28800, train_count: 31, power_reserve: 70 },
        { id: 6, model: '8500', brand: 'Omega', std_frequency: 3.5, std_lift_angle: 50.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 2.0, allow_position_error: 8.0, description: '欧米茄同轴机芯', beat_rate: 25200, train_count: 30, power_reserve: 60 },
        { id: 7, model: 'B01', brand: 'Breitling', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 4.0, allow_position_error: 10.0, description: '百年灵自产计时机芯', beat_rate: 28800, train_count: 34, power_reserve: 70 },
        { id: 8, model: 'P.3000', brand: 'Panerai', std_frequency: 2.5, std_lift_angle: 55.0, min_amplitude: 220.0, max_amplitude: 290.0, allow_rate_error: 6.0, allow_position_error: 15.0, description: '沛纳海手动机芯', beat_rate: 18000, train_count: 21, power_reserve: 72 },
        { id: 9, model: 'FP1185', brand: 'Frederic Piguet', std_frequency: 3.0, std_lift_angle: 50.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 4.0, allow_position_error: 10.0, description: '高端计时机芯', beat_rate: 21600, train_count: 37, power_reserve: 42 },
        { id: 10, model: 'L888', brand: 'Longines', std_frequency: 3.5, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 5.0, allow_position_error: 12.0, description: '浪琴专属机芯', beat_rate: 25200, train_count: 30, power_reserve: 64 }
      ]
      references.value = mockReferences
      return
    }
    const result = await window.electronAPI.getReferences()
    if (result.success) {
      references.value = result.data
    }
  }

  async function loadFaultCases() {
    if (!window.electronAPI) {
      const mockFaultCases: FaultCase[] = [
        {
          id: 1,
          title: '摆幅过低',
          phenomenon: '满链状态下摆幅低于220°，走时偏慢，日差超过-10s/d',
          cause: '自动上链效率不足，发条老化，擒纵轮齿磨损',
          analysis: '首先检查自动陀轴承是否磨损，然后测试发条输出力矩，最后检查擒纵轮啮合情况。低摆幅会导致等时性变差，位置误差增大。',
          solution: '1. 清洗自动上链系统并更换磨损轴承\n2. 更换发条或重新打磨发条盒\n3. 修复或更换擒纵轮\n4. 重新调校摆轮游丝系统',
          tools: ['摆幅仪', '发条钩', '柳木签', '螺丝刀套装', '放大镜'],
          difficulty: 'medium',
          related_models: ['ETA2824-2', '2892A2', 'L888'],
          category: '走时故障'
        },
        {
          id: 2,
          title: '位差过大',
          phenomenon: '六位置测试时差超过15s/d，面上和面下差距明显',
          cause: '摆轮静平衡不良，游丝偏心，外桩位置不正',
          analysis: '位差过大是摆轮游丝系统的常见问题。需使用校表仪记录六个位置的走时数据，分析是平立差还是方位差。',
          solution: '1. 拆卸摆轮进行静平衡调校\n2. 检查并调整游丝同心度\n3. 微调外桩位置补偿位差\n4. 重新进行六位置调校',
          tools: ['校表仪', '摆轮平衡仪', '游丝镊子', '外桩调节器'],
          difficulty: 'hard',
          related_models: ['3135', '3235', '8500', 'ETA2824-2'],
          category: '精度故障'
        },
        {
          id: 3,
          title: '偏振超标',
          phenomenon: '节拍误差超过0.5ms，听声音明显一长一短',
          cause: '擒纵叉与擒纵轮啮合间隙不均，锁接角不对称',
          analysis: '偏振是由于擒纵机构两侧工作不对称造成的。使用校表仪的偏振测量功能可以准确判断，表现为打点图左右分布不均。',
          solution: '1. 检查擒纵叉宝石间隙\n2. 调整擒纵叉角度使两侧锁接角对称\n3. 检查擒纵轮齿是否磨损\n4. 必要时更换擒纵叉组件',
          tools: ['校表仪', '放大镜', '拨针', '擒纵叉调整工具'],
          difficulty: 'medium',
          related_models: ['ETA7750', 'FP1185', 'B01'],
          category: '擒纵故障'
        },
        {
          id: 4,
          title: '偷停现象',
          phenomenon: '手表偶尔停走，晃动后又能正常运行，无固定规律',
          cause: '传动轮系卡滞，游丝粘连，自动上链反向止逆失效',
          analysis: '间歇性停走是最棘手的故障之一。需要详细询问客户停走发生的情境，是佩戴中还是静置时，是手动上链后还是自动上链时。',
          solution: '1. 完全分解清洗所有轮系\n2. 检查并更换磨损的轮轴\n3. 用汽油清洗游丝，检查是否有粘连\n4. 检查自动上链止逆机构\n5. 更换老化的润滑油',
          tools: ['螺丝刀套装', '汽油缸', '柳木签', '放大镜', '润滑油'],
          difficulty: 'hard',
          related_models: ['P.3000', 'ETA2824-2', '3135'],
          category: '传动故障'
        },
        {
          id: 5,
          title: '日差偏快',
          phenomenon: '满链状态下日差超过+10s/d，摆幅正常',
          cause: '游丝有效圈数减少，游丝受磁，摆轮螺丝松动',
          analysis: '摆幅正常但走时偏快，说明能量传递没问题，问题出在振荡系统。首先检查游丝是否受磁，这是最常见的原因。',
          solution: '1. 使用退磁器进行退磁处理\n2. 检查并紧固摆轮螺丝\n3. 调整游丝有效长度（快慢针）\n4. 如游丝变形则进行整形或更换',
          tools: ['退磁器', '指南针', '镊子', '快慢针调节器'],
          difficulty: 'easy',
          related_models: ['所有机型'],
          category: '走时故障'
        },
        {
          id: 6,
          title: '自动上链异响',
          phenomenon: '佩戴时自动陀转动有异响，上链效率下降',
          cause: '自动陀轴承磨损，换向轮齿轮磨损，自动夹板螺丝松动',
          analysis: '自动上链系统的异响通常来自轴承磨损或齿轮啮合不良。需要分解自动系统逐一检查。',
          solution: '1. 更换自动陀轴承\n2. 检查并更换磨损的换向轮\n3. 紧固自动夹板螺丝并点胶\n4. 重新加注专用润滑油',
          tools: ['螺丝刀套装', '轴承压具', '润滑油', '放大镜'],
          difficulty: 'medium',
          related_models: ['ETA2824-2', '2892A2', 'L888', '3235'],
          category: '自动系统'
        }
      ]
      faultCases.value = mockFaultCases
      return
    }
    const result = await window.electronAPI.getFaultCases()
    if (result.success) {
      faultCases.value = result.data
    }
  }

  async function loadCalibrationSpecs() {
    if (!window.electronAPI) {
      const mockSpecs: CalibrationSpec[] = [
        {
          id: 1,
          brand: 'Rolex',
          model_range: '3135/3235系列',
          standard: 'Superlative Chronometer Officially Certified',
          procedure: [
            '外观检查与功能测试',
            '防水性能测试（10个大气压）',
            '机芯拆解与清洗',
            '检查所有齿轮和宝石轴承磨损情况',
            '检查擒纵机构锁接角和冲量角',
            '摆轮静平衡调校',
            '游丝同心度检查',
            '重新组装并加注专用润滑油',
            '六位置走时测试（满链/24小时后各一次）',
            '动力储备测试',
            '最终精度调校达到±2s/d标准',
            '外观清洁与抛光'
          ],
          acceptance: [
            '满链摆幅≥240°，24小时后摆幅≥200°',
            '六位置平均日差在-2s/d至+2s/d之间',
            '六位置最大差值≤8s/d',
            '偏振≤0.2ms',
            '动力储备≥48小时（3135）/≥70小时（3235）',
            '防水测试通过（10巴水压）',
            '所有功能正常（日期跳转、上链手感等）'
          ],
          precautions: [
            '必须使用劳力士专用润滑油',
            '蓝游丝严禁用金属镊子夹持',
            '自动陀轴承更换时必须使用原厂配件',
            '防水圈必须更换新件',
            '表壳后盖必须使用扭矩扳手按规定力矩锁紧'
          ],
          tools_required: ['劳力士专用螺丝刀', '扭矩扳手', '校表仪', '防水测试仪', '摆轮平衡仪', '蓝游丝专用镊子'],
          estimated_time: '4-6小时'
        },
        {
          id: 2,
          brand: 'Omega',
          model_range: '8500/8800同轴系列',
          standard: 'Master Chronometer METAS Certified',
          procedure: [
            '初步检测记录走时数据',
            '磁干扰测试（15000高斯）',
            '机芯完全拆解',
            '同轴擒纵机构专项检查',
            '硅游丝检查（严禁接触磁性物品）',
            '轮系清洗与检查',
            '更换所有密封件',
            '按Omega规范加注润滑油',
            '组装后六位置调校',
            '抗磁性能复测',
            '15天走时稳定性测试',
            '最终外观检查'
          ],
          acceptance: [
            '满链摆幅≥240°',
            '六位置日差在0s/d至+5s/d之间',
            '位置差≤8s/d',
            '15000高斯磁场影响≤5s/d',
            '动力储备≥60小时',
            '同轴擒纵无异常噪音',
            '15天走时稳定性≤2s/d'
          ],
          precautions: [
            '硅游丝极易碎裂，操作必须极度小心',
            '同轴擒纵宝石严禁用超声波清洗',
            '必须使用Omega专用润滑油9104/9010',
            '防磁测试必须在专用设备中进行',
            '组装时严禁用手接触硅部件'
          ],
          tools_required: ['Omega同轴擒纵工具', '磁屏蔽工作台', '硅部件专用镊子', 'METAS认证测试仪', '扭矩扳手'],
          estimated_time: '6-8小时'
        },
        {
          id: 3,
          brand: 'ETA',
          model_range: '2824-2/2892A2通用机芯',
          standard: 'Chronometer Standard (COSC)',
          procedure: [
            '接收检测与故障诊断',
            '机芯拆解',
            '所有零件超声波清洗',
            '检查轮齿啮合情况',
            '检查擒纵叉锁接角',
            '游丝检查与整形',
            '主发条检查或更换',
            '宝石轴承注油',
            '轮系组装与间隙检查',
            '摆轮静平衡',
            '六位置走时调校',
            '24小时老化测试',
            '最终检测与清洁'
          ],
          acceptance: [
            '满链摆幅≥220°',
            '平均日差在-4s/d至+6s/d之间',
            '位置差≤15s/d',
            '偏振≤0.3ms',
            '动力储备≥38小时（2824）/≥42小时（2892）',
            '走时曲线连续稳定'
          ],
          precautions: [
            '避免过度抛光导致夹板厚度不足',
            '游丝清洗后必须彻底干燥',
            '注油量必须严格控制，过多会导致粘滞',
            '防震器拆卸时注意不要丢失弹簧',
            '摆轮螺丝调整后必须点胶固定'
          ],
          tools_required: ['标准螺丝刀套装', '超声波清洗机', '校表仪', '注油笔', '摆轮支架'],
          estimated_time: '3-4小时'
        },
        {
          id: 4,
          brand: 'Panerai',
          model_range: 'P.3000手动机芯',
          standard: 'Panerai Manufacture Standard',
          procedure: [
            '功能检查（上链手感、储能显示）',
            '机芯拆解',
            '超大发条盒检查',
            '鹅颈式微调器检查',
            '轮系清洗与检查',
            'Glucydur摆轮平衡检查',
            'Incabloc防震系统检查',
            '组装与注油',
            '七日动力储备测试',
            '五位置精度调校',
            '48小时实走测试',
            '最终检验'
          ],
          acceptance: [
            '满链摆幅≥220°',
            '五日平均日差在-6s/d至+6s/d之间',
            '位置差≤15s/d',
            '动力储备≥72小时',
            '上链手感均匀无卡滞',
            '无异常噪音'
          ],
          precautions: [
            '发条力矩较大，拆卸时注意安全',
            '鹅颈微调器极细，严禁用力过大',
            '手动上链测试时不要超过发条极限',
            '大尺寸机芯夹板注意防止变形',
            '储能显示机构调整需耐心细致'
          ],
          tools_required: ['大尺寸螺丝刀', '发条钩（大号）', '鹅颈调整工具', '储能测试仪', '放大镜'],
          estimated_time: '4-5小时'
        }
      ]
      calibrationSpecs.value = mockSpecs
      return
    }
    const result = await window.electronAPI.getCalibrationSpecs()
    if (result.success) {
      calibrationSpecs.value = result.data
    }
  }

  async function saveReference(reference: Omit<ReferenceMovement, 'id'> & { id?: number }): Promise<number | null> {
    if (!window.electronAPI) {
      if (reference.id) {
        const index = references.value.findIndex(r => r.id === reference.id)
        if (index !== -1) {
          references.value[index] = { ...reference, id: reference.id } as ReferenceMovement
          return reference.id
        }
      }
      const newId = Math.max(...references.value.map(r => r.id), 0) + 1
      references.value.push({ ...reference, id: newId } as ReferenceMovement)
      return newId
    }
    const result = await window.electronAPI.saveReference(reference)
    if (result.success && result.id) {
      await loadReferences()
      return result.id
    }
    return null
  }

  async function deleteReference(id: number): Promise<boolean> {
    if (!window.electronAPI) {
      references.value = references.value.filter(r => r.id !== id)
      return true
    }
    const result = await window.electronAPI.removeReference(id)
    if (result.success) {
      await loadReferences()
      return true
    }
    return false
  }

  async function loadMovements(keyword?: string) {
    loading.value = true
    try {
      if (!window.electronAPI) {
        movements.value = []
        return
      }
      const result = await window.electronAPI.getMovements(keyword)
      if (result.success) {
        movements.value = result.data
      }
    } finally {
      loading.value = false
    }
  }

  async function saveMovement(movement: Movement): Promise<number | null> {
    if (!window.electronAPI) {
      const newId = movements.value.length + 1
      const newMovement = { ...movement, id: newId, create_time: new Date().toISOString() }
      movements.value.push(newMovement)
      currentMovement.value = newMovement
      return newId
    }
    const result = await window.electronAPI.saveMovement(movement)
    if (result.success && result.id) {
      await loadMovements()
      if (movement.id) {
        currentMovement.value = { ...movement }
      } else {
        const found = movements.value.find(m => m.id === result.id)
        if (found) currentMovement.value = found
      }
      return result.id
    }
    return null
  }

  function setCurrentMovement(movement: Movement | null) {
    currentMovement.value = movement
    if (movement?.model) {
      const ref = references.value.find(r => r.model === movement.model)
      selectedReference.value = ref || null
    }
  }

  function setSelectedReference(reference: ReferenceMovement | null) {
    selectedReference.value = reference
    if (reference && currentMovement.value) {
      currentMovement.value.model = reference.model
      currentMovement.value.brand = reference.brand || ''
      currentMovement.value.frequency = reference.std_frequency
      currentMovement.value.lift_angle = reference.std_lift_angle
    }
  }

  function createNewMovement(): Movement {
    return {
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
    }
  }

  return {
    currentMovement,
    movements,
    references,
    faultCases,
    calibrationSpecs,
    selectedReference,
    loading,
    currentReference,
    loadReferences,
    loadFaultCases,
    loadCalibrationSpecs,
    loadMovements,
    saveMovement,
    saveReference,
    deleteReference,
    setCurrentMovement,
    setSelectedReference,
    createNewMovement
  }
})
