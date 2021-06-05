import { tidy } from 'htmltidy2'
import { DOMWindow, JSDOM } from 'jsdom'
import { logger } from './logger'
import { escapeHtml } from './utils'

export enum ETableRowType {
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
const CHECKED_MARK = '✔️'

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
    header: 'UAT 测试通过',
    render: (v) => (v.uatChecked ? CHECKED_MARK : ''),
    field: 'uatChecked',
  },
  {
    class: ETableRowType.Prod,
    header: '线上测试通过',
    render: (v) => (v.prodChecked ? CHECKED_MARK : ''),
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

const formatHTML = async (html: string) => new Promise<string>((resolve, reject) => {
  tidy(html, { 'indent': true, 'show-body-only': 'yes' }, (e, r) => {
    if (e) {
      reject(e)
    }
    resolve(r)
  })
})

const formatDOMToString = async (dom: JSDOM) => {
  const result = await formatHTML(dom.serialize())
  return result
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
        result = !!value
      }
      (data as any)[v.field] = result
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
    const currentName
      = row.getElementsByClassName(ETableRowType.Name)?.[0]?.innerHTML?.trim?.() ?? ''
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
      if (msgDOM && data.msg) {
        msgDOM.innerHTML = data.msg
      }
      const uatDOM = targetCommits[i].getElementsByClassName(ETableRowType.Uat)?.[0]
      if (uatDOM && typeof data.uatChecked === 'boolean') {
        uatDOM.innerHTML = data.uatChecked ? CHECKED_MARK : ''
      }
      const prodDOM = targetCommits[i].getElementsByClassName(ETableRowType.Prod)?.[0]
      if (prodDOM && typeof data.prodChecked === 'boolean') {
        prodDOM.innerHTML = data.prodChecked ? CHECKED_MARK : ''
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
      logger.error('解析历史 PR body 失败，请确认 PR body 存在且符合解析规则')
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
          if (escapeHtml(list[i].title) === v.title) {
            list[i] = { ...list[i], ...v, name: list[i].name }
          }
        }
      })
    })
  }
  const table = await createTemplate(data as ITableRowDataMap, true)
  tableBody.outerHTML = table
  return formatDOMToString(DOM)
}
