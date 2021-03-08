import { updateClientByToken } from '../github'
import { Logger } from '../logs'
import { getConfigFile, writeConfigFile } from '../utils'

export let githubToken = ''

export const authByToken = (token: string) => {
  Logger.log('验证身份中。。。')
  const client = updateClientByToken(token)
  Logger.log('验证成功，你就是我的 master 的吗？')
  const config = getConfigFile()
  githubToken = token
  if (config.githubToken !== token) {
    config.githubToken = token
    writeConfigFile(config)
  }
  return client
}
