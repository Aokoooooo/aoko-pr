import chalk from 'chalk'

export enum ELoggerLevel {
  NONE,
  ERROR,
  WARN,
  INFO,
  DEBUG,
}

export class Logger {
  level: ELoggerLevel

  noDebugMsg: boolean

  constructor(noDebugMsg = false, level: ELoggerLevel = ELoggerLevel.INFO) {
    this.noDebugMsg = noDebugMsg
    this.level = level
  }

  private checkLevel = (level: ELoggerLevel, cb: () => void) => {
    if (this.level >= level) {
      cb()
    }
  }

  private _log = (...args: any[]) => {
    console.log(...args)
  }

  error = (...args: any[]) => {
    this.checkLevel(ELoggerLevel.ERROR, () => this._log(chalk.red(...args)))
  }

  warn = (...args: any[]) => {
    this.checkLevel(ELoggerLevel.WARN, () => this._log(chalk.yellow(...args)))
  }

  log = (...args: any[]) => {
    this.checkLevel(ELoggerLevel.INFO, () => this._log(chalk.cyan(...args)))
  }

  info = (...args: any[]) => {
    this.checkLevel(ELoggerLevel.INFO, () => this._log(chalk.magentaBright(...args)))
  }

  success = (...args: any[]) => {
    this.checkLevel(ELoggerLevel.INFO, () => this._log(chalk.green(...args)))
  }

  debug = (...args: any[]) => {
    this.checkLevel(ELoggerLevel.DEBUG, () => {
      if (this.noDebugMsg) {
        return
      }
      this._log(...args)
    })
  }
}

export const logger = new Logger()
export const clientLogger = new Logger(true)

export const updateLoggerLevelByDebug = (debug?: boolean) => {
  const level = debug ? ELoggerLevel.DEBUG : ELoggerLevel.INFO
  logger.level = level
  clientLogger.level = level
}
