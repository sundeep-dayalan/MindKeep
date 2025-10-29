/**
 * Development-only logger utility
 * Logs are automatically stripped in production builds
 */

const isDevelopment = process.env.NODE_ENV !== "production"

export const logger = {
  log: (...args: any[]): void => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  error: (...args: any[]): void => {
    if (isDevelopment) {
      console.error(...args)
    }
  },

  warn: (...args: any[]): void => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },

  info: (...args: any[]): void => {
    if (isDevelopment) {
      console.info(...args)
    }
  },

  debug: (...args: any[]): void => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },

  table: (data: any): void => {
    if (isDevelopment) {
      console.table(data)
    }
  },

  group: (label: string): void => {
    if (isDevelopment) {
      console.group(label)
    }
  },

  groupEnd: (): void => {
    if (isDevelopment) {
      console.groupEnd()
    }
  }
}
