import React, { PropsWithChildren, useCallback, useMemo, useRef, useState } from 'react'

type CanvasProps = {
  initialScale?: number
  minScale?: number
  maxScale?: number
  children: (scale: number) => React.ReactNode
  scrollable?: boolean
}

export function Canvas({ initialScale = 1, minScale = 0.25, maxScale = 2, children, scrollable = false }: CanvasProps) {
  const [scale, setScale] = useState(initialScale)
  const [tx, setTx] = useState(40)
  const [ty, setTy] = useState(40)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ panning: false, startX: 0, startY: 0, startTx: 0, startTy: 0, space: false })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [bgHover, setBgHover] = useState(false)

  const clamp = (v: number) => Math.min(maxScale, Math.max(minScale, v))
  const applyWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const rect = viewportRef.current!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const prev = scale
      const next = clamp(scale * (e.deltaY < 0 ? 1.1 : 0.9))
      // 줌 중심 유지: (mx - tx) / prev = (mx - tx') / next
      const nx = mx - ((mx - tx) * next) / prev
      const ny = my - ((my - ty) * next) / prev
      setScale(next)
      setTx(nx)
      setTy(ny)
    }
  }, [scale, tx, ty])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const mid = e.button === 1
    const right = e.button === 2
    const left = e.button === 0
    const target = e.target as HTMLElement
    const isBackground = !target.closest('.subtable') && !target.closest('.zoom-toolbar') && !target.closest('.floating-toolbar')
    const canPan = stateRef.current.space || mid || right || (left && isBackground)
    if (!canPan) return
    e.preventDefault()
    const s = stateRef.current
    s.panning = true
    setIsPanning(true)
    s.startX = e.clientX
    s.startY = e.clientY
    s.startTx = tx
    s.startTy = ty
    ;(e.currentTarget as HTMLElement).setPointerCapture?.((e as any).pointerId || 1)
  }, [tx, ty])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (stateRef.current.panning) {
      const dx = e.clientX - stateRef.current.startX
      const dy = e.clientY - stateRef.current.startY
      setTx(stateRef.current.startTx + dx)
      setTy(stateRef.current.startTy + dy)
    } else {
      const target = e.target as HTMLElement
      const isBackground = !target.closest('.subtable') && !target.closest('.zoom-toolbar') && !target.closest('.floating-toolbar')
      setBgHover(isBackground)
    }
  }, [])

  const onMouseUp = useCallback(() => {
    stateRef.current.panning = false
    setIsPanning(false)
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space') {
      stateRef.current.space = true
      setSpaceHeld(true)
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault()
      setScale((s) => clamp(s * 1.1))
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault()
      setScale((s) => clamp(s * 0.9))
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === '0') {
      e.preventDefault()
      setScale(1)
      setTx(40)
      setTy(40)
    }
  }, [])

  const onKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space') { stateRef.current.space = false; setSpaceHeld(false) }
  }, [])

  const transform = useMemo(() => `translate(${tx}px, ${ty}px) scale(${scale})`, [tx, ty, scale])
  const viewportClass = useMemo(() => {
    const base = scrollable ? 'viewport scrollable' : 'viewport'
    if (isPanning) return base + ' grabbing'
    if (spaceHeld || bgHover) return base + ' grab'
    return base
  }, [scrollable, isPanning, spaceHeld, bgHover])

  const toolbarClass = scrollable ? 'zoom-toolbar fixed' : 'zoom-toolbar'

  return (
    <div
      className={viewportClass}
      ref={viewportRef}
      onWheel={applyWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <div className="canvas" ref={contentRef} style={{ transform }}>
        {children(scale)}
      </div>

      <div className={toolbarClass}>
        <button onClick={() => setScale((s) => clamp(s * 0.9))}>-</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => clamp(s * 1.1))}>+</button>
        <button onClick={() => { setScale(1); setTx(40); setTy(40) }}>Reset</button>
      </div>
    </div>
  )
}
