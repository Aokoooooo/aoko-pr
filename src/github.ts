import { Octokit } from '@octokit/rest'

let client: Octokit
export const getClient = () => client
export const updateClientByToken = (token: string) => {
  client = new Octokit({ auth: token })
  return client
}
