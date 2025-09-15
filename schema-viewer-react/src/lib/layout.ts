export type LayoutEnv = {
  getContainerTop(): number
  queryRows(): NodeListOf<HTMLTableRowElement>
  queryTableByType(type: string): HTMLElement | null
  getScale(): number
  queryAllTables(): NodeListOf<HTMLElement>
}

const rowKey = (p: string, f: string) => `${p}::${f}`

export function alignTablesByDepth(layers: string[][], edges: { parent: string; field: string; child: string }[], env: LayoutEnv, occEdges?: { parentInstance: string; field: string; childInstance: string; depth: number }[]) {
  const containerTop = env.getContainerTop()
  const tableCache = new Map<string, HTMLElement>()
  const scale = env.getScale()
  const occByChild = new Map<string, { parentInstance: string; field: string; depth: number }>()
  ;(occEdges || []).forEach((e) => occByChild.set(e.childInstance, { parentInstance: e.parentInstance, field: e.field, depth: e.depth }))

  // helper
  const parentRowTop = new Map<string, number>()
  const measureParentRows = () => {
    const rows = env.queryRows()
    for (const tr of Array.from(rows)) {
      const field = tr.dataset.field || ''
      const pi = tr.getAttribute('data-parent-instance') || ''
      const pt = tr.getAttribute('data-parent') || ''
      // 인스턴스 기준 키
      if (pi && field) parentRowTop.set(`${pi}::${field}`, tr.getBoundingClientRect().top - containerTop)
      // 타입 기준 키: 인스턴스가 아닌 행에서만 측정하여 덮어쓰지 않음
      if (!pi && pt && field) parentRowTop.set(`${pt}::${field}`, tr.getBoundingClientRect().top - containerTop)
    }
  }
  measureParentRows()

  const getTable = (key: string) => {
    if (tableCache.has(key)) return tableCache.get(key)!
    const inst = Array.from(env.queryAllTables()).find((el) => el.getAttribute('data-instance') === key)
    if (inst) { tableCache.set(key, inst as HTMLElement); return inst as HTMLElement }
    const byType = env.queryTableByType(key)
    if (byType) tableCache.set(key, byType)
    return byType
  }

  const isInstance = Array.isArray(layers) && layers.some((arr) => Array.isArray(arr) && arr.some((id) => occByChild.has(String(id))))

  for (let depth = 1; depth < layers.length; depth++) {
    const idsAtDepth = layers[depth]
    const desired = new Map<string, number>()
    if (isInstance) {
      for (const id of idsAtDepth) {
        const occ = occByChild.get(String(id))
        if (!occ) continue
        const t = parentRowTop.get(`${occ.parentInstance}::${occ.field}`)
        if (t == null) continue
        desired.set(String(id), t)
      }
    } else {
      edges.forEach(({ parent, field, child }) => {
        if (!idsAtDepth.includes(child)) return
        const t = parentRowTop.get(`${parent}::${field}`)
        if (t == null) return
        desired.set(child, Math.max(desired.get(child) ?? 0, t))
      })
    }

    idsAtDepth
      .filter((t) => desired.has(String(t)))
      .sort((a, b) => (desired.get(String(a))! - desired.get(String(b))!))
      .forEach((key) => {
        const k = String(key)
        const table = getTable(k)
        if (!table) return
        const tableTop = table.getBoundingClientRect().top - containerTop
        const delta = desired.get(k)! - tableTop
        if (delta > 0) {
          const currentMargin = parseFloat(getComputedStyle(table).marginTop) || 0
          const cssDelta = delta / (scale || 1)
          table.style.marginTop = `${currentMargin + cssDelta}px`
        }
      })
  }
}

export function collectDescendants(edges: { parent: string; child: string }[], root: string): Set<string> {
  const adj = new Map<string, Set<string>>()
  edges.forEach(({ parent, child }) => {
    if (!adj.has(parent)) adj.set(parent, new Set())
    adj.get(parent)!.add(child)
  })
  const out = new Set<string>()
  const q = [root]
  while (q.length) {
    const cur = q.shift()!
    const kids = adj.get(cur)
    if (!kids) continue
    kids.forEach((k) => {
      if (!out.has(k)) {
        out.add(k)
        q.push(k)
      }
    })
  }
  return out
}

export function siblingFlowStack(layers: string[][], edges: { parent: string; child: string }[], env: LayoutEnv, occEdges?: { parentInstance: string; field: string; childInstance: string; depth: number }[]) {
  const containerTop = env.getContainerTop()
  const scale = env.getScale()
  let changed = false
  const queryTable = (key: string) => {
    const inst = Array.from(env.queryAllTables()).find((el) => el.getAttribute('data-instance') === key)
    if (inst) return inst as HTMLElement
    return env.queryTableByType(key)
  }
  const isInstance = Array.isArray(layers) && layers.some((arr) => Array.isArray(arr) && arr.some((id) => String(id).includes('.')))
  const occChildren = new Map<string, Set<string>>()
  ;(occEdges || []).forEach(({ parentInstance, childInstance }) => {
    if (!occChildren.has(parentInstance)) occChildren.set(parentInstance, new Set())
    occChildren.get(parentInstance)!.add(childInstance)
  })
  const collectOccDescendants = (root: string) => {
    const out = new Set<string>()
    const q = [root]
    while (q.length) {
      const cur = q.shift()!
      const kids = occChildren.get(cur)
      if (!kids) continue
      kids.forEach((k) => {
        if (!out.has(k)) {
          out.add(k)
          q.push(k)
        }
      })
    }
    return out
  }
  // 부모 행의 화면상 top 측정: 정렬 순서를 부모 행 순서에 맞추기 위함
  const parentRowTop = new Map<string, number>() // key: `${parentInstance}::${field}`
  const rows = env.queryRows()
  for (const tr of Array.from(rows)) {
    const field = tr.dataset.field || ''
    const pi = tr.getAttribute('data-parent-instance') || ''
    const pt = tr.getAttribute('data-parent') || ''
    if (pi && field) parentRowTop.set(`${pi}::${field}`, tr.getBoundingClientRect().top - containerTop)
    if (!pi && pt && field) parentRowTop.set(`${pt}::${field}`, tr.getBoundingClientRect().top - containerTop)
  }
  const occByChild = new Map<string, { parentInstance: string; field: string }>()
  ;(occEdges || []).forEach(({ parentInstance, field, childInstance }) => {
    occByChild.set(childInstance, { parentInstance, field })
  })

  const measureTop = (t: string) => {
    const el = queryTable(t)
    if (!el) return null
    return el.getBoundingClientRect().top - containerTop
  }
  const measureBottom = (t: string) => {
    const el = queryTable(t)
    if (!el) return null
    return el.getBoundingClientRect().bottom - containerTop
  }

  for (let depth = 1; depth < layers.length; depth++) {
    let ids = layers[depth]
    // 인스턴스 뷰에서는 같은 깊이의 형제 인스턴스들을 부모 행의 top 순서로 정렬
    if (isInstance) {
      ids = [...ids].sort((a, b) => {
        const oa = occByChild.get(String(a))
        const ob = occByChild.get(String(b))
        const ta = oa ? (parentRowTop.get(`${oa.parentInstance}::${oa.field}`) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
        const tb = ob ? (parentRowTop.get(`${ob.parentInstance}::${ob.field}`) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
        if (ta !== tb) return ta - tb
        // fallback: 현재 테이블의 top
        const ma = measureTop(String(a)) ?? 0
        const mb = measureTop(String(b)) ?? 0
        return ma - mb
      }) as any
    }
    for (let i = 0; i < ids.length - 1; i++) {
      const a = String(ids[i])
      const b = String(ids[i + 1])
      const desc = isInstance ? collectOccDescendants(a) : collectDescendants(edges, a)
      let bottom = measureBottom(a) ?? 0
      ;(desc as any as Set<string>).forEach((t: string) => {
        const bt = measureBottom(t)
        if (bt != null) bottom = Math.max(bottom, bt)
      })
      const topB = measureTop(b)
      if (topB == null) continue
      const minGap = 4 // ensure a small vertical gap
      const delta = (bottom + minGap) - topB
      if (delta > 0) {
        const tableB = queryTable(b)!
        const currentMargin = parseFloat(getComputedStyle(tableB).marginTop) || 0
        const cssDelta = delta / (scale || 1)
        tableB.style.marginTop = `${currentMargin + cssDelta}px`
        changed = true
      }
    }

    // Strict enforcement pass: ensure each sibling sits (a) below all previous siblings' deepest descendant
    // and (b) aligned to its parent row top when space allows.
    if (isInstance) {
      let requiredTop = -Infinity
      for (let i = 0; i < ids.length; i++) {
        const cur = String(ids[i])
        if (!cur.includes('.')) continue
        const oc = occByChild.get(cur)
        const parentKey = oc ? `${oc.parentInstance}::${oc.field}` : null
        const parentTopTarget = parentKey ? (parentRowTop.get(parentKey) ?? null) : null
        const curTop = measureTop(cur)
        const minGap = 4
        // desired top is the maximum of (a) stacking requirement and (b) parent row's top (if known)
        const desired = Math.max(
          isFinite(requiredTop) ? (requiredTop + minGap) : -Infinity,
          parentTopTarget ?? -Infinity,
        )
        if (curTop != null && isFinite(desired)) {
          const need = desired - curTop
          if (Math.abs(need) > 0.5) {
            const table = queryTable(cur)!
            const currentMargin = parseFloat(getComputedStyle(table).marginTop) || 0
            const cssDelta = need / (scale || 1)
            table.style.marginTop = `${currentMargin + cssDelta}px`
            changed = true
          }
        }
        let bottomCur = measureBottom(cur) ?? 0
        collectOccDescendants(cur).forEach((d) => { const bt = measureBottom(d); if (bt != null) bottomCur = Math.max(bottomCur, bt) })
        requiredTop = Math.max(requiredTop, bottomCur)
      }
    }
  }
  return changed
}

export function runLayoutStabilize(layers: string[][], edges: { parent: string; field: string; child: string }[], env: LayoutEnv, occEdges?: { parentInstance: string; field: string; childInstance: string; depth: number }[]) {
  // 기존 API 유지: 단일 타겟 정렬
  env.queryAllTables().forEach((el) => (el.style.marginTop = '0px'))
  for (let i = 0; i < 5; i++) {
    alignTablesByDepth(layers, edges, env, occEdges)
    const changed = siblingFlowStack(layers, edges, env, occEdges)
    if (!changed) break
  }
  alignTablesByDepth(layers, edges, env, occEdges)
  // Hard enforcement: fix any remaining stacking violations deterministically
  try {
    const minGap = 4
    const allTables = () => Array.from(env.queryAllTables())
    const top = (key: string) => {
      const el = allTables().find((e) => e.getAttribute('data-instance') === key)
      return el ? (el as HTMLElement).getBoundingClientRect().top - env.getContainerTop() : null
    }
    const bottom = (key: string) => {
      const el = allTables().find((e) => e.getAttribute('data-instance') === key)
      return el ? (el as HTMLElement).getBoundingClientRect().bottom - env.getContainerTop() : null
    }
    const occChildren = new Map<string, Set<string>>()
    ;(occEdges || []).forEach(({ parentInstance, childInstance }) => {
      if (!occChildren.has(parentInstance)) occChildren.set(parentInstance, new Set())
      occChildren.get(parentInstance)!.add(childInstance)
    })
    const collectOccDescendants = (root: string) => {
      const out = new Set<string>()
      const q = [root]
      while (q.length) {
        const cur = q.shift()!
        const kids = occChildren.get(cur)
        if (!kids) continue
        kids.forEach((k) => { if (!out.has(k)) { out.add(k); q.push(k) } })
      }
      return out
    }
    for (let pass = 0; pass < 6; pass++) {
      let fixed = false
      for (let depth = 1; depth < layers.length; depth++) {
        const ids = layers[depth] || []
        for (let i = 0; i < ids.length - 1; i++) {
          const a = String(ids[i])
          const b = String(ids[i + 1])
          if (!a.includes('.') || !b.includes('.')) continue
          let maxBottom = bottom(a) ?? 0
          collectOccDescendants(a).forEach((d) => { const bt = bottom(d); if (bt != null) maxBottom = Math.max(maxBottom, bt!) })
          const topB = top(b)
          if (topB != null && topB <= maxBottom + minGap) {
            const elB = allTables().find((e) => e.getAttribute('data-instance') === b) as HTMLElement | undefined
            if (elB) {
              const currentMargin = parseFloat(getComputedStyle(elB).marginTop) || 0
              const cssDelta = ((maxBottom + minGap) - topB) / (env.getScale() || 1)
              elB.style.marginTop = `${currentMargin + cssDelta}px`
              fixed = true
            }
          }
        }
      }
      if (!fixed) break
    }
  } catch {}
  // end hard enforcement
  try {
    const dbg = (typeof window !== 'undefined') && ((window as any).__layoutDebug || localStorage.getItem('layoutDebug') === '1')
    if (dbg && occEdges && Array.isArray(layers) && layers.some(arr => Array.isArray(arr) && arr.some(id => String(id).includes('.')))) {
      // Simple runtime invariant check: ensure sibling stacking respects deepest descendant
      const occChildren = new Map<string, Set<string>>()
      ;(occEdges || []).forEach(({ parentInstance, childInstance }) => {
        if (!occChildren.has(parentInstance)) occChildren.set(parentInstance, new Set())
        occChildren.get(parentInstance)!.add(childInstance)
      })
      const collectOccDescendants = (root: string) => {
        const out = new Set<string>()
        const q = [root]
        while (q.length) {
          const cur = q.shift()!
          const kids = occChildren.get(cur)
          if (!kids) continue
          kids.forEach((k) => { if (!out.has(k)) { out.add(k); q.push(k) } })
        }
        return out
      }
      const top = (id: string) => {
        const inst = Array.from(env.queryAllTables()).find((el) => el.getAttribute('data-instance') === id)
        if (!inst) return null
        return (inst as HTMLElement).getBoundingClientRect().top - env.getContainerTop()
      }
      const bottom = (id: string) => {
        const inst = Array.from(env.queryAllTables()).find((el) => el.getAttribute('data-instance') === id)
        if (!inst) return null
        return (inst as HTMLElement).getBoundingClientRect().bottom - env.getContainerTop()
      }
      const issues: any[] = []
      for (let depth = 1; depth < layers.length; depth++) {
        const ids = layers[depth] || []
        for (let i = 0; i < ids.length - 1; i++) {
          const a = String(ids[i])
          const b = String(ids[i + 1])
          if (!a.includes('.') || !b.includes('.')) continue
          let maxBottom = bottom(a) ?? 0
          collectOccDescendants(a).forEach((d) => { const bt = bottom(d); if (bt != null) maxBottom = Math.max(maxBottom, bt!) })
          const topB = top(b)
          if (topB != null && topB <= maxBottom) issues.push({ a, b, maxBottom, topB })
        }
      }
      if (issues.length) console.error('[layoutDebug] stacking violations:', issues)
    }
  } catch {}
}

export function runLayoutStabilizeMulti(targets: { layers: string[][]; edges: { parent: string; field: string; child: string }[]; occEdges?: { parentInstance: string; field: string; childInstance: string; depth: number }[] }[], env: LayoutEnv) {
  // 여러 타겟(타입/인스턴스) 레이어를 한 프레임에서 함께 정렬
  env.queryAllTables().forEach((el) => (el.style.marginTop = '0px'))
  for (let i = 0; i < 5; i++) {
    for (const t of targets) {
      alignTablesByDepth(t.layers, t.edges, env, t.occEdges)
    }
    let anyChanged = false
    for (const t of targets) {
      const changed = siblingFlowStack(t.layers, t.edges, env, t.occEdges)
      anyChanged = anyChanged || changed
    }
    if (!anyChanged) break
  }
  // 마지막으로 각 타겟에 대해 부모-자식 정렬을 한 번 더 수행
  for (const t of targets) alignTablesByDepth(t.layers, t.edges, env, t.occEdges)
}
