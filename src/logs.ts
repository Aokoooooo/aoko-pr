/* eslint-disable no-console */
import chalk from 'chalk'

export class Logger {
  static log(...args: any[]) {
    console.log(chalk.cyan(...args))
  }

  static error(...args: any[]) {
    console.log(chalk.red(...args))
  }

  static warn(...args: any[]) {
    console.log(chalk.yellow(...args))
  }

  static success(...args: any[]) {
    console.log(chalk.green(...args))
  }

  static info(...args: any[]) {
    console.log(...args)
  }
}
