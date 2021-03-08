import fs from 'fs'
import path from 'path'
import { Logger } from './logs'
import { IConfigFile } from './modules/types'

export const githubToken = ''

const CONFIG_FILE_NAME = 'config.json'

export const getConfigFilePath = () => path.join(process.cwd(), CONFIG_FILE_NAME)
export const writeConfigFile = (data?: any) => {
  try {
    fs.writeFileSync(CONFIG_FILE_NAME, JSON.stringify(data))
  } catch (e) {
    Logger.error('更新配置文件失败')
    throw e
  }
}
export const getConfigFile = () => {
  const configPath = getConfigFilePath()
  try {
    if (!fs.existsSync(configPath)) {
      writeConfigFile()
    }
    const config = require(configPath) as IConfigFile
    return config || {}
  } catch (e) {
    Logger.error('读取配置文件失败')
    throw e
  }
}
