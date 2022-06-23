import { JSDOM } from 'jsdom'
import { logger } from '../logger'
import { escapeHtml } from '../utils'
import { createElement, createTableHeader, createTableRow, formatDOMToString, renderCheckbox, TableConfigItem } from './utils'

enum ETableDataItemType {
  Name = 'name',
  Title = 'title',
  Uat = 'uat',
  Prod = 'prod',
  Msg = 'msg',
}

export interface TableDataItem {
  name: string
  title: string
  uatChecked: boolean
  prodChecked: boolean
  msg?: string
  showName: boolean
}

export interface TableDataMap {
  [name: string]: TableDataItem[]
}

const PR_TABLE_BODY_ID = 'PR-table-body'
const COMPATIBILITY_TABPE_BODY_ID = 'compatibility-table-body'

const PR_TABLE_CONFIGS: TableConfigItem<TableDataItem>[] = [
  {
    class: ETableDataItemType.Name,
    header: 'author',
    render: (v) => (v.showName ? `@${v.name}` : ''),
    field: 'name',
  },
  {
    class: ETableDataItemType.Title,
    header: '更新内容',
    render: (v) => v.title,
    field: 'title',
  },
  {
    class: ETableDataItemType.Uat,
    header: 'UAT 测试',
    render: (v) => renderCheckbox(v.uatChecked),
    field: 'uatChecked',
  },
  {
    class: ETableDataItemType.Prod,
    header: '线上测试',
    render: (v) => renderCheckbox(v.prodChecked),
    field: 'prodChecked',
  },
  {
    class: ETableDataItemType.Msg,
    header: '备注',
    render: (v) => v.msg || '',
    field: 'msg',
  },
]



const createTemplate = async (data: TableDataMap, outputTableBodyDOM: boolean) => {
  const DOM = new JSDOM()
  const table = createElement(DOM.window, 'table')
  table.appendChild(createTableHeader(DOM.window, PR_TABLE_CONFIGS))
  const tableBody = createElement(DOM.window, 'tbody')
  tableBody.id = PR_TABLE_BODY_ID
  // eslint-disable-next-line max-len
  Object.values(data).forEach((list) => list.forEach((v) => tableBody.appendChild(createTableRow(DOM.window, PR_TABLE_CONFIGS, v))))
  if (outputTableBodyDOM) {
    return tableBody.outerHTML
  }
  table.appendChild(tableBody)
  DOM.window.document.body.appendChild(table)
  const result = await formatDOMToString(DOM)
  return result
}

const BOOL_VALUE_TH = [ETableDataItemType.Uat, ETableDataItemType.Prod]

const parseTableRow = (dom: HTMLElement) => {
  const map: { [name: string]: TableDataItem[] } = {}
  const rows = dom.getElementsByTagName('tr')
  if (!rows.length) {
    return null
  }
  let lastName = ''
  for (let i = 0; i < rows.length; i++) {
    const row = rows.item(i)
    if (!row) {
      // eslint-disable-next-line no-continue
      continue
    }
    const data: Partial<TableDataItem> = {}
    // eslint-disable-next-line no-loop-func
    PR_TABLE_CONFIGS.forEach((v) => {
      const value = row.getElementsByClassName(v.class)?.[0]?.innerHTML?.trim?.() ?? ''
      let result: string | boolean = value
      if (v.class === ETableDataItemType.Name) {
        if (value) {
          lastName = value
        }
        result = lastName
      } else if (BOOL_VALUE_TH.includes(v.class as ETableDataItemType)) {
        result = /- \[x\]/.test(value)
      }
      ;(data as any)[v.field] = result
    })
    if (!map[(data as TableDataItem).name]) {
      map[(data as TableDataItem).name] = []
    }
    map[(data as TableDataItem).name].push(data as TableDataItem)
  }
  return map
}

const updatePRDesc = (dom: HTMLElement, data: TableDataItem) => {
  const rows = dom.getElementsByTagName('tr')
  if (!rows.length) {
    return false
  }
  const rowMap: { [name: string]: HTMLTableRowElement[] } = {}
  let lastName = ''
  for (let i = 0; i < rows.length; i++) {
    const row = rows.item(i)
    if (!row) {
      // eslint-disable-next-line no-continue
      continue
    }
    const currentName = row.getElementsByClassName(ETableDataItemType.Name)?.[0]?.innerHTML?.trim?.() ?? ''
    if (currentName) {
      lastName = currentName
    }
    if (!rowMap[lastName]) {
      rowMap[lastName] = []
    }
    rowMap[lastName].push(row)
  }
  const targetCommits = rowMap[`@${data.name}`]
  if (!targetCommits) {
    return false
  }
  for (let i = 0; i < targetCommits.length; i++) {
    const titleDOM = targetCommits[i].getElementsByClassName(ETableDataItemType.Title)?.[0]
    if (titleDOM && escapeHtml(titleDOM.innerHTML.trim()) === escapeHtml(data.title)) {
      const msgDOM = targetCommits[i].getElementsByClassName(ETableDataItemType.Msg)?.[0]
      if (typeof data.msg !== 'undefined' && msgDOM) {
        msgDOM.innerHTML = data.msg || ''
      }
      const uatDOM = targetCommits[i].getElementsByClassName(ETableDataItemType.Uat)?.[0]
      if (typeof data.uatChecked !== 'undefined' && uatDOM) {
        uatDOM.innerHTML = renderCheckbox(data.uatChecked)
      }
      const prodDOM = targetCommits[i].getElementsByClassName(ETableDataItemType.Prod)?.[0]
      if (typeof data.prodChecked !== 'undefined' && prodDOM) {
        prodDOM.innerHTML = renderCheckbox(data.prodChecked)
      }
      return true
    }
  }
  return false
}

export const parseTemplate = async (
  data: TableDataMap | TableDataItem,
  body: string | null,
  isUpdateTableRow?: boolean
) => {
  if (!body) {
    if (isUpdateTableRow) {
      logger.error('历史 PR body 为空，请确认 PR body 存在')
      process.exit(1)
    }
    return createTemplate(data as TableDataMap, false)
  }
  const DOM = new JSDOM(body)
  const container = DOM.window.document.body
  const tableBody = DOM.window.document.getElementById(PR_TABLE_BODY_ID)
  if (!container || !tableBody) {
    if (isUpdateTableRow) {
      logger.error('解析历史 PR body 失败，请确认 PR body 存在且符合解析规则')
      process.exit(1)
    }
    return createTemplate(data as TableDataMap, false)
  }
  if (isUpdateTableRow) {
    const updated = updatePRDesc(tableBody, data as TableDataItem)
    if (!updated) {
      logger.error('未找到合适的更新对象，请确认 PR body 存在且符合解析规则')
      process.exit(1)
    }
    return formatDOMToString(DOM)
  }
  const oldData = parseTableRow(tableBody)
  logger.debug('oldData:\n', oldData)
  if (oldData) {
    Object.keys(oldData).forEach((name) => {
      // 去除 @
      const list = (data as TableDataMap)[name.substr(1)]
      if (!list) {
        return
      }
      const oldDataList = oldData[name]
      oldDataList.forEach((v) => {
        for (let i = 0; i < list.length; i++) {
          const reg = /\(#\d+\)$/
          const id1 = reg.exec(list[i].title)?.[0]
          const id2 = reg.exec(v.title)?.[0]
          if (id1 && id1 === id2) {
            list[i] = { ...list[i], ...v, name: list[i].name }
          }
        }
      })
    })
  }
  logger.debug('newData:\n', data)
  const table = await createTemplate(data as TableDataMap, true)
  tableBody.outerHTML = table
  return formatDOMToString(DOM)
}
