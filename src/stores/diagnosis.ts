import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  PositionErrors,
  Diagnosis,
  PositionErrorRecord,
  Maintenance,
  Calibration,
  AmplitudeRateData,
  RiskAlert
} from '@/types'

export const useDiagnosisStore = defineStore('diagnosis', () => {
  const currentAmplitude = ref<number>(260)
  const currentRate = ref<number>(0)
  const currentBeatError = ref<number>(0)
  const positionErrors = ref<PositionErrors>({
    face_up: 0,
    face_down: 0,
    crown_left: 0,
    crown_right: 0,
    crown_up: 0,
    crown_down: 0
  })

  const diagnosisHistory = ref<Diagnosis[]>([])
  const maintenanceHistory = ref<Maintenance[]>([])
  const amplitudeRateHistory = ref<AmplitudeRateData[]>([])
  const riskAlerts = ref<RiskAlert[]>([])

  const measuredClearance = ref<number>(0)
  const targetRate = ref<number>(0)
  const currentTemperature = ref<number>(20)
  const elasticModulus = ref<number>(180)

  const targetTemperature = ref<number>(23)

  async function loadDiagnosisHistory(movementId: number) {
    if (!window.electronAPI) {
      diagnosisHistory.value = []
      return
    }
    const result = await window.electronAPI.getDiagnosisHistory(movementId)
    if (result.success) {
      diagnosisHistory.value = result.data
      amplitudeRateHistory.value = result.data.map((d: Diagnosis) => ({
        amplitude: d.amplitude || 0,
        rate: d.rate || 0,
        time: d.diagnose_time || new Date().toISOString()
      }))
    }
  }

  async function loadMaintenanceHistory(movementId: number) {
    if (!window.electronAPI) {
      maintenanceHistory.value = []
      return
    }
    const result = await window.electronAPI.getMaintenanceHistory(movementId)
    if (result.success) {
      maintenanceHistory.value = result.data
    }
  }

  async function saveDiagnosis(diagnosis: Diagnosis): Promise<number | null> {
    if (!window.electronAPI) return 1
    const result = await window.electronAPI.saveDiagnosis(diagnosis)
    if (result.success && result.id) {
      await loadDiagnosisHistory(diagnosis.movement_id)
      return result.id
    }
    return null
  }

  async function savePositionError(record: PositionErrorRecord): Promise<number | null> {
    if (!window.electronAPI) return 1
    const result = await window.electronAPI.savePositionError(record)
    return result.success && result.id ? result.id : null
  }

  async function saveMaintenance(maintenance: Maintenance): Promise<number | null> {
    if (!window.electronAPI) return 1
    const result = await window.electronAPI.saveMaintenance(maintenance)
    if (result.success && result.id) {
      await loadMaintenanceHistory(maintenance.movement_id)
      return result.id
    }
    return null
  }

  async function saveCalibration(calibration: Calibration): Promise<number | null> {
    if (!window.electronAPI) return 1
    const result = await window.electronAPI.saveCalibration(calibration)
    return result.success && result.id ? result.id : null
  }

  function setRiskAlerts(alerts: RiskAlert[]) {
    riskAlerts.value = alerts
  }

  function resetPositionErrors() {
    positionErrors.value = {
      face_up: 0,
      face_down: 0,
      crown_left: 0,
      crown_right: 0,
      crown_up: 0,
      crown_down: 0
    }
  }

  function addAmplitudeRateData(data: AmplitudeRateData) {
    amplitudeRateHistory.value.push(data)
  }

  return {
    currentAmplitude,
    currentRate,
    currentBeatError,
    positionErrors,
    diagnosisHistory,
    maintenanceHistory,
    amplitudeRateHistory,
    riskAlerts,
    measuredClearance,
    targetRate,
    currentTemperature,
    elasticModulus,
    targetTemperature,
    loadDiagnosisHistory,
    loadMaintenanceHistory,
    saveDiagnosis,
    savePositionError,
    saveMaintenance,
    saveCalibration,
    setRiskAlerts,
    resetPositionErrors,
    addAmplitudeRateData
  }
})
