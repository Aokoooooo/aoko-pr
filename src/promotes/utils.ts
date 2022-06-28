import inquirer from 'inquirer'
import { decode, encode } from 'js-base64'
import shell from 'shelljs'
import { authByToken } from '../github-client'
import { logger } from '../logger'
import { ArrayItem, TReturnType } from '../types'
import { REPO_NAME, UPSTREAM_OWNER, formatToJSONString, getAuthHistory, getConfigFile, mergeConfigFile } from '../utils'

export const getBooleanPrompt = async (msg: string) => {
  const result = await inquirer.prompt({
    type: 'confirm',
    name: 'value',
    message: msg,
  })
  return result.value
}

const INPUT_GITHUB_TOKEN_MANUALY = '点我手动输入 token'

interface IAuthPromptOpts {
  token?: string
  ls?: boolean
  rm?: boolean
}

let isFirstAuthCheck = true

export const authPrompt = async (opts?: IAuthPromptOpts, forceNewToken?: boolean) => {
  const config = getConfigFile()
  if (opts?.rm) {
    const history = getAuthHistory(config, true)
    const { choices } = await inquirer.prompt({
      type: 'checkbox',
      message: '请选择 token',
      name: 'choices',
      choices: history,
    })
    const newHistory = getAuthHistory(config)
      .filter((v) => !(choices as string[]).some((c) => v.includes(c)))
      .join(',')
    mergeConfigFile({ tokenHistory: newHistory })
    process.exit(0)
  }
  if (opts?.ls) {
    const history = getAuthHistory(config, true)
    history.unshift({
      name: INPUT_GITHUB_TOKEN_MANUALY,
      value: INPUT_GITHUB_TOKEN_MANUALY,
    })
    const selectResult = await inquirer.prompt({
      type: 'list',
      message: '请选择 token',
      name: 'token',
      choices: history,
    })
    opts.token = selectResult.token === INPUT_GITHUB_TOKEN_MANUALY ? '' : selectResult.token
  }
  let _token = forceNewToken ? opts?.token : opts?.token || config.token
  if (!_token || (!config.username && !forceNewToken)) {
    const r = await inquirer.prompt({
      type: 'input',
      name: 'token',
      message: '请输入 bot 账号的 personal access token(https://github.com/settings/tokens)',
      validate: (v) => !!v,
    })
    _token = r.token
  }
  const client = await authByToken(_token as string, forceNewToken || isFirstAuthCheck)
  isFirstAuthCheck = false
  return client
}

export const getBaseData = async () => {
  const config = getConfigFile()
  const client = await authPrompt()
  if (config.useGitCLI && !shell.which('git')) {
    logger.error('需要先安装 git。')
    process.exit(1)
  }
  return { config, client }
}

export const searchBranchPrompt = async () => {
  const { config, client } = await getBaseData()
  const owner = config.username || ''
  logger.log('查询分支中。。。')
  const branches = await client.repos.listBranches({
    repo: REPO_NAME,
    owner,
  })
  if (!branches.data.length) {
    logger.error('未找到任何分支')
    process.exit(1)
  }
  const result = await inquirer.prompt({
    type: 'list',
    name: 'value',
    choices: branches.data,
    message: '请选择分支',
  })
  return result.value
}

export const getPRPrompt = async (id: number) => {
  const { client } = await getBaseData()
  logger.log('查询 PR 中')
  const result = await client.pulls.get({
    owner: UPSTREAM_OWNER,
    repo: REPO_NAME,
    pull_number: id,
  })
  return result.data
}

export const selectPRPrompt = async () => {
  const { client } = await getBaseData()
  logger.log('查询 PR 列表中')
  // WORKAROUND: 未处理分页，因为 bot 里的 PR 一般不会超过 100（不是因为懒（大声
  const { data: prs } = await client.pulls.list({
    owner: UPSTREAM_OWNER,
    repo: REPO_NAME,
    state: 'open',
    per_page: 100,
    base: 'stable',
  })
  if (!prs.length) {
    logger.error('未找到任何 PR')
    process.exit(1)
  }
  const { id } = await inquirer.prompt({
    type: 'list',
    message: '请选择 PR',
    name: 'id',
    choices: prs.map((v) => ({
      name: `${v.title}#${v.number}`,
      value: v.number,
    })),
  })
  const result = await getPRPrompt(id)
  return result
}

export interface IUpdatePRPromptOpts {
  id?: string | number
  title?: string
  version?: string | boolean
  android?: string
  ios?: string
}

export const getPRCommitsPrompt = async (id: number, total: number) => {
  const { config, client } = await getBaseData()
  logger.log('查询提交中')
  const result = []
  let page = 1
  while (total > 0) {
    const r = await client.pulls.listCommits({
      owner: UPSTREAM_OWNER,
      repo: REPO_NAME,
      pull_number: id,
      per_page: 100,
      page: page++,
    })
    total -= 100
    result.push(...r.data)
  }
  return result.filter(
    (v) => v.author?.login && v.author.login !== config.username && v.commit.message.startsWith('frontend')
  )
}

export const getUpstreamMasterPrompt = async () => {
  const { client } = await getBaseData()
  logger.log('查询上游 master 分支中。。。')
  const masterRef = await client.git.getRef({
    ref: 'heads/master',
    repo: REPO_NAME,
    owner: UPSTREAM_OWNER,
  })
  return masterRef.data
}

export const createRefPrompt = async (sha: string, branchName: string) => {
  const { config, client } = await getBaseData()
  const repo = REPO_NAME
  const owner = config.username || ''
  logger.log(`创建 ref “${branchName}” 中。。。`)
  const result = await client.git.createRef({
    ref: `refs/heads/${branchName}`,
    repo,
    owner,
    sha,
  })
  logger.success(`ref “${branchName}” 创建成功`)
  return result.data
}

interface IDeleteBranchPromptOpts {
  name?: string
}

export const deleteBranchPrompt = async (opts: IDeleteBranchPromptOpts) => {
  const { config, client } = await getBaseData()
  let name = opts.name
  const owner = config.username || ''
  if (!name) {
    name = await searchBranchPrompt()
  }
  logger.log(`删除分支 "${name}" 中。。。`)
  await client.git.deleteRef({
    repo: REPO_NAME,
    owner,
    ref: `heads/${name}`,
  })
  logger.success(`分支 "${name}" 删除成功`)
}

export const updateVersionPrompt = async (
  pr: ArrayItem<TReturnType<typeof getPRPrompt>>,
  opts: IUpdatePRPromptOpts
) => {
  let version = opts.version
  const reg = /^(\d+\.)*\d$/
  const filename = 'package.json'
  const isAutoGenerateVersion = version === true
  if (!isAutoGenerateVersion && !reg.test(version as string)) {
    logger.error(`version 更新失败。version 必须满足 ${reg} 的格式（${version}）`)
    return false
  }
  const { config, client } = await getBaseData()
  const owner = config.username || ''
  logger.log('查询历史 version 中')
  const oldFile = await client.repos.getContent({
    owner,
    repo: REPO_NAME,
    path: filename,
    ref: pr.head.ref,
  })
  let pkg = { version: '' }
  try {
    pkg = JSON.parse(decode((oldFile.data as any)?.content))
  } catch (_) {
    logger.error(`解析历史 version 失败，请确认 ${filename} 存在并且内容为合法 JSON`)
    return false
  }
  const oldVersion = pkg.version
  if (isAutoGenerateVersion) {
    const newVersionNum = parseInt(pkg.version.replace(/\./g, ''))
    if (!newVersionNum) {
      logger.error(`pkg.version(${pkg.version}) 无法解析为数字，请检查`)
      return false
    }
    const splitedVersion = String(newVersionNum + 1).split('')
    splitedVersion.splice(splitedVersion.length - 2, 0, '.')
    splitedVersion.splice(splitedVersion.length - 1, 0, '.')
    version = splitedVersion.join('')
  }
  if (oldVersion === version) {
    logger.warn(`version 并未发生变化，请确认你想更新的 version（${version}）`)
    return false
  }
  pkg.version = version as string
  logger.log('更新 version 中。。。')
  await client.repos.createOrUpdateFileContents({
    owner,
    repo: REPO_NAME,
    path: filename,
    message: `version: ${oldVersion} => ${version}`,
    content: encode(`${formatToJSONString(pkg)}\n`),
    branch: pr.head.ref,
    sha: (oldFile.data as any).sha,
  })
  opts.version = version
  logger.success(`version 更新成功，当前 version: ${version}`)
  return true
}
