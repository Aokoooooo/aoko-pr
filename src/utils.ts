import fs from 'fs'
import path from 'path'
import { logger, updateLoggerLevelByDebug } from './logger'
import { IConfigFile } from './types'

const CONFIG_FILE_NAME = 'config.json'

export const INIT_CONFIG: IConfigFile = {
  token: '',
  username: '',
  tokenHistory: '',
  debug: false,
  debugRepo: '',
  debugUpstreamOwner: '',
}

export let REPO_NAME = 'audio-chatroom'
export let UPSTREAM_OWNER = 'MiaoSiLa'

export const formatToJSONString = (data: any) => JSON.stringify(data, undefined, 2)

const getConfigFilePath = () => path.join(process.cwd(), CONFIG_FILE_NAME)

export const writeConfigFile = (data?: IConfigFile) => {
  try {
    fs.writeFileSync(CONFIG_FILE_NAME, formatToJSONString(data))
  } catch (e) {
    logger.error(`更新配置文件失败\n${e.message}`)
    logger.error('可以尝试通过 \'config -r\' 指令来重置配置信息')
    throw e
  }
}

const updateRepoAndOwnerByConfig = (config: IConfigFile) => {
  REPO_NAME = config.debugRepo ? config.debugRepo : 'audio-chatroom'
  UPSTREAM_OWNER = config.debugUpstreamOwner ? config.debugUpstreamOwner : 'MiaoSiLa'
}

export const getConfigFile = () => {
  const configPath = getConfigFilePath()
  try {
    if (!fs.existsSync(configPath)) {
      writeConfigFile(INIT_CONFIG)
    }
    const config = require(configPath) as IConfigFile
    updateLoggerLevelByDebug(config?.debug)
    updateRepoAndOwnerByConfig(config)
    return config || {}
  } catch (e) {
    logger.error(`读取配置文件失败\n${e.message}`)
    logger.error('可以尝试通过 \'config -r\' 指令来重置配置信息')
    throw e
  }
}

export const writeFiledOfConfigFile = (data: IConfigFile = {}) => {
  const config = getConfigFile()
  writeConfigFile({ ...config, ...data })
}

export function getAuthHistory(config: IConfigFile): string[]
export function getAuthHistory(
  config: IConfigFile,
  isChoices: boolean
): Array<{ name: string; value: string }>
export function getAuthHistory(config: IConfigFile, isChoices?: boolean) {
  const history = (config.tokenHistory || '').split(',').filter((v) => !!v)
  return isChoices
    ? history.map((v) => {
      const match = /(.*)(: )(.*)/.exec(v)
      // eslint-disable-next-line no-nested-ternary
      const value = !match ? v : match[3] ? match[3] : match[1]
      const data = { name: v, value }
      return data
    })
    : history
}
