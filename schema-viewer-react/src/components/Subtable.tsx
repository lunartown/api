import { Field } from '../lib/parser'
import React from 'react'

export function Subtable({
  typeName,
  fields,
  collapsedKeys,
  onToggle,
  useInstanceKeys = false,
  debug = false,
  editMode = false,
  onFieldChange,
  onAddField,
  onDeleteField,
  onAddObjectField,
  onSaveTable,
  onEditTable,
  onReorderField,
  instanceId,
}: {
  typeName: string
  fields: Field[]
  collapsedKeys: Set<string>
  onToggle: (parent: string, field: string, child?: string, parentInstance?: string) => void
  useInstanceKeys?: boolean
  debug?: boolean
  editMode?: boolean
  onFieldChange?: (typeName: string, fieldName: string, patch: Partial<{ name: string; type: string; optional: boolean; required: boolean; description: string }>) => void
  onAddField?: (typeName: string) => void
  onDeleteField?: (typeName: string, fieldName: string) => void
  onAddObjectField?: (typeName: string) => void
  onSaveTable?: (typeName: string) => void
  onEditTable?: (typeName: string) => void
  onReorderField?: (typeName: string, from: string, to: string, pos: 'before'|'after') => void
  instanceId?: string
}) {
  const draggingRef = React.useRef(false)
  const placeholderRef = React.useRef<HTMLTableRowElement|null>(null)
  const dragHeightRef = React.useRef<number>(32)
  const dropTargetFieldRef = React.useRef<string | null>(null)
  const dropPosRef = React.useRef<'before'|'after'>('after')
  
  const removePlaceholder = () => {
    const ph = placeholderRef.current
    if (ph && ph.parentElement) ph.parentElement.removeChild(ph)
    placeholderRef.current = null
  }

  const insertPlaceholder = (targetRow: HTMLTableRowElement, pos: 'before'|'after') => {
    let ph = placeholderRef.current
    const tbody = targetRow.parentElement as HTMLTableSectionElement
    if (!ph) {
      ph = document.createElement('tr')
      ph.className = 'drop-placeholder'
      const cols = (targetRow.children?.length || 1)
      const td = document.createElement('td')
      td.setAttribute('colspan', String(cols))
      ph.appendChild(td)
      placeholderRef.current = ph
    }
    const td = ph.firstElementChild as HTMLTableCellElement
    td.style.height = `${dragHeightRef.current}px`
    if (pos === 'before') {
      tbody.insertBefore(ph, targetRow)
    } else {
      if (targetRow.nextSibling) tbody.insertBefore(ph, targetRow.nextSibling)
      else tbody.appendChild(ph)
    }
  }
  return (
    <div className="subtable" data-type={typeName} data-instance={instanceId || ''}>
      <div className="subtable-head">
        <span>{typeName} {debug && (
          <small className="dim" style={{ marginLeft: 6 }}>
            {instanceId ? `(${instanceId})` : ''}
          </small>
        )}</span>
        <span className="head-actions">
          {!editMode ? (
            <button className="tiny" onClick={() => onEditTable?.(typeName)}>편집</button>
          ) : (
            <>
              <button className="tiny" onClick={() => onAddField?.(typeName)}>+ 필드</button>
              <button className="tiny" onClick={() => onAddObjectField?.(typeName)}>+ 객체</button>
              <button className="tiny primary" onClick={() => onSaveTable?.(typeName)}>저장</button>
            </>
          )}
        </span>
      </div>
      <table>
        <colgroup>
          <col style={{ width: '28px' }} />
          <col style={{ width: '20ch' }} />
          <col style={{ width: '12ch' }} />
          <col style={{ width: '11ch' }} />
          <col style={{ width: '64ch' }} />
          <col style={{ width: '44px' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="left-col"></th>
            <th>name</th>
            <th>type</th>
            <th>required</th>
            <th>description</th>
            <th className="fold-col"></th>
          </tr>
        </thead>
        <tbody
          onDragOver={(e) => {
            if (!editMode) return
            // allow drop even when hovering placeholder
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(e) => {
            if (!editMode) return
            e.preventDefault()
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'))
              const target = dropTargetFieldRef.current
              const pos = dropPosRef.current
              if (data && target && data.field && data.field !== target) {
                onReorderField?.(typeName, data.field, target, pos)
              }
            } catch {}
            removePlaceholder()
          }}
        >
          {fields.map((f) => {
            const instCandidate = `${instanceId ? instanceId : typeName}.${f.name}`
            const key = useInstanceKeys ? instCandidate : `${typeName}::${f.name}`
            const hasChild = !!f.child
            const isCollapsed = hasChild && collapsedKeys.has(key)
            return (
              <tr
                key={f.name}
                data-parent={typeName}
                data-parent-instance={instanceId || ''}
                data-field={f.name}
                data-child={f.child || ''}
                draggable={editMode}
                onDragStart={(e) => {
                  if (!editMode) return
                  draggingRef.current = true
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  dragHeightRef.current = rect.height
                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: typeName, field: f.name }))
                  e.currentTarget.classList.add('dragging')
                }}
                onDragEnd={(e) => {
                  if (!editMode) return
                  draggingRef.current = false
                  e.currentTarget.classList.remove('dragging')
                  removePlaceholder()
                }}
                onDragOver={(e) => {
                  if (!editMode) return
                  e.preventDefault()
                  const row = e.currentTarget as HTMLTableRowElement
                  const rect = row.getBoundingClientRect()
                  const pos: 'before'|'after' = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after'
                  dropTargetFieldRef.current = f.name
                  dropPosRef.current = pos
                  insertPlaceholder(row, pos)
                }}
                onDragLeave={(e) => {
                  if (!editMode) return
                  // placeholder는 유지하여 타겟 이동 시 자연스러움 확보
                }}
                onDrop={(e) => {
                  if (!editMode) return
                  e.preventDefault()
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                    if (!data || data.type !== typeName) return
                    const row = e.currentTarget as HTMLTableRowElement
                    const rect = row.getBoundingClientRect()
                    const pos: 'before'|'after' = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after'
                    if (data.field && data.field !== f.name) {
                      onReorderField?.(typeName, data.field, f.name, pos)
                    }
                  } catch {}
                  removePlaceholder()
                }}
                className={hasChild ? (isCollapsed ? 'row collapsible collapsed' : 'row collapsible') : 'row'}
                onMouseEnter={() => {
                  if (!hasChild || !f.child) return
                  const el = document.querySelector(`.subtable[data-type="${f.child}"]`) as HTMLElement | null
                  el?.classList.add('highlight')
                }}
                onMouseLeave={() => {
                  if (!hasChild || !f.child) return
                  const el = document.querySelector(`.subtable[data-type="${f.child}"]`) as HTMLElement | null
                  el?.classList.remove('highlight')
                }}
                onClick={(e) => {
                  if (draggingRef.current) return
                  if (!hasChild) return
                  // 버튼 외 영역 클릭으로도 토글 허용
                  onToggle(typeName, f.name, f.child, useInstanceKeys ? instCandidate : undefined)
                }}
              >
              <td className="left-col">
                <div className="left-col-box">
                  {editMode && (
                    <button
                      type="button"
                      className="del-btn"
                      aria-label="필드 삭제"
                      title="삭제"
                      onClick={(e) => {
                        e.stopPropagation()
                        const ok = window.confirm(`정말 삭제할까요?\n${typeName}.${f.name}`)
                        if (ok) onDeleteField?.(typeName, f.name)
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </td>
              <td>
                {editMode ? (
                  <input
                    className="cell-input"
                    defaultValue={f.name}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => onFieldChange?.(typeName, f.name, { name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                  />
                ) : (
                  <span>{f.name}</span>
                )}
              </td>
              <td>
                {editMode ? (
                  <input
                    className="cell-input mono"
                    defaultValue={f.editorType ?? f.type}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => onFieldChange?.(typeName, f.name, { type: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                  />
                ) : (
                  <span className="type">{f.type}</span>
                )}
              </td>
              <td>
                {editMode ? (
                  <label className="opt-toggle" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!f.optional}
                      onChange={(e) => onFieldChange?.(typeName, f.name, { required: e.target.checked })}
                    />
                    <span>{!f.optional ? 'true' : 'false'}</span>
                  </label>
                ) : (
                  <span className={'badge ' + (!f.optional ? 'good' : 'bad')}>{!f.optional ? 'true' : 'false'}</span>
                )}
              </td>
              <td>
                {editMode ? (
                  <input
                    className="cell-input"
                    defaultValue={f.description || ''}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => onFieldChange?.(typeName, f.name, { description: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                  />
                ) : (
                  f.description || ''
                )}
              </td>
              <td className="fold-col">
                <div className="fold-col-content">
                  {hasChild ? (
                    <button
                      type="button"
                      className="disclosure"
                      aria-expanded={!isCollapsed}
                      onMouseDown={(e) => { e.preventDefault() }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggle(typeName, f.name, f.child, useInstanceKeys ? instCandidate : undefined)
                    }}
                      title={isCollapsed ? '펼치기' : '접기'}
                    >
                      <span className="caret45" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
      {/* 하단 액션 영역 제거: 모두 헤더 우측으로 이동 */}
    </div>
  )
}
