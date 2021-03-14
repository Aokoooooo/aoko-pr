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

  constructor(level: ELoggerLevel = ELoggerLevel.INFO) {
    this.level = level
  }

  private checkLevel = (level: ELoggerLevel, cb: () => void) => {
    if (this.level >= level) {
      cb()
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _log = (...args: any[]) => {
    // eslint-disable-next-line no-console
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
    this.checkLevel(ELoggerLevel.DEBUG, () => this._log(...args))
  }
}

export const logger = new Logger()

export const updateLoggerLevelByDebug = (debug?: boolean) => {
  logger.level = debug ? ELoggerLevel.DEBUG : ELoggerLevel.INFO
}
