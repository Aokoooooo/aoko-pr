import day from 'dayjs'
import inquirer from 'inquirer'
import { decode, encode } from 'js-base64'
import shell from 'shelljs'
import { authByToken } from './github-client'
import { logger } from './logger'
import { ITableRowDataMap, parseTemplate } from './template/audio-chatroom'
import { ConfigFile, ArrayItem, TReturnType } from './types'
import {
  INIT_CONFIG,
  REPO_NAME,
  UPSTREAM_OWNER,
  formatToJSONString,
  getAuthHistory,
  getConfigFile,
  getConfigFilePath,
  mergeConfigFile,
  writeConfigFile,
} from './utils'

const getBooleanPrompt = async (msg: string) => {
  const result = await inquirer.prompt({
    type: 'confirm',
    name: 'value',
    message: msg,
  })
  return result.value
}

interface IConfigPromptOpts {
  get?: keyof ConfigFile
  set?: string
  list?: boolean
  reset?: boolean
}

export const configPrompt = (opts: IConfigPromptOpts) => {
  if (opts.reset) {
    writeConfigFile(INIT_CONFIG)
    logger.success('初始化配置信息成功')
  }
  logger.info(`配置文件路径为：\n${getConfigFilePath()}`)
  const config = getConfigFile()
  if (opts.get) {
    logger.log(config[opts.get])
  } else if (opts.set) {
    const [name, value] = opts.set.split('=')
    // eslint-disable-next-line no-nested-ternary
    const parsedValue = value === 'true' ? true : value === 'false' ? false : value
    mergeConfigFile({ [name]: parsedValue })
  } else if (opts.list) {
    logger.log(Object.keys(config).join('\n'))
  } else {
    logger.info('当前的配置信息为：\n')
    logger.log(formatToJSONString(config))
    logger.info('\n输入 config -h 查看更多信息')
  }
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

const getBaseData = async () => {
  const config = getConfigFile()
  const client = await authPrompt()
  if (config.useGitCLI && !shell.which('git')) {
    logger.error('需要先安装 git。')
    process.exit(1)
  }
  return { config, client }
}

const searchBranchPrompt = async () => {
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

const getPRPrompt = async (id: number) => {
  const { client } = await getBaseData()
  logger.log('查询 PR 中')
  const result = await client.pulls.get({
    owner: UPSTREAM_OWNER,
    repo: REPO_NAME,
    pull_number: id,
  })
  return result.data
}

const selectPRPrompt = async () => {
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

interface IUpdatePRPromptOpts {
  id?: string | number
  title?: string
  version?: string | boolean
}

const getPRCommitsPrompt = async (id: number, total: number) => {
  const { config, client } = await getBaseData()
  logger.log('查询提交中')
  const result = []
  let page = 1
  while (total > 0) {
    // eslint-disable-next-line no-await-in-loop
    const r = await client.pulls.listCommits({
      owner: UPSTREAM_OWNER,
      repo: REPO_NAME,
      pull_number: id,
      per_page: 100,
      page: page++,
    })
    // eslint-disable-next-line no-param-reassign
    total -= 100
    result.push(...r.data)
  }
  return result.filter(
    (v) => v.author?.login && v.author.login !== config.username && v.commit.message.startsWith('frontend')
  )
}

const getUpstreamMasterPrompt = async () => {
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

const updateVersionPrompt = async (pr: ArrayItem<TReturnType<typeof getPRPrompt>>, opts: IUpdatePRPromptOpts) => {
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
    // eslint-disable-next-line no-param-reassign
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

export const updatePRPrompt = async (opts: IUpdatePRPromptOpts) => {
  const { config, client } = await getBaseData()
  if (!config.useGitCLI) {
    const stillUseAPI = await getBooleanPrompt('你确认继续使用 API 来同步 PR 吗，可能会导致追加无用 commit')
    if (!stillUseAPI) {
      logger.log('请通过以下命令开启 git CLI 模式：aoko-pr config -s useGitCLI=true')
      process.exit(0)
    }
  }
  const owner = UPSTREAM_OWNER
  const repo = REPO_NAME
  logger.log(`正在为 “PR${Number(opts.id) ? `#${opts.id}` : ''}” 同步最新的改动。。。`)
  let pr: TReturnType<typeof selectPRPrompt>
  if (config.useGitCLI) {
    pr = Number(opts.id) ? await getPRPrompt(Number(opts.id)) : await selectPRPrompt()
    shell.exec(`git checkout -f -B ${pr.head.ref}`, { cwd: process.cwd() })
    shell.exec('git fetch upstream', { cwd: process.cwd() })
    shell.exec('git merge upstream/master', { cwd: process.cwd() })
    shell.exec(`git push --set-upstream origin ${pr.head.ref}`, {
      cwd: process.cwd(),
    })
    pr = await getPRPrompt(pr.number)
  } else {
    pr = Number(opts.id) ? await getPRPrompt(Number(opts.id)) : await selectPRPrompt()
    const master = await getUpstreamMasterPrompt()
    logger.log('同步提交中。。。')
    const newBranchName = `${pr.head.label.split(':')?.[1] || `PR#${pr.number}`}-temp-sync-branch-${Math.random()
      .toString(16)
      .substr(2)}`
    const newBranch = await createRefPrompt(master.object.sha, newBranchName)
    logger.log('合并分支中。。。')
    await client.repos.merge({
      owner: config.username || '',
      repo,
      base: pr.head.ref,
      head: newBranch.object.sha,
      commit_message: 'auto sync upstream master commits',
    })
    logger.success('合并分支成功')
    await deleteBranchPrompt({ name: newBranchName })
    pr = await getPRPrompt(pr.number)
  }
  logger.success('提交同步成功')
  let versionChanged = false
  if (opts.version) {
    versionChanged = await updateVersionPrompt(pr, opts)
  }
  const commits = await getPRCommitsPrompt(pr.number, pr.commits)
  const groupedCommits: { [login: string]: string[] } = {}
  commits.forEach((v) => {
    const login = v.author?.login as string
    if (!groupedCommits[login]) {
      groupedCommits[login] = []
    }
    groupedCommits[login].push(v.commit.message.split(/[\r\n]+/)[0])
  })
  const commitUsers = Object.keys(groupedCommits)
  const oldReviewers = (pr.requested_reviewers || []).map((v) => v?.login).filter((v) => v) as string[]
  const diffReviewers = oldReviewers
    .reduce(
      (x, y) => {
        const index = x.indexOf(y)
        if (index > -1) {
          x.splice(index, 1)
        }
        return x
      },
      [...commitUsers]
    )
    .filter((v) => v !== pr?.user?.login)
  if (diffReviewers.length) {
    logger.log('同步 reviewer 中。。。')
    await client.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pr.number,
      reviewers: diffReviewers,
    })
    logger.success('reviewer 同步成功')
  }
  logger.log('更新 PR 信息中。。。')
  const baseBodyDataMap: ITableRowDataMap = {}
  Object.keys(groupedCommits).forEach((name) => {
    groupedCommits[name].forEach((title, i) => {
      const baseBodyData = {
        name,
        title,
        showName: i === 0,
        uatChecked: false,
        prodChecked: false,
      }
      if (!baseBodyDataMap[name]) {
        baseBodyDataMap[name] = []
      }
      baseBodyDataMap[name].push(baseBodyData)
    })
  })
  const titleMatch = /^(.*)(\s\().*(\))$/.exec(pr.title)
  const titleSuffix = opts.version && versionChanged ? ` (v${opts.version})` : ''
  const newTitle = titleMatch?.[1] && versionChanged ? `${titleMatch[1]}${titleSuffix}` : `${pr.title}${titleSuffix}`
  logger.debug('old PR body:\n', pr.body)
  const newBody = await parseTemplate(baseBodyDataMap, pr.body)
  logger.debug('new PR body:\n', newBody)
  await client.pulls.update({
    owner,
    repo,
    pull_number: pr.number,
    body: newBody,
    title: opts.title || newTitle,
  })
  logger.success('PR 信息更新成功')
  logger.success(`“PR#${pr.number}: ${opts.title || newTitle}” 同步成功`)
  logger.info(`PR: ${pr.html_url}`)
}

interface ICreatePRPromptOpts {
  name: string
  branch?: string
  ls?: boolean
  version?: string
}

export const createPRPrompt = async (opts: ICreatePRPromptOpts) => {
  const { config, client } = await getBaseData()
  const repo = REPO_NAME
  const owner = config.username || ''
  let branchName = opts.branch || `PR-${day().format('YYYY-MM-DD')}`
  if (!opts.branch && !opts.ls) {
    if (config.useGitCLI) {
      shell.exec('git fetch upstream', { cwd: process.cwd() })
      shell.exec(`git checkout -f -B ${branchName} upstream/master`, {
        cwd: process.cwd(),
      })
      shell.exec(`git push -u origin ${branchName}`, { cwd: process.cwd() })
    } else {
      const masterRef = await getUpstreamMasterPrompt()
      await createRefPrompt(masterRef.object.sha, branchName)
    }
  } else {
    if (opts.ls) {
      branchName = await searchBranchPrompt()
    }
    if (!branchName) {
      logger.error('请给出一个分支的名字')
      process.exit(1)
    }
    logger.log(`查询分支 "${branchName}" 中。。。`)
    await client.repos.getBranch({
      branch: branchName,
      repo,
      owner,
    })
  }
  logger.log(`创建上线 PR "${branchName}" 中。。。`)
  const createPR = await client.pulls.create({
    repo,
    owner: UPSTREAM_OWNER,
    title: opts.name,
    head: `${config.username}:${branchName}`,
    base: 'stable',
  })
  logger.success(`上线 PR "${opts.name}" 创建成功`)
  updatePRPrompt({ id: createPR.data.number, version: opts.version })
}

interface IGetRecentPRPromptOpts {
  since?: string
  type: 'created' | 'updated'
  until?: string
  date?: boolean
  format?: boolean
  reverse?: boolean
}

const GET_ACTIVITY_SEARCH_TIME_REG = /^[\d]{4}-[\d]{2}-[\d]{2}$/

interface IRecentPR {
  repo: string
  status: string
  title: string
  create: string | null
  url: string
}

interface IRecentPRMap {
  [repo: string]: {
    [status: string]: IRecentPR[]
  }
}

const ACTIVITY_REPO = [
  'audio-chatroom',
  'mimi-web',
  'missevan-mobile',
  'missevan-standalone',
  'missevan-web',
  'requirements-doc',
  'web-utils',
]

const getDateBySortType = (type: IGetRecentPRPromptOpts['type'], data: any) =>
  type === 'created' ? data.created_at : data.updated_at

export const getRecentPRPrompt = async (opts: IGetRecentPRPromptOpts) => {
  const { config, client } = await getBaseData()
  if (opts.since && !GET_ACTIVITY_SEARCH_TIME_REG.test(opts.since)) {
    logger.error(`since 的格式应该为 YYYY-MM-DD(${opts.since})`)
    process.exit(1)
  }
  if (opts.until && !GET_ACTIVITY_SEARCH_TIME_REG.test(opts.until)) {
    logger.error(`until 的格式应该为 YYYY-MM-DD(${opts.until})`)
    process.exit(1)
  }
  const sinceDate = opts.since ? day(opts.since) : null
  const untilDate = opts.until ? day(opts.until) : null
  logger.log(
    `查询最近的活动中${((opts.since || opts.until) && `(${opts.since || '--'} to ${opts.until || '--'})`) || ''}。。。`
  )
  const activities: IRecentPR[] = []
  // eslint-disable-next-line no-restricted-syntax
  for (const repo of ACTIVITY_REPO) {
    let notEnd = !!opts.since
    let page = 1
    do {
      // eslint-disable-next-line no-await-in-loop
      const { data } = await client.pulls.list({
        owner: UPSTREAM_OWNER,
        repo,
        state: 'all',
        page: page++,
        sort: opts.type,
        direction: 'desc',
      })
      const lastData = data[data.length - 1]
      if (!lastData || (sinceDate && sinceDate.isAfter(day(getDateBySortType(opts.type, lastData) as string)))) {
        notEnd = false
      }
      data
        .filter(
          (v) =>
            v.user?.login === (config.username || '') &&
            (untilDate ? !day(getDateBySortType(opts.type, v)).isAfter(untilDate) : true) &&
            (sinceDate ? !sinceDate.isAfter(day(getDateBySortType(opts.type, v))) : true)
        )
        .forEach((v) => {
          const item = {
            repo,
            status: v.state,
            title: v.title,
            create: v.created_at,
            url: v.html_url,
          }
          activities.push(item)
        })
    } while (notEnd)
  }
  const result: IRecentPRMap = {}
  activities.forEach((v) => {
    const firstKey = opts.reverse ? v.status : v.repo
    const secondKey = opts.reverse ? v.repo : v.status
    if (!result[firstKey]) {
      result[firstKey] = {}
    }
    if (!result[firstKey][secondKey]) {
      result[firstKey][secondKey] = []
    }
    result[firstKey][secondKey].push(v)
  })
  if (!opts.format) {
    logger.log(JSON.stringify(result))
  } else {
    let md = ''
    Object.keys(result).forEach((firstKey) => {
      md += `- ${firstKey}\n`
      Object.keys(result[firstKey]).forEach((secondKey) => {
        md += `    - ${secondKey}\n`
        result[firstKey][secondKey].forEach((v) => {
          md += `        - [${v.title}${(opts.date && v.create && day(v.create).format('YYYY-MM-DD')) || ''}](${
            v.url
          })\n`
        })
      })
    })
    logger.log(md)
  }
}
