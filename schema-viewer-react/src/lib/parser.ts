export type Field = { name: string; type: string; optional: boolean; description: string; child?: string; editorType?: string }
export type Entry = { name: string; schema: any; fields: Field[] }
export type Layers = string[][]
export type Edge = { parent: string; field: string; child: string }
export type OccEdge = { parentType: string; parentInstance: string; field: string; childType: string; childInstance: string; depth: number }

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Type')
const singularize = (n: string) => (n.endsWith('ies') ? n.slice(0, -3) + 'y' : n.endsWith('s') ? n.slice(0, -1) : n)
const refTail = (ref: string) => {
  const parts = String(ref).split('/')
  return parts[parts.length - 1] || 'Unknown'
}

export function typeLabelFromSchema(p: any, fallbackName?: string): string {
  if (!p) return 'any'
  if (Array.isArray(p.enum) && p.enum.length > 0) {
    const vals = p.enum.map((v) => JSON.stringify(v)).join(' | ')
    return `enum(${vals})`
  }
  if (p.$ref) return refTail(p.$ref)
  const t = p.type
  if (t === 'array') {
    const it = p.items || {}
    if (Array.isArray(it)) return `[${it.map((x) => typeLabelFromSchema(x)).join(', ')}]`
    const inner = typeLabelFromSchema(it, fallbackName ? singularize(fallbackName) : undefined)
    return inner + '[]'
  }
  if (Array.isArray(p.oneOf) && p.oneOf.length) return 'oneOf<' + p.oneOf.map((x: any) => typeLabelFromSchema(x)).join(' | ') + '>'
  if (Array.isArray(p.anyOf) && p.anyOf.length) return 'anyOf<' + p.anyOf.map((x: any) => typeLabelFromSchema(x)).join(' | ') + '>'
  if (Array.isArray(p.allOf) && p.allOf.length) return 'allOf<' + p.allOf.map((x: any) => typeLabelFromSchema(x)).join(' & ') + '>'
  if (t === 'object' || p.properties) return p['x-inline-name'] || cap(fallbackName || p.title || 'Object')
  if (Array.isArray(t)) return t.join('|')
  return t || 'any'
}

export function editorTypeFromSchema(p: any, fallbackName?: string): string {
  if (!p) return 'any'
  if (p.$ref) return '@' + refTail(p.$ref)
  if (p.type === 'array') {
    const it = p.items || {}
    const inner = editorTypeFromSchema(it, fallbackName ? singularize(fallbackName) : undefined)
    return inner + '[]'
  }
  if (p.type === 'object' || p.properties) return p['x-inline-name'] || cap(fallbackName || p.title || 'Object')
  if (Array.isArray(p.enum) && p.enum.length > 0) return `enum(${p.enum.map((v: any) => JSON.stringify(v)).join(' | ')})`
  if (Array.isArray(p.oneOf) || Array.isArray(p.anyOf) || Array.isArray(p.allOf)) return typeLabelFromSchema(p, fallbackName)
  return p.type || 'any'
}

export function buildRegistry(rootSchema: any): { reg: Map<string, Entry>; layers: Layers; rootName: string; edges: Edge[]; occEdges: OccEdge[]; occLayers: string[][] } {
  const defs = rootSchema.$defs || rootSchema.definitions || {}
  const reg = new Map<string, Entry>()
  const edges: Edge[] = []
  const usedNames = new Set<string>(Object.keys(defs))
  const inlineNameMap = new WeakMap<any, string>()

  const ensureNamed = (name: string, schema: any) => {
    if (!reg.has(name)) reg.set(name, { name, schema, fields: [] })
    usedNames.add(name)
    return reg.get(name)!
  }

  for (const [name, schema] of Object.entries<any>(defs)) ensureNamed(name, schema)

  const rootName = cap(rootSchema.title || 'Root')
  ensureNamed(rootName, rootSchema)

  const toPascal = (s: string) => cap(String(s).replace(/[^a-zA-Z0-9]+/g, ''))
  const nameFromPath = (path: string[]) => path.map(toPascal).join('') || 'Object'
  const uniqueName = (base: string) => {
    let nm = base
    let i = 1
    while (usedNames.has(nm)) {
      nm = base + i
      i++
    }
    usedNames.add(nm)
    return nm
  }

  const queue: { name: string; schema: any; depth: number; path: string[] }[] = [
    { name: rootName, schema: rootSchema, depth: 0, path: [rootName] },
  ]
  const byDepth = new Map<number, Set<string>>()
  const occByDepth = new Map<number, string[]>()
  const occEdges: OccEdge[] = []
  const seenSchemas = new WeakSet<any>()

  while (queue.length) {
    const { name, schema, depth, path } = queue.shift()!
    if (seenSchemas.has(schema)) continue
    seenSchemas.add(schema)
    if (!byDepth.has(depth)) byDepth.set(depth, new Set())
    byDepth.get(depth)!.add(name)

    if (!schema || (schema.type !== 'object' && !schema.properties)) continue
    const entry = ensureNamed(name, schema)
    const required = new Set<string>(schema.required || [])
    const props = schema.properties || {}
    entry.fields = []

    for (const [propName, propSchema] of Object.entries<any>(props)) {
      const field: Field = {
        name: propName,
        type: typeLabelFromSchema(propSchema, propName),
        optional: !required.has(propName),
        description: propSchema.description || '',
        editorType: editorTypeFromSchema(propSchema, propName),
      }
      entry.fields.push(field)

      if (propSchema.$ref) {
        const refName = refTail(propSchema.$ref)
        const target = ensureNamed(refName, defs[refName] || {})
        field.child = target.name
        edges.push({ parent: name, field: propName, child: target.name })
        const childInstance = [...path, propName].join('.')
        const parentInstance = path.join('.')
        occEdges.push({ parentType: name, parentInstance, field: propName, childType: target.name, childInstance, depth: depth + 1 })
        if (!occByDepth.has(depth + 1)) occByDepth.set(depth + 1, [])
        occByDepth.get(depth + 1)!.push(childInstance)
        queue.push({ name: target.name, schema: target.schema, depth: depth + 1, path: [...path, propName] })
      } else if (propSchema.type === 'array') {
        const it = propSchema.items || {}
        if (it.$ref) {
          const itName = refTail(it.$ref)
          const target = ensureNamed(itName, defs[itName] || {})
          field.child = target.name
          edges.push({ parent: name, field: propName, child: target.name })
          const childInstance = [...path, propName].join('.')
          const parentInstance = path.join('.')
          occEdges.push({ parentType: name, parentInstance, field: propName, childType: target.name, childInstance, depth: depth + 1 })
          if (!occByDepth.has(depth + 1)) occByDepth.set(depth + 1, [])
          occByDepth.get(depth + 1)!.push(childInstance)
          queue.push({ name: target.name, schema: target.schema, depth: depth + 1, path: [...path, propName] })
        } else if (it.type === 'object' || it.properties) {
          // 퍼시스턴트 이름: 스키마에 x-inline-name이 있으면 우선 사용
          let nm = it['x-inline-name'] as string | undefined
          if (!nm) nm = inlineNameMap.get(it) || undefined
          if (!nm) {
            const base = nameFromPath([...path, singularize(propName) || 'Item'])
            nm = uniqueName(base)
            inlineNameMap.set(it, nm)
            try { it['x-inline-name'] = nm } catch {}
          }
          const target = ensureNamed(nm, it)
          field.child = target.name
          edges.push({ parent: name, field: propName, child: target.name })
          const childInstance = [...path, propName].join('.')
          const parentInstance = path.join('.')
          occEdges.push({ parentType: name, parentInstance, field: propName, childType: target.name, childInstance, depth: depth + 1 })
          if (!occByDepth.has(depth + 1)) occByDepth.set(depth + 1, [])
          occByDepth.get(depth + 1)!.push(childInstance)
          queue.push({ name: target.name, schema: target.schema, depth: depth + 1, path: [...path, propName] })
        }
      } else if (propSchema.type === 'object' || propSchema.properties) {
        let nm = propSchema['x-inline-name'] as string | undefined
        if (!nm) nm = inlineNameMap.get(propSchema) || undefined
        if (!nm) {
          const base = nameFromPath([...path, propName])
          nm = uniqueName(base)
          inlineNameMap.set(propSchema, nm)
          try { propSchema['x-inline-name'] = nm } catch {}
        }
        const target = ensureNamed(nm, propSchema)
        field.child = target.name
        edges.push({ parent: name, field: propName, child: target.name })
        queue.push({ name: target.name, schema: target.schema, depth: depth + 1, path: [...path, propName] })
      }
    }
  }

  const maxDepth = Math.max(...Array.from(byDepth.keys()))
  const layers: Layers = []
  for (let d = 0; d <= maxDepth; d++) layers[d] = Array.from(byDepth.get(d) || [])
  const occLayers: string[][] = []
  const maxOccDepth = Math.max(0, ...Array.from(occByDepth.keys()))
  for (let d = 1; d <= maxOccDepth; d++) occLayers[d] = occByDepth.get(d) || []
  return { reg, layers, rootName, edges, occEdges, occLayers }
}
