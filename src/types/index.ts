export interface Movement {
  id?: number
  model: string
  brand?: string
  serial?: string
  customer?: string
  frequency?: number
  inertia?: number
  hs_thickness?: number
  hs_width?: number
  hs_coils?: number
  lock_angle?: number
  impulse_angle?: number
  lift_angle?: number
  teeth?: number
  create_time?: string
}

export interface ReferenceMovement {
  id: number
  model: string
  brand?: string
  std_frequency: number
  std_lift_angle: number
  min_amplitude: number
  max_amplitude: number
  allow_rate_error: number
  allow_position_error: number
  description?: string
  beat_rate?: number
  train_count?: number
  power_reserve?: number
}

export interface FaultCase {
  id: number
  title: string
  phenomenon: string
  cause: string
  analysis: string
  solution: string
  tools: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  related_models: string[]
  category: string
}

export interface CalibrationSpec {
  id: number
  brand: string
  model_range: string
  standard: string
  procedure: string[]
  acceptance: string[]
  precautions: string[]
  tools_required: string[]
  estimated_time: string
}

export interface Diagnosis {
  id?: number
  movement_id: number
  amplitude?: number
  rate?: number
  beat_error?: number
  isochronism?: string
  lock_status?: string
  impulse_status?: string
  position_analysis?: string
  risk_warning?: string
  diagnose_time?: string
}

export interface PositionErrors {
  face_up: number
  face_down: number
  crown_left: number
  crown_right: number
  crown_up: number
  crown_down: number
}

export interface PositionErrorRecord extends PositionErrors {
  id?: number
  movement_id: number
  max_deviation?: number
  result?: string
}

export interface PositionMatrixResult {
  matrix: number[][]
  maxDeviation: number
  average: number
  isPass: boolean
}

export interface IsochronismResult {
  isInRange: boolean
  deviation: number
  level: 'excellent' | 'good' | 'normal' | 'poor'
}

export interface ClearanceCheckResult {
  hasRisk: boolean
  theoreticalClearance: number
  tolerance: number
  suggestion: string
}

export interface TemperatureDriftPoint {
  temp: number
  modulus: number
  rate: number
}

export interface TrimCoilsResult {
  trimCoils: number
  direction: 'shorten' | 'lengthen'
  precision: string
}

export interface Maintenance {
  id?: number
  movement_id: number
  operation?: string
  before_amplitude?: number
  after_amplitude?: number
  before_rate?: number
  after_rate?: number
  technician?: string
  maintain_time?: string
  notes?: string
}

export interface Calibration {
  id?: number
  movement_id: number
  temperature?: number
  elastic_modulus?: number
  rate_drift?: number
  target_rate?: number
  trim_coils?: number
  eccentricity?: number
  adjust_direction?: string
  timestamp?: string
}

export interface AmplitudeRateData {
  amplitude: number
  rate: number
  time: string
}

export interface RiskAlert {
  type: 'low_amplitude' | 'high_rate_error' | 'high_position_error' | 'escapement_risk'
  level: 'warning' | 'danger'
  message: string
  suggestion: string
}

declare global {
  interface Window {
    electronAPI: {
      insert: (table: string, record: any) => Promise<{ success: boolean; id?: number; error?: string }>
      update: (table: string, id: number, record: any) => Promise<{ success: boolean; error?: string }>
      remove: (table: string, id: number) => Promise<{ success: boolean; error?: string }>
      findAll: (table: string, where?: any) => Promise<{ success: boolean; data: any[]; error?: string }>
      findOne: (table: string, where: any) => Promise<{ success: boolean; data: any | null; error?: string }>
      
      saveMovement: (movement: Movement) => Promise<{ success: boolean; id?: number; error?: string }>
      getMovements: (keyword?: string) => Promise<{ success: boolean; data: Movement[]; error?: string }>
      getDiagnosisHistory: (movementId: number) => Promise<{ success: boolean; data: Diagnosis[]; error?: string }>
      saveDiagnosis: (diagnosis: Diagnosis) => Promise<{ success: boolean; id?: number; error?: string }>
      savePositionError: (positionError: PositionErrorRecord) => Promise<{ success: boolean; id?: number; error?: string }>
      getMaintenanceHistory: (movementId: number) => Promise<{ success: boolean; data: Maintenance[]; error?: string }>
      saveMaintenance: (maintenance: Maintenance) => Promise<{ success: boolean; id?: number; error?: string }>
      saveCalibration: (calibration: Calibration) => Promise<{ success: boolean; id?: number; error?: string }>
      getCalibrations: (movementId: number) => Promise<{ success: boolean; data: Calibration[]; error?: string }>
      
      getReferences: (keyword?: string) => Promise<{ success: boolean; data: ReferenceMovement[]; error?: string }>
      getReferenceByModel: (model: string) => Promise<{ success: boolean; data: ReferenceMovement | null; error?: string }>
      saveReference: (reference: Omit<ReferenceMovement, 'id'> & { id?: number }) => Promise<{ success: boolean; id?: number; error?: string }>
      removeReference: (id: number) => Promise<{ success: boolean; error?: string }>
      getFaultCases: () => Promise<{ success: boolean; data: FaultCase[]; error?: string }>
      getCalibrationSpecs: () => Promise<{ success: boolean; data: CalibrationSpec[]; error?: string }>
      
      openFileDialog: () => Promise<any>
      saveFileDialog: () => Promise<any>
    }
  }
}

export {}
