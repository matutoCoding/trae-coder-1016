import fs from 'fs'
import path from 'path'
import { app } from 'electron'

let dbPath: string

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS movement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    brand TEXT,
    serial TEXT UNIQUE,
    customer TEXT,
    frequency REAL,
    inertia REAL,
    hs_thickness REAL,
    hs_width REAL,
    hs_coils REAL,
    lock_angle REAL,
    impulse_angle REAL,
    lift_angle REAL,
    teeth INTEGER,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diagnosis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_id INTEGER NOT NULL,
    amplitude REAL,
    rate REAL,
    beat_error REAL,
    isochronism TEXT,
    lock_status TEXT,
    impulse_status TEXT,
    position_analysis TEXT,
    risk_warning TEXT,
    diagnose_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movement_id) REFERENCES movement(id)
);

CREATE TABLE IF NOT EXISTS position_error (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_id INTEGER NOT NULL,
    face_up REAL,
    face_down REAL,
    crown_left REAL,
    crown_right REAL,
    crown_up REAL,
    crown_down REAL,
    max_deviation REAL,
    result TEXT,
    FOREIGN KEY (movement_id) REFERENCES movement(id)
);

CREATE TABLE IF NOT EXISTS maintenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_id INTEGER NOT NULL,
    operation TEXT,
    before_amplitude REAL,
    after_amplitude REAL,
    before_rate REAL,
    after_rate REAL,
    technician TEXT,
    maintain_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (movement_id) REFERENCES movement(id)
);

CREATE TABLE IF NOT EXISTS calibration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_id INTEGER NOT NULL,
    temperature REAL,
    elastic_modulus REAL,
    rate_drift REAL,
    target_rate REAL,
    trim_coils REAL,
    eccentricity REAL,
    adjust_direction TEXT,
    FOREIGN KEY (movement_id) REFERENCES movement(id)
);

CREATE TABLE IF NOT EXISTS reference_movement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL UNIQUE,
    brand TEXT,
    std_frequency REAL,
    std_lift_angle REAL,
    min_amplitude REAL,
    max_amplitude REAL,
    allow_rate_error REAL,
    allow_position_error REAL,
    description TEXT
);
`

const REFERENCE_DATA = `
INSERT OR IGNORE INTO reference_movement 
(model, brand, std_frequency, std_lift_angle, min_amplitude, max_amplitude, allow_rate_error, allow_position_error, description)
VALUES
('ETA2824-2', 'ETA', 4.0, 50.0, 220.0, 300.0, 6.0, 15.0, '经典自动机芯，大三针'),
('ETA7750', 'ETA', 4.0, 50.0, 220.0, 300.0, 6.0, 15.0, '计时机芯，柱轮结构'),
('2892A2', 'ETA', 4.0, 50.0, 220.0, 300.0, 4.0, 12.0, '超薄自动机芯'),
('3135', 'Rolex', 4.0, 52.0, 240.0, 310.0, 2.0, 8.0, '劳力士自产机芯，蓝游丝'),
('3235', 'Rolex', 4.0, 52.0, 240.0, 310.0, 2.0, 8.0, '新一代劳力士机芯'),
('8500', 'Omega', 3.5, 50.0, 240.0, 310.0, 2.0, 8.0, '欧米茄同轴机芯'),
('B01', 'Breitling', 4.0, 50.0, 240.0, 310.0, 4.0, 10.0, '百年灵自产计时机芯'),
('P.3000', 'Panerai', 2.5, 55.0, 220.0, 290.0, 6.0, 15.0, '沛纳海手动机芯'),
('FP1185', 'Frederic Piguet', 3.0, 50.0, 240.0, 310.0, 4.0, 10.0, '高端计时机芯'),
('L888', 'Longines', 3.5, 50.0, 220.0, 300.0, 5.0, 12.0, '浪琴专属机芯');
`

let database: any = null

class SimpleJSONDB {
  private data: any
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.load()
  }

  private load() {
    if (fs.existsSync(this.filePath)) {
      const content = fs.readFileSync(this.filePath, 'utf-8')
      this.data = JSON.parse(content)
    } else {
      this.data = {
        movement: [],
        diagnosis: [],
        position_error: [],
        maintenance: [],
        calibration: [],
        reference_movement: [],
        fault_case: [],
        calibration_spec: []
      }
      this.initReferenceData()
      this.save()
    }
  }

  private initReferenceData() {
    const references = [
      { model: 'ETA2824-2', brand: 'ETA', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 6.0, allow_position_error: 15.0, description: '经典自动机芯，大三针', beat_rate: 28800, train_count: 31, power_reserve: 42 },
      { model: 'ETA7750', brand: 'ETA', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 6.0, allow_position_error: 15.0, description: '计时机芯，柱轮结构', beat_rate: 28800, train_count: 25, power_reserve: 48 },
      { model: '2892A2', brand: 'ETA', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 4.0, allow_position_error: 12.0, description: '超薄自动机芯', beat_rate: 28800, train_count: 31, power_reserve: 42 },
      { model: '3135', brand: 'Rolex', std_frequency: 4.0, std_lift_angle: 52.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 2.0, allow_position_error: 8.0, description: '劳力士自产机芯，蓝游丝', beat_rate: 28800, train_count: 31, power_reserve: 48 },
      { model: '3235', brand: 'Rolex', std_frequency: 4.0, std_lift_angle: 52.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 2.0, allow_position_error: 8.0, description: '新一代劳力士机芯', beat_rate: 28800, train_count: 31, power_reserve: 70 },
      { model: '8500', brand: 'Omega', std_frequency: 3.5, std_lift_angle: 50.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 2.0, allow_position_error: 8.0, description: '欧米茄同轴机芯', beat_rate: 25200, train_count: 30, power_reserve: 60 },
      { model: 'B01', brand: 'Breitling', std_frequency: 4.0, std_lift_angle: 50.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 4.0, allow_position_error: 10.0, description: '百年灵自产计时机芯', beat_rate: 28800, train_count: 34, power_reserve: 70 },
      { model: 'P.3000', brand: 'Panerai', std_frequency: 2.5, std_lift_angle: 55.0, min_amplitude: 220.0, max_amplitude: 290.0, allow_rate_error: 6.0, allow_position_error: 15.0, description: '沛纳海手动机芯', beat_rate: 18000, train_count: 21, power_reserve: 72 },
      { model: 'FP1185', brand: 'Frederic Piguet', std_frequency: 3.0, std_lift_angle: 50.0, min_amplitude: 240.0, max_amplitude: 310.0, allow_rate_error: 4.0, allow_position_error: 10.0, description: '高端计时机芯', beat_rate: 21600, train_count: 37, power_reserve: 42 },
      { model: 'L888', brand: 'Longines', std_frequency: 3.5, std_lift_angle: 50.0, min_amplitude: 220.0, max_amplitude: 300.0, allow_rate_error: 5.0, allow_position_error: 12.0, description: '浪琴专属机芯', beat_rate: 25200, train_count: 30, power_reserve: 64 }
    ]
    this.data.reference_movement = references.map((r, i) => ({ id: i + 1, ...r }))

    this.data.fault_case = [
      { id: 1, title: '摆幅过低', phenomenon: '满链状态下摆幅低于220°，走时偏慢，日差超过-10s/d', cause: '自动上链效率不足，发条老化，擒纵轮齿磨损', analysis: '首先检查自动陀轴承是否磨损，然后测试发条输出力矩，最后检查擒纵轮啮合情况。低摆幅会导致等时性变差，位置误差增大。', solution: '1. 清洗自动上链系统并更换磨损轴承\n2. 更换发条或重新打磨发条盒\n3. 修复或更换擒纵轮\n4. 重新调校摆轮游丝系统', tools: ['摆幅仪', '发条钩', '柳木签', '螺丝刀套装', '放大镜'], difficulty: 'medium', related_models: ['ETA2824-2', '2892A2', 'L888'], category: '走时故障' },
      { id: 2, title: '位差过大', phenomenon: '六位置测试时差超过15s/d，面上和面下差距明显', cause: '摆轮静平衡不良，游丝偏心，外桩位置不正', analysis: '位差过大是摆轮游丝系统的常见问题。需使用校表仪记录六个位置的走时数据，分析是平立差还是方位差。', solution: '1. 拆卸摆轮进行静平衡调校\n2. 检查并调整游丝同心度\n3. 微调外桩位置补偿位差\n4. 重新进行六位置调校', tools: ['校表仪', '摆轮平衡仪', '游丝镊子', '外桩调节器'], difficulty: 'hard', related_models: ['3135', '3235', '8500', 'ETA2824-2'], category: '精度故障' },
      { id: 3, title: '偏振超标', phenomenon: '节拍误差超过0.5ms，听声音明显一长一短', cause: '擒纵叉与擒纵轮啮合间隙不均，锁接角不对称', analysis: '偏振是由于擒纵机构两侧工作不对称造成的。使用校表仪的偏振测量功能可以准确判断，表现为打点图左右分布不均。', solution: '1. 检查擒纵叉宝石间隙\n2. 调整擒纵叉角度使两侧锁接角对称\n3. 检查擒纵轮齿是否磨损\n4. 必要时更换擒纵叉组件', tools: ['校表仪', '放大镜', '拨针', '擒纵叉调整工具'], difficulty: 'medium', related_models: ['ETA7750', 'FP1185', 'B01'], category: '擒纵故障' },
      { id: 4, title: '偷停现象', phenomenon: '手表偶尔停走，晃动后又能正常运行，无固定规律', cause: '传动轮系卡滞，游丝粘连，自动上链反向止逆失效', analysis: '间歇性停走是最棘手的故障之一。需要详细询问客户停走发生的情境，是佩戴中还是静置时，是手动上链后还是自动上链时。', solution: '1. 完全分解清洗所有轮系\n2. 检查并更换磨损的轮轴\n3. 用汽油清洗游丝，检查是否有粘连\n4. 检查自动上链止逆机构\n5. 更换老化的润滑油', tools: ['螺丝刀套装', '汽油缸', '柳木签', '放大镜', '润滑油'], difficulty: 'hard', related_models: ['P.3000', 'ETA2824-2', '3135'], category: '传动故障' },
      { id: 5, title: '日差偏快', phenomenon: '满链状态下日差超过+10s/d，摆幅正常', cause: '游丝有效圈数减少，游丝受磁，摆轮螺丝松动', analysis: '摆幅正常但走时偏快，说明能量传递没问题，问题出在振荡系统。首先检查游丝是否受磁，这是最常见的原因。', solution: '1. 使用退磁器进行退磁处理\n2. 检查并紧固摆轮螺丝\n3. 调整游丝有效长度（快慢针）\n4. 如游丝变形则进行整形或更换', tools: ['退磁器', '指南针', '镊子', '快慢针调节器'], difficulty: 'easy', related_models: ['所有机型'], category: '走时故障' },
      { id: 6, title: '自动上链异响', phenomenon: '佩戴时自动陀转动有异响，上链效率下降', cause: '自动陀轴承磨损，换向轮齿轮磨损，自动夹板螺丝松动', analysis: '自动上链系统的异响通常来自轴承磨损或齿轮啮合不良。需要分解自动系统逐一检查。', solution: '1. 更换自动陀轴承\n2. 检查并更换磨损的换向轮\n3. 紧固自动夹板螺丝并点胶\n4. 重新加注专用润滑油', tools: ['螺丝刀套装', '轴承压具', '润滑油', '放大镜'], difficulty: 'medium', related_models: ['ETA2824-2', '2892A2', 'L888', '3235'], category: '自动系统' }
    ]

    this.data.calibration_spec = [
      { id: 1, brand: 'Rolex', model_range: '3135/3235系列', standard: 'Superlative Chronometer Officially Certified', procedure: ['外观检查与功能测试', '防水性能测试（10个大气压）', '机芯拆解与清洗', '检查所有齿轮和宝石轴承磨损情况', '检查擒纵机构锁接角和冲量角', '摆轮静平衡调校', '游丝同心度检查', '重新组装并加注专用润滑油', '六位置走时测试（满链/24小时后各一次）', '动力储备测试', '最终精度调校达到±2s/d标准', '外观清洁与抛光'], acceptance: ['满链摆幅≥240°，24小时后摆幅≥200°', '六位置平均日差在-2s/d至+2s/d之间', '六位置最大差值≤8s/d', '偏振≤0.2ms', '动力储备≥48小时（3135）/≥70小时（3235）', '防水测试通过（10巴水压）', '所有功能正常（日期跳转、上链手感等）'], precautions: ['必须使用劳力士专用润滑油', '蓝游丝严禁用金属镊子夹持', '自动陀轴承更换时必须使用原厂配件', '防水圈必须更换新件', '表壳后盖必须使用扭矩扳手按规定力矩锁紧'], tools_required: ['劳力士专用螺丝刀', '扭矩扳手', '校表仪', '防水测试仪', '摆轮平衡仪', '蓝游丝专用镊子'], estimated_time: '4-6小时' },
      { id: 2, brand: 'Omega', model_range: '8500/8800同轴系列', standard: 'Master Chronometer METAS Certified', procedure: ['初步检测记录走时数据', '磁干扰测试（15000高斯）', '机芯完全拆解', '同轴擒纵机构专项检查', '硅游丝检查（严禁接触磁性物品）', '轮系清洗与检查', '更换所有密封件', '按Omega规范加注润滑油', '组装后六位置调校', '抗磁性能复测', '15天走时稳定性测试', '最终外观检查'], acceptance: ['满链摆幅≥240°', '六位置日差在0s/d至+5s/d之间', '位置差≤8s/d', '15000高斯磁场影响≤5s/d', '动力储备≥60小时', '同轴擒纵无异常噪音', '15天走时稳定性≤2s/d'], precautions: ['硅游丝极易碎裂，操作必须极度小心', '同轴擒纵宝石严禁用超声波清洗', '必须使用Omega专用润滑油9104/9010', '防磁测试必须在专用设备中进行', '组装时严禁用手接触硅部件'], tools_required: ['Omega同轴擒纵工具', '磁屏蔽工作台', '硅部件专用镊子', 'METAS认证测试仪', '扭矩扳手'], estimated_time: '6-8小时' },
      { id: 3, brand: 'ETA', model_range: '2824-2/2892A2通用机芯', standard: 'Chronometer Standard (COSC)', procedure: ['接收检测与故障诊断', '机芯拆解', '所有零件超声波清洗', '检查轮齿啮合情况', '检查擒纵叉锁接角', '游丝检查与整形', '主发条检查或更换', '宝石轴承注油', '轮系组装与间隙检查', '摆轮静平衡', '六位置走时调校', '24小时老化测试', '最终检测与清洁'], acceptance: ['满链摆幅≥220°', '平均日差在-4s/d至+6s/d之间', '位置差≤15s/d', '偏振≤0.3ms', '动力储备≥38小时（2824）/≥42小时（2892）', '走时曲线连续稳定'], precautions: ['避免过度抛光导致夹板厚度不足', '游丝清洗后必须彻底干燥', '注油量必须严格控制，过多会导致粘滞', '防震器拆卸时注意不要丢失弹簧', '摆轮螺丝调整后必须点胶固定'], tools_required: ['标准螺丝刀套装', '超声波清洗机', '校表仪', '注油笔', '摆轮支架'], estimated_time: '3-4小时' },
      { id: 4, brand: 'Panerai', model_range: 'P.3000手动机芯', standard: 'Panerai Manufacture Standard', procedure: ['功能检查（上链手感、储能显示）', '机芯拆解', '超大发条盒检查', '鹅颈式微调器检查', '轮系清洗与检查', 'Glucydur摆轮平衡检查', 'Incabloc防震系统检查', '组装与注油', '七日动力储备测试', '五位置精度调校', '48小时实走测试', '最终检验'], acceptance: ['满链摆幅≥220°', '五日平均日差在-6s/d至+6s/d之间', '位置差≤15s/d', '动力储备≥72小时', '上链手感均匀无卡滞', '无异常噪音'], precautions: ['发条力矩较大，拆卸时注意安全', '鹅颈微调器极细，严禁用力过大', '手动上链测试时不要超过发条极限', '大尺寸机芯夹板注意防止变形', '储能显示机构调整需耐心细致'], tools_required: ['大尺寸螺丝刀', '发条钩（大号）', '鹅颈调整工具', '储能测试仪', '放大镜'], estimated_time: '4-5小时' }
    ]
  }

  private save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
  }

  insert(table: string, record: any): number {
    const records = this.data[table] || []
    const maxId = records.length > 0 ? Math.max(...records.map((r: any) => r.id)) : 0
    const newRecord = { id: maxId + 1, ...record }
    records.push(newRecord)
    this.save()
    return newRecord.id
  }

  update(table: string, id: number, record: any): boolean {
    const records = this.data[table] || []
    const index = records.findIndex((r: any) => r.id === id)
    if (index !== -1) {
      records[index] = { ...records[index], ...record }
      this.save()
      return true
    }
    return false
  }

  delete(table: string, id: number): boolean {
    const records = this.data[table] || []
    const index = records.findIndex((r: any) => r.id === id)
    if (index !== -1) {
      records.splice(index, 1)
      this.save()
      return true
    }
    return false
  }

  findAll(table: string, where?: any): any[] {
    let records = [...(this.data[table] || [])]
    if (where) {
      records = records.filter((r: any) => {
        return Object.entries(where).every(([key, value]) => {
          if (typeof value === 'string' && value.includes('%')) {
            const regex = new RegExp(value.replace(/%/g, '.*'), 'i')
            return regex.test(r[key])
          }
          return r[key] === value
        })
      })
    }
    return records
  }

  findOne(table: string, where: any): any | null {
    const records = this.findAll(table, where)
    return records.length > 0 ? records[0] : null
  }

  query(sql: string): any[] {
    return []
  }
}

export function initDatabase() {
  const userDataPath = app.getPath('userData')
  dbPath = path.join(userDataPath, 'watch_adjustment.db.json')
  database = new SimpleJSONDB(dbPath)
  console.log('Database initialized at:', dbPath)
}

export function getDatabase(): SimpleJSONDB {
  if (!database) {
    throw new Error('Database not initialized')
  }
  return database
}

export { SimpleJSONDB }
