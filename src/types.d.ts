export interface IConfigFile {
  // github personal access token
  token?: string
  username?: string
  // 登录成功过的所有 token，token 之间用 , 分割
  tokenHistory?: string
  debug?: boolean
  debugRepo?: string
  debugUpstreamOwner?: string
}

export type TPromiseType<P> = P extends Promise<infer U> ? U : P
