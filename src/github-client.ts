import { Octokit } from '@octokit/rest'
import { logger } from './logger'
import { IConfigFile } from './types'
import { getAuthHistory, getConfigFile, writeConfigFile } from './utils'

let client: Octokit

export const getClient = () => client

export const updateClientByToken = async (token: string) => {
  client = await new Octokit({ auth: token, log: logger })
  client.hook.error('request', (e) => {
    logger.error(`client err(${(e as any).status || 0}): ${e.message}`)
    process.exit(0)
  })
  return client
}

const updateTokenHistory = (config: IConfigFile, token: string, username?: string) => {
  const history = getAuthHistory(config).filter((v) => !v.includes(token))
  history.push(`${username}: ${token}`)
  config.tokenHistory = history.join(',')
}

export const authByToken = async (token: string, checkAuth?: boolean) => {
  let _client: Octokit
  let username = ''
  if (checkAuth) {
    logger.log('验证身份中。。。')
    _client = await updateClientByToken(token)
    const r = await _client.users.getAuthenticated()
    username = r.data.login || ''
    logger.success(`验证成功，${username}，你就是我的 master 吗？`)
  } else {
    _client = await updateClientByToken(token)
  }
  const config = getConfigFile()
  if (config.token !== token || config.username !== username || checkAuth) {
    config.token = token
    if (username) {
      config.username = username
    }
    updateTokenHistory(config, token, config.username)
    writeConfigFile(config)
  }
  return _client
}
