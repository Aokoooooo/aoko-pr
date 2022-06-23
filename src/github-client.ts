import { Octokit } from '@octokit/rest'
import ProxyAgent from 'proxy-agent'
import { clientLogger, logger } from './logger'
import { ConfigFile, TReturnType } from './types'
import { getAuthHistory, getConfigFile, writeConfigFile } from './utils'

let client: Octokit

const getCurrentUser = async (_client: Octokit) => {
  const r = await _client.users.getAuthenticated()
  return r.data
}

export let currentUser: TReturnType<typeof getCurrentUser> | null = null

export const updateClientByToken = async (token: string) => {
  const config = getConfigFile()
  client = await new Octokit({
    auth: token,
    log: clientLogger,
    request: {
      agent: config.proxy ? new ProxyAgent(config.proxy) : undefined,
    },
  })
  client.hook.error('request', (e) => {
    clientLogger.error(`client err(${(e as any).status || 0}): ${e.message}`)
    if ((e as any).response?.url?.endsWith('/requested_reviewers')) {
      return
    }
    process.exit(1)
  })
  return client
}

const updateTokenHistory = (config: ConfigFile, token: string, username?: string) => {
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
    const data = await getCurrentUser(_client)
    currentUser = data
    username = data.login || ''
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
