export interface IConfigFile {
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

export type TPromiseType<P> = P extends Promise<infer U> ? U : P
export type TArrayType<T> = T extends Array<infer U> ? U : T
export type TReturnType<T extends (...args: any) => any> = TPromiseType<ReturnType<T>>
