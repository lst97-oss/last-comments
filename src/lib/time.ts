// Bun/Node-safe: no runtime imports, no locale dependence.

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function pad3(value: number): string {
  if (value < 10) return `00${value}`
  if (value < 100) return `0${value}`
  return String(value)
}

export function formatClockTime(date: Date = new Date()): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${pad3(date.getMilliseconds())}`
}
