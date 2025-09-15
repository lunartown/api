import React, { useMemo, useState } from 'react'
import { buildRegistry } from './lib/parser'
import { Columns } from './components/Columns'
import { Canvas } from './components/Canvas'
import { Entry } from './lib/parser'

const SAMPLE = {
  title: 'User',
  type: 'object',
  required: ['id', 'orders'],
  properties: {
    id: { type: 'string', description: '식별자' },
    profile: { $ref: '#/$defs/Profile', description: '사용자 프로필' },
    settings: { $ref: '#/$defs/Settings', description: '설정' },
    orders: { type: 'array', items: { $ref: '#/$defs/Order' }, description: '주문 목록' },
  },
  $defs: {
    Profile: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: '이름' }, age: { type: 'integer', description: '나이' }, contact: { $ref: '#/$defs/Contact', description: '연락처 정보' }, role: { type: 'string', enum: ['admin', 'user', 'guest'], description: '역할' } } },
    Contact: { type: 'object', properties: { email: { type: 'string', description: '이메일' }, phone: { oneOf: [{ type: 'string' }, { type: 'integer' }], description: '전화번호' } } },
    Settings: { type: 'object', properties: { theme: { type: 'string', description: '테마 이름' }, preferences: { $ref: '#/$defs/Preferences', description: '사용자 선호' } } },
    Preferences: { type: 'object', properties: { notifications: { type: 'boolean', description: '알림 사용' }, language: { type: 'string', description: '언어' } } },
    Order: { type: 'object', required: ['orderId', 'items'], properties: { orderId: { type: 'string', description: '주문 ID' }, items: { type: 'array', items: { $ref: '#/$defs/Item' }, description: '주문 품목' } } },
    Item: { type: 'object', required: ['sku', 'qty'], properties: { sku: { type: 'string', description: '상품 코드' }, qty: { type: 'integer', description: '수량' }, tags: { type: 'array', items: { enum: ['hot', 'new', 'sale'] }, description: '태그' }, dimensions: { type: 'array', items: [{ type: 'number' }, { type: 'number' }, { type: 'number' }], description: 'W,H,D (tuple)' }, meta: { $ref: '#/$defs/Meta', description: '추가 정보' } } },
    Meta: { type: 'object', properties: { color: { type: 'string', enum: ['red', 'green', 'blue'], description: '색상' }, notes: { type: 'string', description: '메모' } } },
  },
}

type Mode = 'edit' | 'view'

export default function App() {
  const [mode, setMode] = useState<Mode>('edit')
  const [inputText, setInputText] = useState(JSON.stringify(SAMPLE, null, 2))
  const [schema, setSchema] = useState<any | null>(SAMPLE)
  const [debug, setDebug] = useState<boolean>(() => {
    try { return localStorage.getItem('layoutDebug') === '1' } catch { return false }
  })

  const model = useMemo(() => (schema ? buildRegistry(schema) : null), [schema])
  const [history, setHistory] = useState<any[]>([])
  const [redo, setRedo] = useState<any[]>([])
  const [editTables, setEditTables] = useState<Set<string>>(new Set())
  const [toolbarOpen, setToolbarOpen] = useState<boolean>(true)
  const pendingBatchRef = React.useRef<boolean>(false)
  const batchTimerRef = React.useRef<any>(null)
  const [verifyStatus, setVerifyStatus] = useState<any | null>(null)

  const beginBatchIfNeeded = () => {
    if (!pendingBatchRef.current) {
      setHistory((h) => [...h, schema])
      setRedo([])
      pendingBatchRef.current = true
    }
    if (batchTimerRef.current) window.clearTimeout(batchTimerRef.current)
    batchTimerRef.current = window.setTimeout(() => {
      pendingBatchRef.current = false
    }, 1000)
  }

  const handleRender = () => {
    try {
      const parsed = JSON.parse(inputText)
      setSchema(parsed)
      setMode('view')
    } catch (e: any) {
      alert('JSON 파싱 오류: ' + e.message)
    }
  }

  const runSelfCheck = async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
    const qRow = (p: string, f: string) => document.querySelector(`tbody tr.row.collapsible[data-parent="${p}"][data-field="${f}"]`) as HTMLTableRowElement | null
    const qInst = (id: string) => Array.from(document.querySelectorAll('.subtable')).find((e) => (e as HTMLElement).dataset.instance === id) as HTMLElement | undefined
    const clickDisclosure = (row: HTMLTableRowElement | null) => row?.querySelector('button.disclosure')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const top = (el?: Element | null) => el ? (el as HTMLElement).getBoundingClientRect().top : null
    const bottom = (el?: Element | null) => el ? (el as HTMLElement).getBoundingClientRect().bottom : null

    try {
      // ensure in view mode
      if (mode !== 'view') {
        handleRender()
        await nextFrame()
        await wait(50)
      }

      // Expand User.profile
      clickDisclosure(qRow('User', 'profile'))
      await nextFrame(); await wait(50)
      // Expand Profile.contact
      clickDisclosure(qRow('Profile', 'contact'))
      await nextFrame(); await wait(50)
      // Expand User.settings
      clickDisclosure(qRow('User', 'settings'))
      await nextFrame(); await wait(50)

      const instContact = qInst('User.profile.contact')
      const instSettings = qInst('User.settings')
      const contactBottom = bottom(instContact)
      const settingsTop = top(instSettings)
      const stackingOK = (contactBottom != null && settingsTop != null) ? (settingsTop > contactBottom + 1) : false

      // Collapse User.profile and confirm descendants disappear
      clickDisclosure(qRow('User', 'profile'))
      await nextFrame(); await wait(50)
      const descendants = Array.from(document.querySelectorAll('.subtable')).filter((e) => (e as HTMLElement).dataset.instance?.startsWith('User.profile'))
      const collapseOK = descendants.length === 0

      const summary = `SelfCheck\nstackingOK: ${stackingOK}\ncollapseOK: ${collapseOK}\ncontactBottom: ${contactBottom}\nsettingsTop: ${settingsTop}`
      console.log('[SelfCheck]', { stackingOK, collapseOK, contactBottom, settingsTop })
      alert(summary)
    } catch (err: any) {
      console.error('[SelfCheck] error', err)
      alert('SelfCheck error: ' + (err?.message || String(err)))
    }
  }

  React.useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch('/verify-status.json', { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          if (!stop) setVerifyStatus(json)
        }
      } catch {}
      if (!stop) setTimeout(tick, 3000)
    }
    tick()
    return () => { stop = true }
  }, [])

  return (
    <main className="container">
      {/* 헤더 설명 제거 */}

      {mode === 'edit' && (
        <section className="panel">
          <div className="controls">
            <div className="control grow">
              <label>JSON Schema 붙여넣기</label>
              <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} />
            </div>
          </div>
          <div className="actions">
            <button onClick={() => setInputText(JSON.stringify(SAMPLE, null, 2))}>샘플 로드</button>
            <button className="primary" onClick={handleRender}>렌더</button>
          </div>
        </section>
      )}

      {mode === 'view' && model && (
        <>
          <div className={"floating-toolbar" + (toolbarOpen ? ' open' : '')}>
            <button className="toolbar-toggle" aria-expanded={toolbarOpen} onClick={() => setToolbarOpen(!toolbarOpen)} aria-label="메뉴">
              <span className="hamburger"><i></i><i></i><i></i></span>
            </button>
            <div className="toolbar-panel">
              <button onClick={() => {
                try {
                  setInputText(JSON.stringify(schema, null, 2))
                } catch {}
                setMode('edit')
              }}>편집으로</button>
              <button onClick={() => {
                if (history.length === 0) return
                const prev = history[history.length - 1]
                setHistory(history.slice(0, -1))
                setRedo([schema, ...redo])
                setSchema(prev)
              }}>Undo</button>
              <button onClick={() => {
                if (redo.length === 0) return
                const next = redo[0]
                setRedo(redo.slice(1))
                setHistory([...history, schema])
                setSchema(next)
              }}>Redo</button>
              <button onClick={() => {
                const text = JSON.stringify(schema, null, 2)
                navigator.clipboard?.writeText(text)
                alert('JSON Schema가 클립보드에 복사되었습니다.')
              }}>Export 복사</button>
              <button onClick={() => runSelfCheck()}>Self Check</button>
              <button onClick={() => {
                const next = !debug
                setDebug(next)
                try { localStorage.setItem('layoutDebug', next ? '1' : '0') } catch {}
                alert('Layout debug ' + (next ? 'ON' : 'OFF'))
              }}>Debug {debug ? 'ON' : 'OFF'}</button>
              {verifyStatus && (
                <span className="small" style={{ paddingLeft: 8 }}>
                  Verify: {verifyStatus.ok ? 'PASS' : 'FAIL'}
                  {verifyStatus.tests ? ` (${verifyStatus.tests.passed}/${verifyStatus.tests.total})` : ''}
                </span>
              )}
            </div>
          </div>
          <Canvas scrollable initialScale={1}>
            {(scale) => (
              <Columns
                reg={model.reg}
                layers={model.layers}
                edges={model.edges}
                occEdges={model.occEdges}
                occLayers={model.occLayers}
                scale={scale}
                editTables={editTables}
                debug={debug}
                onFieldChange={(typeName, fieldName, patch) => {
                  beginBatchIfNeeded()
                  const snap = JSON.parse(JSON.stringify(schema))
                  const m = buildRegistry(snap)
                  const entry = m.reg.get(typeName) as Entry
                  if (!entry) return
                  entry.schema.properties = entry.schema.properties || {}
                  const props = entry.schema.properties
                  const prop = props[fieldName] || {}
                  // name 변경은 키 이동
                  if (patch.name && patch.name !== fieldName) {
                    if (props[patch.name]) { alert('동일한 이름의 필드가 이미 존재합니다.'); return }
                    props[patch.name] = prop
                    delete props[fieldName]
                    fieldName = patch.name
                  }
                  if (patch.type != null) {
                    const t = patch.type.trim()
                    const PRIMS = new Set(['string','integer','number','boolean','object','array','null'])
                    const makeInline = (name: string) => ({ type: 'object', properties: {}, 'x-inline-name': name })
                    const getKind = (p: any): string => {
                      if (p && p.$ref) return 'ref'
                      if (p && p.type === 'array') {
                        const it = p.items || {}
                        if (it.$ref) return 'array-ref'
                        if (it.type) return 'array-prim'
                        return 'array-inline'
                      }
                      if (p && p.type) {
                        if (PRIMS.has(p.type)) return 'prim'
                        return 'inline'
                      }
                      return 'unknown'
                    }
                    const nextKindFrom = (spec: string): string => {
                      if (spec.endsWith('[]')) {
                        const inner = spec.slice(0, -2).trim()
                        if (inner.startsWith('@')) return 'array-ref'
                        if (PRIMS.has(inner)) return 'array-prim'
                        return 'array-inline'
                      }
                      if (spec.startsWith('@')) return 'ref'
                      if (PRIMS.has(spec)) return 'prim'
                      return 'inline'
                    }
                    const prevKind = getKind(prop)
                    const nextKind = nextKindFrom(t)

                    // 참조 리네임은 입력창에서 '@NewName'을 직접 쓰거나 별도 명령으로 처리하도록 제한합니다.
                    // 인라인 이름 변경: inline → inline (라벨만 변경)
                    if (prevKind === 'inline' && nextKind === 'inline' && !t.startsWith('@') && !PRIMS.has(t)) {
                      (prop as any)['x-inline-name'] = t
                      setSchema(snap)
                      return
                    }
                    if (prevKind === 'array-inline' && t.endsWith('[]')) {
                      const inner = t.slice(0, -2).trim()
                      if (!inner.startsWith('@') && !PRIMS.has(inner)) {
                        const it = prop.items || {}
                        it['x-inline-name'] = inner
                        prop.items = it
                        setSchema(snap)
                        return
                      }
                    }

                    // 모드가 바뀌더라도 onBlur 커밋에서 조용히 처리 (경고창 제거)
                    if (t.endsWith('[]')) {
                      const innerRaw = t.slice(0, -2).trim()
                      delete (prop as any).$ref
                      prop.type = 'array'
                      if (innerRaw.startsWith('@')) {
                        const refName = innerRaw.slice(1)
                        prop.items = { $ref: `#/$defs/${refName}` }
                      } else if (PRIMS.has(innerRaw)) {
                        prop.items = { type: innerRaw }
                      } else {
                        prop.items = makeInline(innerRaw)
                      }
                    } else {
                      if (t.startsWith('@')) {
                        // 명시적 참조
                        delete (prop as any).type; delete (prop as any).items
                        prop.$ref = `#/$defs/${t.slice(1)}`
                      } else if (PRIMS.has(t)) {
                        // 프리미티브
                        delete (prop as any).$ref; delete (prop as any).items
                        prop.type = t
                      } else {
                        // 명시적 참조가 아니고, 프리미티브도 아니면 인라인 오브젝트로 취급
                        delete (prop as any).$ref; delete (prop as any).items
                        Object.assign(prop, makeInline(t))
                      }
                    }
                  }
                  if (patch.description != null) prop.description = patch.description
                  // required 토글 우선 처리 (없으면 optional 호환)
                  if (patch.required != null) {
                    const req: string[] = Array.isArray(entry.schema.required) ? [...entry.schema.required] : []
                    const idx = req.indexOf(fieldName)
                    if (patch.required && idx < 0) req.push(fieldName)
                    if (!patch.required && idx >= 0) req.splice(idx, 1)
                    if (req.length > 0) entry.schema.required = req
                    else delete entry.schema.required
                  } else if (patch.optional != null) {
                    const req: string[] = Array.isArray(entry.schema.required) ? [...entry.schema.required] : []
                    const idx = req.indexOf(fieldName)
                    if (patch.optional && idx >= 0) req.splice(idx, 1)
                    if (!patch.optional && idx < 0) req.push(fieldName)
                    if (req.length > 0) entry.schema.required = req
                    else delete entry.schema.required
                  }
                  props[fieldName] = prop
                  setSchema(snap)
                }}
                onAddField={(typeName) => {
                  beginBatchIfNeeded()
                  const snap = JSON.parse(JSON.stringify(schema))
                  const m = buildRegistry(snap)
                  const entry = m.reg.get(typeName) as Entry
                  if (!entry) return
                  entry.schema.properties = entry.schema.properties || {}
                  const props = entry.schema.properties
                  let base = 'field'
                  let n = 1
                  while (props[`${base}${n}`]) n++
                  props[`${base}${n}`] = { type: 'string', description: '' }
                  setSchema(snap)
                }}
                onDeleteField={(typeName, fieldName) => {
                  beginBatchIfNeeded()
                  const snap = JSON.parse(JSON.stringify(schema))
                  const m = buildRegistry(snap)
                  const entry = m.reg.get(typeName) as Entry
                  if (!entry) return
                  const props = entry.schema.properties || {}
                  delete props[fieldName]
                  entry.schema.properties = props
                  const req: string[] = Array.isArray(entry.schema.required) ? entry.schema.required.filter((x: string) => x !== fieldName) : []
                  if (req.length > 0) entry.schema.required = req
                  else delete entry.schema.required
                  setSchema(snap)
                }}
                onAddObjectField={(typeName) => {
                  beginBatchIfNeeded()
                  const snap = JSON.parse(JSON.stringify(schema))
                  const m = buildRegistry(snap)
                  const entry = m.reg.get(typeName) as Entry
                  if (!entry) return
                  entry.schema.properties = entry.schema.properties || {}
                  const props = entry.schema.properties
                  let base = 'object'
                  let n = 1
                  while (props[`${base}${n}`]) n++
                  props[`${base}${n}`] = { type: 'object', properties: {}, description: '' }
                  setSchema(snap)
                }}
                onSaveTable={(typeName) => {
                  // 체크포인트 저장: 현재 상태를 이력으로 남김 + 해당 테이블 편집 종료
                  setHistory((h) => [...h, schema])
                  setRedo([])
                  setEditTables((s) => {
                    const next = new Set(s)
                    next.delete(typeName)
                    return next
                  })
                }}
                onEditTable={(typeName) => {
                  setEditTables((s) => new Set(s).add(typeName))
                }}
                onReorderField={(typeName, from, to, pos) => {
                  beginBatchIfNeeded()
                  const snap = JSON.parse(JSON.stringify(schema))
                  const m = buildRegistry(snap)
                  const entry = m.reg.get(typeName) as Entry
                  if (!entry) return
                  const props = entry.schema.properties || {}
                  let entries = Object.keys(props).map((k) => [k, props[k]] as [string, any])
                  const fromIdx0 = entries.findIndex(([k]) => k === from)
                  if (fromIdx0 < 0) return
                  const [moved] = entries.splice(fromIdx0, 1)
                  const toIdx1 = entries.findIndex(([k]) => k === to)
                  if (toIdx1 < 0) return
                  const insertIdx = pos === 'after' ? toIdx1 + 1 : toIdx1
                  entries.splice(insertIdx, 0, moved)
                  const newProps: any = {}
                  for (const [k, v] of entries) newProps[k] = v
                  entry.schema.properties = newProps
                  setSchema(snap)
                }}
              />
            )}
          </Canvas>
        </>
      )}

      {/* footer 제거 */}
    </main>
  )
}
