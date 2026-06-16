import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  insert: (table, record) => ipcRenderer.invoke('db:insert', table, record),
  update: (table, id, record) => ipcRenderer.invoke('db:update', table, id, record),
  remove: (table, id) => ipcRenderer.invoke('db:delete', table, id),
  findAll: (table, where) => ipcRenderer.invoke('db:findAll', table, where),
  findOne: (table, where) => ipcRenderer.invoke('db:findOne', table, where),
  
  saveMovement: (movement) => ipcRenderer.invoke('db:saveMovement', movement),
  getMovements: (keyword) => ipcRenderer.invoke('db:getMovements', keyword),
  getDiagnosisHistory: (movementId) => ipcRenderer.invoke('db:getDiagnosisHistory', movementId),
  saveDiagnosis: (diagnosis) => ipcRenderer.invoke('db:saveDiagnosis', diagnosis),
  savePositionError: (positionError) => ipcRenderer.invoke('db:savePositionError', positionError),
  getMaintenanceHistory: (movementId) => ipcRenderer.invoke('db:getMaintenanceHistory', movementId),
  saveMaintenance: (maintenance) => ipcRenderer.invoke('db:saveMaintenance', maintenance),
  saveCalibration: (calibration) => ipcRenderer.invoke('db:saveCalibration', calibration),
  getCalibrations: (movementId) => ipcRenderer.invoke('db:getCalibrations', movementId),
  
  getReferences: (keyword) => ipcRenderer.invoke('db:getReferences', keyword),
  getReferenceByModel: (model) => ipcRenderer.invoke('db:getReferenceByModel', model),
  saveReference: (reference) => ipcRenderer.invoke('db:saveReference', reference),
  removeReference: (id) => ipcRenderer.invoke('db:removeReference', id),
  getFaultCases: () => ipcRenderer.invoke('db:getFaultCases'),
  getCalibrationSpecs: () => ipcRenderer.invoke('db:getCalibrationSpecs'),
  
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: () => ipcRenderer.invoke('dialog:saveFile')
})
