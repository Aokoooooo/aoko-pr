import commander from 'commander'
import pkg from '../package.json'
import {
  authPrompt,
  checkPrompt,
  configPrompt,
  createPRPrompt,
  deleteBranchPrompt,
  getRecentPRPrompt,
  updatePRPrompt,
} from './promotes'

commander.version(pkg.version)

commander
  .command('auth')
  .description('认证 Github personal access token (https://github.com/settings/tokens, 需要给出全部的 repo 权限)')
  .option('-t, --token <token>', 'personal access token')
  .option('-l, --ls', '选择历史认证成功过的 token 认证')
  .option('--rm', '清除某条认证历史')
  .action((opts) => authPrompt(opts, true))

commander
  .command('create')
  .alias('c')
  .description('创建上线 PR')
  .option('-n, --name <name>', 'PR 的名字', 'frontend: 将 master 最新提交合并至 stable 分支')
  .option('-b, --branch [branch]', '分支的名字')
  .option('-l, --ls', '选择某个分支来创建 PR')
  // eslint-disable-next-line no-useless-escape
  .option('-v, --version <version>', '/^(\d+\.)*\d$/')
  .action(createPRPrompt)

commander
  .command('update')
  .alias('u')
  .description('更新上线 PR')
  .option('-i, --id <id>', 'PR ID')
  .option('-t, --title <title>', 'PR title')
  // eslint-disable-next-line no-useless-escape
  .option('-v, --version <version>', '/^(\d+\.)*\d$/')
  .action(updatePRPrompt)

commander
  .command('check')
  .description('更新 PR 描述 table 中的单条数据（验证测试结果或修改备注）')
  .option('-i, --id <id>', 'PR ID')
  .option('-a, --author <author>', 'commit author')
  .option('-c, --commit <commit>', 'commit msg')
  .option('-u, --uat [uat]', 'UAT check。true or false，不传代表一会儿自行选择)')
  .option('-p, --prod [prod]', 'PROD check。true or false，不传代表一会儿自行选择')
  .option('-m, --msg [msg]', '备注信息')
  .action(checkPrompt)

commander
  .command('delete-branch')
  .alias('db')
  .description('删除分支')
  .option('-n, --name <name>', '分支名称')
  .action(deleteBranchPrompt)

commander
  .command('recent-pr')
  .alias('rp')
  .description('查看最近创建的 PR')
  .option('-s, --since <since>', '查询的起点时间（YYYY-MM-DD）')
  .option('-u, --until <until>', '查询的结束时间（YYYY-MM-DD）')
  .option('-f, --format', '格式化为 md')
  .option('-d, --date', 'format 时数据结果包含时间（默认只有标题）')
  .option('-r, --reverse', '按照【是否完成】来聚合（默认按照【仓库】聚合）')
  .action(getRecentPRPrompt)

commander
  .command('config')
  .description('查看或者修改配置信息')
  .option('-g, --get <name>', '查看某一条配置信息')
  .option('-s, --set <data>', '修改某一条配置信息（set name=value）')
  .option('-l, --list', '查看所有配置信息的 key')
  .option('-r, --reset', '初始化配置信息')
  .action(configPrompt)

commander.parse(process.argv)
