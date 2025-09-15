import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Subtable } from './Subtable'
import { Entry, Layers, OccEdge } from '../lib/parser'
import { collectDescendants, runLayoutStabilize } from '../lib/layout'

export function Columns({
  reg,
  layers,
  edges,
  scale,
  editTables,
  occEdges,
  occLayers,
  debug,
  onFieldChange,
  onAddField,
  onDeleteField,
  onAddObjectField,
  onSaveTable,
  onEditTable,
  onReorderField,
}: {
  reg: Map<string, Entry>
  layers: Layers
  edges: { parent: string; field: string; child: string }[]
  scale: number
  editTables?: Set<string>
  occEdges?: OccEdge[]
  occLayers?: string[][]
  debug?: boolean
  onFieldChange?: (typeName: string, fieldName: string, patch: Partial<{ name: string; type: string; optional: boolean; required: boolean; description: string }>) => void
  onAddField?: (typeName: string) => void
  onDeleteField?: (typeName: string, fieldName: string) => void
  onAddObjectField?: (typeName: string) => void
  onSaveTable?: (typeName: string) => void
  onEditTable?: (typeName: string) => void
  onReorderField?: (typeName: string, from: string, to: string, pos: 'before'|'after') => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [flashTarget, setFlashTarget] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)

  // 숨김: 타입 키와 인스턴스 키를 분리
  const hiddenTypes = useMemo(() => {
    const set = new Set<string>()
    const edgeByKey = new Map<string, string>() // key -> child type
    edges.forEach((e) => edgeByKey.set(`${e.parent}::${e.field}`, e.child))
    const collapsedArr: string[] = []
    try { (collapsed as any)?.forEach?.((k: string) => collapsedArr.push(k)) } catch {}
    for (const key of collapsedArr) {
      const prefix = String(key).split('::')[0]
      if (prefix.includes('.')) continue
      const child = edgeByKey.get(key)
      if (!child) continue
      set.add(child)
      collectDescendants(edges, child).forEach((t) => set.add(t))
    }
    return set
  }, [collapsed, edges])

  // 인스턴스 레이어: occLayers 사용(없으면 타입 레이어 폴백)
  const occMap = useMemo(() => {
    const m: Record<string, OccEdge> = {}
    ;(occEdges ?? []).forEach((e) => { m[e.childInstance] = e })
    return m
  }, [occEdges])
  // 인스턴스 숨김 접두사: 부모가 접히면 하위 인스턴스도 함께 숨김
  const hiddenInstPrefixes = useMemo(() => {
    const list: string[] = []
    try {
      (collapsed as any)?.forEach?.((k: string) => {
        const id = String(k).split('::')[0]
        if (id.includes('.')) list.push(id)
      })
    } catch {}
    // 긴 접두사가 우선 적용되도록 길이순 정렬(선택사항)
    return list.sort((a, b) => b.length - a.length)
  }, [collapsed])

  const visibleOccLayers = useMemo(() => {
    if (!occLayers || occLayers.length === 0) return [] as string[][]
    const shouldHide = (id: string) => hiddenInstPrefixes.some((p) => id === p || id.startsWith(p + '.'))
    return occLayers.map((insts) => (insts || []).filter((id) => {
      const e = occMap[id]
      return !!(e && reg.has(e.childType) && !shouldHide(id))
    }))
  }, [occLayers, occMap, reg, hiddenInstPrefixes])

  // 타입 레이어 폴백
  const visibleTypeLayers = useMemo(() => {
    return layers.map((names) => names.filter((n) => reg.has(n) && !hiddenTypes.has(n)))
  }, [layers, reg, hiddenTypes])

  const useOcc = useMemo(() => {
    return Array.isArray(visibleOccLayers) && visibleOccLayers.some((arr) => Array.isArray(arr) && arr.length > 0)
  }, [visibleOccLayers])

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const env = {
      getContainerTop: () => containerRef.current!.getBoundingClientRect().top,
      queryRows: () => containerRef.current!.querySelectorAll('tbody tr[data-parent]'),
      queryTableByType: (type: string) => containerRef.current!.querySelector(`.subtable[data-type="${type}"]`),
      getScale: () => scale,
      queryAllTables: () => containerRef.current!.querySelectorAll('.subtable') as NodeListOf<HTMLElement>,
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current!)
    rafRef.current = requestAnimationFrame(() => {
      const targetLayers = (useOcc ? (visibleOccLayers as any) : (visibleTypeLayers as any))
      runLayoutStabilize(targetLayers, edges, env, occEdges as any)
      if (flashTarget) {
        const el = env.queryTableByType(flashTarget)
        if (el) {
          el.classList.add('highlight')
          window.setTimeout(() => el.classList.remove('highlight'), 1200)
        }
        setFlashTarget(null)
      }
    })
  }, [visibleOccLayers, visibleTypeLayers, useOcc, edges, scale, flashTarget])

  useLayoutEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current!) }, [])

  const onToggle = (parent: string, field: string, child?: string, instanceId?: string) => {
    if (!child) return
    // 인스턴스가 있으면 인스턴스ID로, 아니면 타입::필드 키로 접힘 관리
    const key = instanceId ? instanceId : `${parent}::${field}`
    setCollapsed((prev) => {
      const next = new Set(prev)
      const wasCollapsed = next.has(key)
      if (wasCollapsed) {
        next.delete(key)
        setFlashTarget(child)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div ref={containerRef} id="columns" className="columns">
      {useOcc ? (
        <>
          {/* 루트 타입 레이어(0층) */}
          <section className="col" key="root">
            {(visibleTypeLayers[0] || []).map((name) => (
              <Subtable
                key={name}
                typeName={name}
                fields={reg.get(name)?.fields || []}
                collapsedKeys={collapsed}
                onToggle={onToggle}
                useInstanceKeys={true}
                debug={debug}
                editMode={!!editTables?.has(name)}
                onFieldChange={onFieldChange}
                onAddField={onAddField}
                onDeleteField={onDeleteField}
                onAddObjectField={onAddObjectField}
                onSaveTable={onSaveTable}
                onEditTable={onEditTable}
                onReorderField={onReorderField}
              />
            ))}
          </section>
          {/* 인스턴스 1층 이후 */}
          {visibleOccLayers.map((instIds, idx) => (
            idx === 0 ? null : (
              <section className="col" key={idx}>
                {instIds.map((instId: string) => {
                  const e = occMap[instId]
                  if (!e) return null
                  const name = e.childType
                  return (
                    <Subtable
                      key={instId}
                      typeName={name}
                      fields={reg.get(name)?.fields || []}
                      collapsedKeys={collapsed}
                      onToggle={onToggle}
                      useInstanceKeys={true}
                      debug={debug}
                      editMode={!!editTables?.has(name)}
                      onFieldChange={onFieldChange}
                      onAddField={onAddField}
                      onDeleteField={onDeleteField}
                      onAddObjectField={onAddObjectField}
                      onSaveTable={onSaveTable}
                      onEditTable={onEditTable}
                      onReorderField={onReorderField}
                      instanceId={instId}
                    />
                  )
                })}
              </section>
            )
          ))}
        </>
      ) : (
        visibleTypeLayers.map((typeNames, idx) => (
          <section className="col" key={idx}>
            {typeNames.map((name) => (
              <Subtable
                key={name}
                typeName={name}
                fields={reg.get(name)?.fields || []}
                collapsedKeys={collapsed}
                onToggle={onToggle}
                useInstanceKeys={false}
                debug={debug}
                editMode={!!editTables?.has(name)}
                onFieldChange={onFieldChange}
                onAddField={onAddField}
                onDeleteField={onDeleteField}
                onAddObjectField={onAddObjectField}
                onSaveTable={onSaveTable}
                onEditTable={onEditTable}
                onReorderField={onReorderField}
              />
            ))}
          </section>
        ))
      )}
    </div>
  )
}
