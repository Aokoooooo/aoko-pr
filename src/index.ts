import commander from 'commander'
import pkg from '../package.json'
import { authPrompt } from './promotes'

commander.version(pkg.version)

commander
  .command('auth')
  .option('-t, --token <token>', 'personal access token')
  .description('认证 Github personal access token')
  .action(((opts) => {
    authPrompt(opts.token)
  }))
console.log('fuck')
commander.parse(process.argv)
