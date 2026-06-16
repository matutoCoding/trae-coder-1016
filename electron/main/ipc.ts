import { ipcMain } from 'electron'
import { getDatabase, SimpleJSONDB } from './database'

let db: SimpleJSONDB

function serialize(obj: any): any {
  return JSON.parse(JSON.stringify(obj))
}

export function registerIpcHandlers() {
  db = getDatabase()

  ipcMain.handle('db:insert', async (_event, table: string, record: any) => {
    try {
      const id = db.insert(table, record)
      return { success: true, id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:update', async (_event, table: string, id: number, record: any) => {
    try {
      const success = db.update(table, id, record)
      return { success }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:delete', async (_event, table: string, id: number) => {
    try {
      const success = db.delete(table, id)
      return { success }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:findAll', async (_event, table: string, where?: any) => {
    try {
      const records = db.findAll(table, where)
      return { success: true, data: serialize(records) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('db:findOne', async (_event, table: string, where: any) => {
    try {
      const record = db.findOne(table, where)
      return { success: true, data: serialize(record) }
    } catch (error: any) {
      return { success: false, error: error.message, data: null }
    }
  })

  ipcMain.handle('db:saveMovement', async (_event, movement: any) => {
    try {
      let id: number
      if (movement.id) {
        db.update('movement', movement.id, movement)
        id = movement.id
      } else {
        id = db.insert('movement', movement)
      }
      return { success: true, id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getMovements', async (_event, keyword?: string) => {
    try {
      let where: any = undefined
      if (keyword) {
        where = {
          model: `%${keyword}%`,
          serial: `%${keyword}%`,
          customer: `%${keyword}%`
        }
      }
      const records = db.findAll('movement')
      let filtered = records
      if (keyword) {
        const kw = keyword.toLowerCase()
        filtered = records.filter((r: any) =>
          r.model?.toLowerCase().includes(kw) ||
          r.serial?.toLowerCase().includes(kw) ||
          r.customer?.toLowerCase().includes(kw)
        )
      }
      return { success: true, data: serialize(filtered) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('db:getDiagnosisHistory', async (_event, movementId: number) => {
    try {
      const records = db.findAll('diagnosis', { movement_id: movementId })
      return { success: true, data: serialize(records) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('db:saveDiagnosis', async (_event, diagnosis: any) => {
    try {
      let id: number
      if (diagnosis.id) {
        db.update('diagnosis', diagnosis.id, diagnosis)
        id = diagnosis.id
      } else {
        id = db.insert('diagnosis', diagnosis)
      }
      return { success: true, id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:savePositionError', async (_event, positionError: any) => {
    try {
      const id = db.insert('position_error', positionError)
      return { success: true, id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getMaintenanceHistory', async (_event, movementId: number) => {
    try {
      const records = db.findAll('maintenance', { movement_id: movementId })
      return { success: true, data: serialize(records) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('db:saveMaintenance', async (_event, maintenance: any) => {
    try {
      const id = db.insert('maintenance', maintenance)
      return { success: true, id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:saveCalibration', async (_event, calibration: any) => {
    try {
      const id = db.insert('calibration', calibration)
      return { success: true, id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getCalibrations', async (_event, movementId: number) => {
    try {
      const records = db.findAll('calibration', { movement_id: movementId })
      return { success: true, data: serialize(records) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('db:getReferences', async (_event, keyword?: string) => {
    try {
      const records = db.findAll('reference_movement')
      let filtered = records
      if (keyword) {
        const kw = keyword.toLowerCase()
        filtered = records.filter((r: any) =>
          r.model?.toLowerCase().includes(kw) ||
          r.brand?.toLowerCase().includes(kw)
        )
      }
      return { success: true, data: serialize(filtered) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('db:getReferenceByModel', async (_event, model: string) => {
    try {
      const record = db.findOne('reference_movement', { model })
      return { success: true, data: serialize(record) }
    } catch (error: any) {
      return { success: false, error: error.message, data: null }
    }
  })

  ipcMain.handle('db:saveReference', async (_event, reference: any) => {
    try {
      let id: number
      if (reference.id) {
        db.update('reference_movement', reference.id, reference)
        id = reference.id
      } else {
        id = db.insert('reference_movement', reference)
      }
      return { success: true, id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:removeReference', async (_event, id: number) => {
    try {
      const success = db.delete('reference_movement', id)
      return { success }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getFaultCases', async () => {
    try {
      const records = db.findAll('fault_case') || []
      return { success: true, data: serialize(records) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('db:getCalibrationSpecs', async () => {
    try {
      const records = db.findAll('calibration_spec') || []
      return { success: true, data: serialize(records) }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })
}
