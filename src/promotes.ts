import inquirer from 'inquirer'
import { authByToken } from './modules/auth'
import { getConfigFile } from './utils'

export const authPrompt = (token?: string) => {
  const _token = token || getConfigFile().githubToken
  if (!_token) {
    return inquirer
      .prompt({
        type: 'input',
        name: 'token',
        message:
          '请输入 bot 账号的 personal access token。可以通过这里查询 (https://github.com/settings/tokens)，或者通过这里创建 (https://github.com/settings/tokens/new)',
        validate: (v) => !!v,
      })
      .then((v) => authByToken(v.token))
  }
  return authByToken(_token)
}
