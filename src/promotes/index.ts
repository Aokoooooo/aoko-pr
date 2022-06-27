import day from 'dayjs'
import shell from 'shelljs'
import { logger } from '../logger'
import { TableDataMap, parseTemplate } from '../template/audio-chatroom'
import { ConfigFile, TReturnType } from '../types'
import {
  INIT_CONFIG,
  REPO_NAME,
  UPSTREAM_OWNER,
  formatToJSONString,
  getConfigFile,
  getConfigFilePath,
  mergeConfigFile,
  writeConfigFile,
} from '../utils'
import {
  createRefPrompt,
  deleteBranchPrompt,
  getBaseData,
  getBooleanPrompt,
  getPRCommitsPrompt,
  getPRPrompt,
  getUpstreamMasterPrompt,
  IUpdatePRPromptOpts,
  searchBranchPrompt,
  selectPRPrompt,
  updateVersionPrompt,
} from './utils'

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
  const baseBodyDataMap: TableDataMap = {}
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
