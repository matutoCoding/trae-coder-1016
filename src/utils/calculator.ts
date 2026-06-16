import type {
  PositionErrors,
  PositionMatrixResult,
  IsochronismResult,
  ClearanceCheckResult,
  TemperatureDriftPoint,
  TrimCoilsResult,
  ReferenceMovement,
  RiskAlert
} from '@/types'

export function calculateIdealRate(amplitude: number, reference: ReferenceMovement): number {
  const midAmplitude = (reference.min_amplitude + reference.max_amplitude) / 2
  const amplitudeDeviation = amplitude - midAmplitude
  const amplitudeCoefficient = -0.002
  return amplitudeCoefficient * amplitudeDeviation
}

export function checkIsochronism(
  amplitude: number,
  rate: number,
  reference: ReferenceMovement
): IsochronismResult {
  const idealRate = calculateIdealRate(amplitude, reference)
  const deviation = Math.abs(rate - idealRate)

  if (deviation < 2) return { isInRange: true, deviation, level: 'excellent' }
  if (deviation < 4) return { isInRange: true, deviation, level: 'good' }
  if (deviation < reference.allow_rate_error) return { isInRange: true, deviation, level: 'normal' }
  return { isInRange: false, deviation, level: 'poor' }
}

export function calculatePositionMatrix(errors: PositionErrors, allowPositionError: number = 15): PositionMatrixResult {
  const { face_up, face_down, crown_left, crown_right, crown_up, crown_down } = errors

  const matrix = [
    [face_up, face_down],
    [crown_left, crown_right],
    [crown_up, crown_down]
  ]

  const allValues = [face_up, face_down, crown_left, crown_right, crown_up, crown_down]
  const maxDeviation = Math.max(...allValues) - Math.min(...allValues)
  const average = allValues.reduce((a, b) => a + b, 0) / 6
  const isPass = maxDeviation <= allowPositionError

  return { matrix, maxDeviation, average, isPass }
}

export function simulateTemperatureDrift(
  baseModulus: number = 180,
  frequency: number = 4.0,
  tempRange: [number, number] = [-10, 60]
): TemperatureDriftPoint[] {
  const results: TemperatureDriftPoint[] = []
  const tempCoefficient = -0.0002

  for (let t = tempRange[0]; t <= tempRange[1]; t += 5) {
    const modulus = baseModulus * (1 + tempCoefficient * (t - 20))
    const newFrequency = frequency * Math.sqrt(modulus / baseModulus)
    const rate = (newFrequency - frequency) / frequency * 86400
    results.push({ temp: t, modulus, rate: Number(rate.toFixed(2)) })
  }

  return results
}

export function calculateTrimCoils(
  currentRate: number,
  targetRate: number,
  currentCoils: number
): TrimCoilsResult {
  const relativeError = (targetRate - currentRate) / 86400
  const deltaCoils = 2 * relativeError * currentCoils

  const trimCoils = Math.abs(deltaCoils)
  const direction = deltaCoils > 0 ? 'lengthen' : 'shorten'
  const precision = formatPrecision(trimCoils)

  return { trimCoils, direction, precision }
}

export function formatPrecision(coils: number): string {
  const eighths = Math.round(coils * 8)
  const whole = Math.floor(eighths / 8)
  const frac = eighths % 8

  if (frac === 0) return `${whole}`
  if (whole === 0) {
    if (frac === 4) return `1/2`
    if (frac === 2) return `1/4`
    if (frac === 6) return `3/4`
    return `${frac}/8`
  }
  if (frac === 4) return `${whole} 1/2`
  if (frac === 2) return `${whole} 1/4`
  if (frac === 6) return `${whole} 3/4`
  return `${whole} ${frac}/8`
}

export function checkEscapementClearance(
  lockAngle: number,
  impulseAngle: number,
  teeth: number,
  measuredClearance: number
): ClearanceCheckResult {
  const theoreticalClearance = (360 / teeth / 2) - lockAngle - impulseAngle
  const tolerance = theoreticalClearance * 0.3
  const hasRisk = measuredClearance > theoreticalClearance + tolerance

  let suggestion = ''
  if (hasRisk) {
    suggestion = '余隙过大，存在脱跳风险，建议检查叉头钉位置或更换擒纵叉'
  } else if (measuredClearance < theoreticalClearance - tolerance) {
    suggestion = '余隙过小，可能导致传动不畅，建议检查叉瓦深度'
  } else {
    suggestion = '余隙正常'
  }

  return { hasRisk, theoreticalClearance, tolerance, suggestion }
}

export function analyzePositionErrorCauses(errors: PositionErrors): {
  hasEccentricity: boolean
  hasEndCurveIssue: boolean
  eccentricityDirection?: string
  analysis: string
} {
  const { face_up, face_down, crown_left, crown_right, crown_up, crown_down } = errors
  const verticalAvg = (crown_left + crown_right + crown_up + crown_down) / 4
  const horizontalDiff = Math.abs(face_up - face_down)
  const verticalDiff = Math.abs(crown_up - crown_down)
  const lateralDiff = Math.abs(crown_left - crown_right)
  const maxDiff = Math.max(horizontalDiff, verticalDiff, lateralDiff)

  const hasEccentricity = lateralDiff > 5 || verticalDiff > 5
  const hasEndCurveIssue = horizontalDiff > 8 || (verticalAvg > 5 && horizontalDiff > 5)

  let eccentricityDirection = ''
  if (crown_left > crown_right + 3) eccentricityDirection = '游丝向柄左方向偏心'
  else if (crown_right > crown_left + 3) eccentricityDirection = '游丝向柄右方向偏心'
  else if (crown_up > crown_down + 3) eccentricityDirection = '游丝向柄上方向偏心'
  else if (crown_down > crown_up + 3) eccentricityDirection = '游丝向柄下方向偏心'

  let analysis = ''
  if (hasEccentricity && hasEndCurveIssue) {
    analysis = `检测到游丝偏心（${maxDiff.toFixed(1)}s/d）和末端曲线问题，建议先校正游丝中心，再检查末端曲线形状`
  } else if (hasEccentricity) {
    analysis = `检测到游丝偏心（${maxDiff.toFixed(1)}s/d），${eccentricityDirection || '建议使用游丝校正器调整中心'}`
  } else if (hasEndCurveIssue) {
    analysis = `检测到末端曲线可能不当（水平差${horizontalDiff.toFixed(1)}s/d），建议检查游丝末端曲线的曲率和高度`
  } else {
    analysis = '位置差在正常范围内'
  }

  return { hasEccentricity, hasEndCurveIssue, eccentricityDirection, analysis }
}

export function checkLockAndImpulse(
  amplitude: number,
  lockAngle: number,
  impulseAngle: number,
  reference: ReferenceMovement
): {
  lockStatus: 'normal' | 'too_large' | 'too_small'
  impulseStatus: 'normal' | 'too_large' | 'too_small'
  isochronismZone: boolean
  message: string
} {
  const minAmplitude = reference.min_amplitude
  const maxAmplitude = reference.max_amplitude

  const optimalLockAngle = 12
  const optimalImpulseAngle = 40

  let lockStatus: 'normal' | 'too_large' | 'too_small' = 'normal'
  if (lockAngle < 8) lockStatus = 'too_small'
  else if (lockAngle > 16) lockStatus = 'too_large'

  let impulseStatus: 'normal' | 'too_large' | 'too_small' = 'normal'
  if (impulseAngle < 35) impulseStatus = 'too_small'
  else if (impulseAngle > 45) impulseStatus = 'too_large'

  const isochronismZone = amplitude >= minAmplitude && amplitude <= maxAmplitude

  let message = ''
  if (!isochronismZone) {
    message = `摆幅${amplitude.toFixed(0)}°不在等时区间(${minAmplitude}°-${maxAmplitude}°)，`
  }
  if (lockStatus !== 'normal') {
    message += `锁接角${lockAngle.toFixed(1)}°${lockStatus === 'too_large' ? '过大' : '过小'}（理想${optimalLockAngle}°），`
  }
  if (impulseStatus !== 'normal') {
    message += `冲量角${impulseAngle.toFixed(1)}°${impulseStatus === 'too_large' ? '过大' : '过小'}（理想${optimalImpulseAngle}°），`
  }
  if (!message) {
    message = `擒纵工作正常，摆幅${amplitude.toFixed(0)}°处于等时区间，锁接角和冲量角在理想范围内`
  } else {
    message = message.slice(0, -1) + '，可能影响等时性'
  }

  return { lockStatus, impulseStatus, isochronismZone, message }
}

export function generateRiskAlerts(
  amplitude: number,
  rate: number,
  positionMaxDeviation: number,
  hasEscapementRisk: boolean,
  reference: ReferenceMovement
): RiskAlert[] {
  const alerts: RiskAlert[] = []

  if (amplitude < 220) {
    alerts.push({
      type: 'low_amplitude',
      level: amplitude < 180 ? 'danger' : 'warning',
      message: `摆幅过低：${amplitude.toFixed(0)}°`,
      suggestion: amplitude < 180
        ? '严重动力不足或机芯严重缺油，建议立即洗油保养并检查发条盒'
        : '动力不足或润滑油干涩，建议检查发条力矩和机芯润滑情况'
    })
  }

  if (Math.abs(rate) > reference.allow_rate_error) {
    alerts.push({
      type: 'high_rate_error',
      level: Math.abs(rate) > reference.allow_rate_error * 2 ? 'danger' : 'warning',
      message: `日差超差：${rate > 0 ? '+' : ''}${rate.toFixed(1)}s/d`,
      suggestion: `日差超出±${reference.allow_rate_error}s/d允许范围，建议进行游丝快慢针调校`
    })
  }

  if (positionMaxDeviation > reference.allow_position_error) {
    alerts.push({
      type: 'high_position_error',
      level: positionMaxDeviation > reference.allow_position_error * 1.5 ? 'danger' : 'warning',
      message: `位置差过大：${positionMaxDeviation.toFixed(1)}s/d`,
      suggestion: `位置差超出${reference.allow_position_error}s/d允许范围，建议检查游丝偏心和末端曲线`
    })
  }

  if (hasEscapementRisk) {
    alerts.push({
      type: 'escapement_risk',
      level: 'danger',
      message: '擒纵机构存在脱跳风险',
      suggestion: '擒纵余隙过大，建议检查擒纵叉叉头钉位置或更换磨损部件'
    })
  }

  return alerts
}

export function calculateEccentricityAdjustment(
  positionErrors: PositionErrors
): {
  eccentricity: number
  direction: string
  displacement: number
} {
  const { crown_left, crown_right, crown_up, crown_down } = positionErrors
  const lateralError = crown_right - crown_left
  const verticalError = crown_down - crown_up

  const eccentricity = Math.sqrt(lateralError * lateralError + verticalError * verticalError)
  let direction = ''
  const angle = Math.atan2(verticalError, lateralError) * 180 / Math.PI

  if (angle >= -22.5 && angle < 22.5) direction = '3点钟方向'
  else if (angle >= 22.5 && angle < 67.5) direction = '5点钟方向'
  else if (angle >= 67.5 && angle < 112.5) direction = '6点钟方向'
  else if (angle >= 112.5 && angle < 157.5) direction = '7点钟方向'
  else if (angle >= 157.5 || angle < -157.5) direction = '9点钟方向'
  else if (angle >= -157.5 && angle < -112.5) direction = '11点钟方向'
  else if (angle >= -112.5 && angle < -67.5) direction = '12点钟方向'
  else direction = '1点钟方向'

  const displacement = eccentricity * 0.5

  return {
    eccentricity: Number(eccentricity.toFixed(1)),
    direction,
    displacement: Number(displacement.toFixed(2))
  }
}
