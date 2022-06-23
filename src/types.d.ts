export interface ConfigFile {
  // github personal access token
  token?: string
  username?: string
  // 登录成功过的所有 token，token 之间用 , 分割
  tokenHistory?: string
  proxy?: string
  debug?: boolean
  debugRepo?: string
  debugUpstreamOwner?: string
  useGitCLI?: boolean
}

export type PromiseType<P> = P extends Promise<infer U> ? U : P
export type ArrayItem<T> = T extends Array<infer U> ? U : T
export type TReturnType<T extends (...args: any) => any> = PromiseType<ReturnType<T>>
