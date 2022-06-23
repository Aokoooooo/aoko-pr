import commander from 'commander'
import pkg from '../package.json'
import { authPrompt, configPrompt, createPRPrompt, deleteBranchPrompt, updatePRPrompt } from './promotes'

commander.version(pkg.version)

commander
  .command('auth')
  .description('认证 Github personal access token (https://github.com/settings/tokens, 需要给出全部的 repo 权限)')
  .option('-t, --token <token>', 'personal access token')
  .option('-l, --ls', '选择历史认证成功过的 token 认证')
  .option('--rm', '清除某条认证历史')
  .action((opts) => authPrompt(opts, true) as any)

commander
  .command('create')
  .alias('c')
  .description('创建上线 PR')
  .option('-n, --name <name>', 'PR 的名字', 'frontend: 将 master 最新提交合并至 stable 分支')
  .option('-b, --branch [branch]', '分支的名字')
  .option('-l, --ls', '选择某个分支来创建 PR')
  .option('-v, --version [version]', '不传具体的值（/^(d+.)*d$/），则自动加一')
  .action(createPRPrompt)

commander
  .command('update')
  .alias('u')
  .description('更新上线 PR')
  .option('-i, --id <id>', 'PR ID')
  .option('-t, --title <title>', 'PR title')
  .option('-v, --version [version]', '不传具体的值（/^(d+.)*d$/），则自动加一')
  .action(updatePRPrompt)

commander
  .command('delete-branch')
  .alias('db')
  .description('删除分支')
  .option('-n, --name <name>', '分支名称')
  .action(deleteBranchPrompt)

commander
  .command('config')
  .description('查看或者修改配置信息')
  .option('-g, --get <name>', '查看某一条配置信息')
  .option('-s, --set <data>', '修改某一条配置信息（set name=value）')
  .option('-l, --list', '查看所有配置信息的 key')
  .option('-r, --reset', '初始化配置信息')
  .action(configPrompt)

commander.parse(process.argv)
