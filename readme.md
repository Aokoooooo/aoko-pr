# aoko-pr
created by Aoko

## 简介

a cli for creating & updateing PRs to the stable branch

## 功能
**Using -h for more info**
- auth 认证 token
- create|a 创建 PR
- update|u 更新 PR
- check 更新 PR 描述 table 中的单条数据（验证测试结果或修改备注）
- delete-branch|db 删除分支
- recent-pr|rp 查看最近创建的 PR
- config 查看或更新配置

## 代理
通过 config -s proxy=xxx 来配置代理
支持 http, https, socks, socks5, socks4, pac 协议

## 使用本地 git CLI
通过 config -s useGitCLI=true
将能放到本地的操作（比如 fetch, rebase）交由 git cli 去执行
需要提前切换到项目对应的目录下
