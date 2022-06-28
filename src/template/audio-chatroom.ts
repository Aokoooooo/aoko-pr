import { JSDOM } from 'jsdom'
import { logger } from '../logger'
import {
  createElement,
  createHeader,
  createTableHeader,
  createTableRow,
  formatDOMToString,
  renderCheckbox,
  TableConfigItem,
} from './utils'

enum ETableDataItemType {
  Name = 'name',
  Title = 'title',
  Uat = 'uat',
  Prod = 'prod',
  Msg = 'msg',
}

interface TableDataItem {
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
const COMPATIBILITY_TABLE_BODY_ID = 'compatibility-table-body'

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

const COMPATIBILITY_TABLE_CONFIG: TableConfigItem<TableDataItem>[] = [
  {
    class: ETableDataItemType.Name,
    header: '目标',
    render: (v) => (v.showName ? v.name : ''),
    field: 'name',
  },
  {
    class: ETableDataItemType.Title,
    header: '环境',
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

const BOOL_VALUE_TH = [ETableDataItemType.Uat, ETableDataItemType.Prod]

const COMPATIBILITY_TEST_LIST = ['直播广场', '直播房间', '我的贵族', '我的等级', '贵族特权']
const COMPATIBILITY_TEST_ENV_LIST = ['Android 5', 'iOS 9', 'IE 11']

const generateCompatibilityTableData = () => {
  const map: TableDataMap = {}
  COMPATIBILITY_TEST_LIST.map((name) =>
    COMPATIBILITY_TEST_ENV_LIST.map((title, i) => ({
      name,
      title,
      uatChecked: false,
      prodChecked: false,
      msg: '',
      showName: i === 0,
    }))
  )
    .flat()
    .forEach((v) => {
      if (!map[v.name]) {
        map[v.name] = []
      }
      map[v.name].push(v)
    })
  return map
}

const createTemplate = async (
  prData: TableDataMap,
  compatibilityData: TableDataMap = generateCompatibilityTableData()
) => {
  const DOM = new JSDOM()

  const createTable = (data: TableDataMap, config: TableConfigItem<any>[], id: string) => {
    const table = createElement(DOM.window, 'table')
    table.appendChild(createTableHeader(DOM.window, config))
    const tableBody = createElement(DOM.window, 'tbody')
    tableBody.id = id
    Object.values(data).forEach((list) =>
      list.forEach((v) => tableBody.appendChild(createTableRow(DOM.window, config, v)))
    )
    table.appendChild(tableBody)
    DOM.window.document.body.appendChild(table)
  }

  createHeader(DOM.window, 'PR 更新内容')
  createTable(prData, PR_TABLE_CONFIGS, PR_TABLE_BODY_ID)
  createHeader(DOM.window, '环境兼容性测试')
  createTable(compatibilityData, COMPATIBILITY_TABLE_CONFIG, COMPATIBILITY_TABLE_BODY_ID)

  const result = await formatDOMToString(DOM)
  return result
}

const parsePRTableRow = <T extends TableDataItem | TableDataItem>(dom: HTMLElement, config: TableConfigItem<any>[]) => {
  const map: { [name: string]: T[] } = {}
  const rows = dom.getElementsByTagName('tr')
  if (!rows.length) {
    return null
  }
  let lastName = ''
  for (let i = 0; i < rows.length; i++) {
    const row = rows.item(i)
    if (!row) {
      continue
    }
    const data: Partial<T> = {}
    config.forEach((v) => {
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
    if (!map[(data as T).name]) {
      map[(data as T).name] = []
    }
    map[(data as T).name].push(data as T)
  }
  return map
}

export const parseTemplate = async (data: TableDataMap, body: string | null) => {
  if (!body) {
    return createTemplate(data)
  }
  const DOM = new JSDOM(body)
  const prTableBody = DOM.window.document.getElementById(PR_TABLE_BODY_ID)
  if (!prTableBody) {
    return createTemplate(data)
  }
  const oldPRData = parsePRTableRow(prTableBody, PR_TABLE_CONFIGS)
  logger.debug('oldPRData:\n', oldPRData)
  if (oldPRData) {
    Object.keys(oldPRData).forEach((name) => {
      // 去除 @
      const list = (data as TableDataMap)[name.substr(1)]
      if (!list) {
        return
      }
      const oldDataList = oldPRData[name]
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
  const defaultCompatibilityData = generateCompatibilityTableData()
  const oldCompatibilityBody = DOM.window.document.getElementById(COMPATIBILITY_TABLE_BODY_ID)
  if (oldCompatibilityBody) {
    const oldCompatibilityData = parsePRTableRow(oldCompatibilityBody, COMPATIBILITY_TABLE_CONFIG)
    if (oldCompatibilityData) {
      Object.keys(oldCompatibilityData).forEach((name) => {
        const list = defaultCompatibilityData[name]
        if (!list) {
          return
        }
        oldCompatibilityData[name].forEach((v) => {
          for (const i of list) {
            if (COMPATIBILITY_TEST_ENV_LIST.some((title) => i.title.startsWith(title) && v.title.startsWith(title))) {
              i.uatChecked = v.uatChecked
              i.prodChecked = v.prodChecked
              i.msg = v.msg
            }
          }
        })
      })
    }
  }
  logger.debug('newData:\n', data)
  return createTemplate(data, defaultCompatibilityData)
}
