export const isDebug = process.env.NEXT_PUBLIC_DEBUG === 'true'

export const debug = {
  log: (...args: unknown[]) => { if (isDebug) console.log(...args) },
  warn: (...args: unknown[]) => { if (isDebug) console.warn(...args) },
  error: (...args: unknown[]) => { console.error(...args) },
}
