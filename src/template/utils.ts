import { DOMWindow, JSDOM } from 'jsdom'
import prettier from 'prettier'

export interface TableConfigItem<TableData = Record<string, unknown>> {
  class: string
  header: string
  render: (data: TableData) => string
  field: keyof TableData
}

export const renderCheckbox = (checked: boolean) => {
  const box = `- ${checked ? '[x]' : '[ ]'} OK`
  return `\n\n${box}\n\n`
}

export const createElement = (window: DOMWindow, name: keyof HTMLElementTagNameMap) =>
  window.document.createElement(name)

export const createHeader = (window: DOMWindow, info: string) => {
  const title = createElement(window, 'h2')
  title.innerHTML = info
  window.document.body.appendChild(title)
}

export const createTableHeader = <TableData = Record<string, unknown>>(
  window: DOMWindow,
  configs: TableConfigItem<TableData>[]
) => {
  const thead = createElement(window, 'thead')

  configs.forEach((v) => {
    const dom = createElement(window, 'th')
    dom.className = v.class
    dom.innerHTML = v.header
    thead.appendChild(dom)
  })

  return thead
}

export const createTableRow = <TableData = Record<string, unknown>>(
  window: DOMWindow,
  configs: TableConfigItem<TableData>[],
  data: TableData
) => {
  const tr = createElement(window, 'tr')

  configs.forEach((v) => {
    const dom = createElement(window, 'td')
    dom.className = v.class
    dom.innerHTML = v.render(data)
    tr.appendChild(dom)
  })

  return tr
}

export const formatDOMToString = async (dom: JSDOM) => {
  const result = prettier.format(dom.serialize(), {
    parser: 'html',
    printWidth: Number.MAX_SAFE_INTEGER,
    tabWidth: 0,
  })
  return result.replace(/(-\s\[[x\s]\]\sOK)/g, '\r\n\r\n  $1\r\n\r\n').replace(/(<\/tr>)/g, '$1\r\n\r\n')
}
