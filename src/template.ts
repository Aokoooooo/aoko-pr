import { DOMWindow, JSDOM } from 'jsdom'
import prettier from 'prettier'
import { logger } from './logger'
import { escapeHtml } from './utils'

enum ETableRowType {
  Name = 'name',
  Title = 'title',
  Uat = 'uat',
  Prod = 'prod',
  Msg = 'msg',
}

export interface ITableRowData {
  name: string
  title: string
  uatChecked: boolean
  prodChecked: boolean
  msg?: string
  showName: boolean
}

export interface ITableRowDataMap {
  [name: string]: ITableRowData[]
}

const TABLE_BODY_ID = 'PR-body-table-body'

const renderCheckbox = (checked: boolean) => {
  const box = `- ${checked ? '[x]' : '[ ]'} OK`
  return `\n\n${box}\n\n`
}

interface IDataTemplateData {
  class: ETableRowType
  header: string
  render: (data: ITableRowData) => string
  field: keyof ITableRowData
}

const DATA_TEMPLATE: IDataTemplateData[] = [
  {
    class: ETableRowType.Name,
    header: 'author',
    render: (v) => (v.showName ? `@${v.name}` : ''),
    field: 'name',
  },
  {
    class: ETableRowType.Title,
    header: '更新内容',
    render: (v) => v.title,
    field: 'title',
  },
  {
    class: ETableRowType.Uat,
    header: 'UAT 测试',
    render: (v) => renderCheckbox(v.uatChecked),
    field: 'uatChecked',
  },
  {
    class: ETableRowType.Prod,
    header: '线上测试',
    render: (v) => renderCheckbox(v.prodChecked),
    field: 'prodChecked',
  },
  {
    class: ETableRowType.Msg,
    header: '备注',
    render: (v) => v.msg || '',
    field: 'msg',
  },
]

// eslint-disable-next-line max-len
const createElement = (window: DOMWindow, name: keyof HTMLElementTagNameMap) => window.document.createElement(name)

const createTableRow = (window: DOMWindow, data: ITableRowData) => {
  const tr = createElement(window, 'tr')

  DATA_TEMPLATE.forEach((v) => {
    const dom = createElement(window, 'td')
    dom.className = v.class
    dom.innerHTML = v.render(data)
    tr.appendChild(dom)
  })

  return tr
}

const createTableHeader = (window: DOMWindow) => {
  const thead = createElement(window, 'thead')

  DATA_TEMPLATE.forEach((v) => {
    const dom = createElement(window, 'th')
    dom.className = v.class
    dom.innerHTML = v.header
    thead.appendChild(dom)
  })

  return thead
}

const formatDOMToString = async (dom: JSDOM) => {
  const result = prettier.format(dom.serialize(), {
    parser: 'html',
    printWidth: Number.MAX_SAFE_INTEGER,
    tabWidth: 0,
  })
  return result.replace(/(-\s\[[x\s]\]\sOK)/g, '\r\n\r\n  $1\r\n\r\n').replace(/(<\/tr>)/g, '$1\r\n\r\n')
}

const createTemplate = async (data: ITableRowDataMap, outputTableBodyDOM: boolean) => {
  const DOM = new JSDOM()
  const table = createElement(DOM.window, 'table')
  table.appendChild(createTableHeader(DOM.window))
  const tableBody = createElement(DOM.window, 'tbody')
  tableBody.id = TABLE_BODY_ID
  // eslint-disable-next-line max-len
  Object.values(data).forEach((list) => list.forEach((v) => tableBody.appendChild(createTableRow(DOM.window, v))))
  if (outputTableBodyDOM) {
    return tableBody.outerHTML
  }
  table.appendChild(tableBody)
  DOM.window.document.body.appendChild(table)
  const result = await formatDOMToString(DOM)
  return result
}

const BOOL_VALUE_TH = [ETableRowType.Uat, ETableRowType.Prod]

const parseTableRow = (dom: HTMLElement) => {
  const map: { [name: string]: ITableRowData[] } = {}
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
    const data: Partial<ITableRowData> = {}
    // eslint-disable-next-line no-loop-func
    DATA_TEMPLATE.forEach((v) => {
      const value = row.getElementsByClassName(v.class)?.[0]?.innerHTML?.trim?.() ?? ''
      let result: string | boolean = value
      if (v.class === ETableRowType.Name) {
        if (value) {
          lastName = value
        }
        result = lastName
      } else if (BOOL_VALUE_TH.includes(v.class)) {
        result = /- \[x\]/.test(value)
      }
      ;(data as any)[v.field] = result
    })
    if (!map[(data as ITableRowData).name]) {
      map[(data as ITableRowData).name] = []
    }
    map[(data as ITableRowData).name].push(data as ITableRowData)
  }
  return map
}

const updatePRDesc = (dom: HTMLElement, data: ITableRowData) => {
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
    const currentName = row.getElementsByClassName(ETableRowType.Name)?.[0]?.innerHTML?.trim?.() ?? ''
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
    const titleDOM = targetCommits[i].getElementsByClassName(ETableRowType.Title)?.[0]
    if (titleDOM && escapeHtml(titleDOM.innerHTML.trim()) === escapeHtml(data.title)) {
      const msgDOM = targetCommits[i].getElementsByClassName(ETableRowType.Msg)?.[0]
      if (typeof data.msg !== 'undefined' && msgDOM) {
        msgDOM.innerHTML = data.msg || ''
      }
      const uatDOM = targetCommits[i].getElementsByClassName(ETableRowType.Uat)?.[0]
      if (typeof data.uatChecked !== 'undefined' && uatDOM) {
        uatDOM.innerHTML = renderCheckbox(data.uatChecked)
      }
      const prodDOM = targetCommits[i].getElementsByClassName(ETableRowType.Prod)?.[0]
      if (typeof data.prodChecked !== 'undefined' && prodDOM) {
        prodDOM.innerHTML = renderCheckbox(data.prodChecked)
      }
      return true
    }
  }
  return false
}

export const parseTemplate = async (
  data: ITableRowDataMap | ITableRowData,
  body: string | null,
  isUpdateTableRow?: boolean
) => {
  if (!body) {
    if (isUpdateTableRow) {
      logger.error('历史 PR body 为空，请确认 PR body 存在')
      process.exit(1)
    }
    return createTemplate(data as ITableRowDataMap, false)
  }
  const DOM = new JSDOM(body)
  const container = DOM.window.document.body
  const tableBody = DOM.window.document.getElementById(TABLE_BODY_ID)
  if (!container || !tableBody) {
    if (isUpdateTableRow) {
      logger.error('解析历史 PR body 失败，请确认 PR body 存在且符合解析规则')
      process.exit(1)
    }
    return createTemplate(data as ITableRowDataMap, false)
  }
  if (isUpdateTableRow) {
    const updated = updatePRDesc(tableBody, data as ITableRowData)
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
      const list = (data as ITableRowDataMap)[name.substr(1)]
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
  const table = await createTemplate(data as ITableRowDataMap, true)
  tableBody.outerHTML = table
  return formatDOMToString(DOM)
}
