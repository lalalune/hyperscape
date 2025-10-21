import React, { useEffect } from 'react'
import { storage } from '@hyperscape/shared'

interface PaneInfo {
  v: number
  count: number
  configs: Record<string, { id: string; x: number; y: number; width: number; height: number; layer: number }>
}

const STORAGE_KEY = 'panes'

let info = storage?.get(STORAGE_KEY) as PaneInfo | undefined

if (!info || info.v !== 1) {
  info = {
    v: 1,
    count: 0,
    configs: {},
  }
}

const paneInfo = info as PaneInfo

const debounce = (fn: Function, ms: number) => {
  let timeout: NodeJS.Timeout
  return (...args: unknown[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), ms)
  }
}

const persist = debounce(() => storage?.set(STORAGE_KEY, paneInfo), 300)

let layer = 0

export function usePane(id: string, paneRef: React.RefObject<HTMLElement>, headRef: React.RefObject<HTMLElement>, resizable = false) {
  useEffect(() => {
    let config = paneInfo.configs[id] as { id: string; x: number; y: number; width: number; height: number; layer: number } | undefined
    const pane = paneRef.current
    if (!pane) return

    if (!config) {
      const count = ++paneInfo.count
      config = {
        id,
        y: count * 20,
        x: count * 20,
        width: pane.offsetWidth,
        height: pane.offsetHeight,
        layer: 0,
      }
      paneInfo.configs[id] = config
      persist()
    }

    // TypeScript assertion - config is definitely defined after the check/assignment above
    const paneConfig = config as NonNullable<typeof config>

    if (!resizable) {
      paneConfig.width = pane.offsetWidth
      paneConfig.height = pane.offsetHeight
    }

    layer++

    // ensure pane is within screen bounds so it can't get lost
    const maxX = window.innerWidth - paneConfig.width
    const maxY = window.innerHeight - paneConfig.height
    paneConfig.x = Math.min(Math.max(0, paneConfig.x), maxX)
    paneConfig.y = Math.min(Math.max(0, paneConfig.y), maxY)

    pane.style.top = `${paneConfig.y}px`
    pane.style.left = `${paneConfig.x}px`
    if (resizable) {
      pane.style.width = `${paneConfig.width}px`
      pane.style.height = `${paneConfig.height}px`
    }
    pane.style.zIndex = `${layer}`

    const head = headRef.current
    if (!head) return

    const onPanePointerDown = () => {
      layer++
      pane.style.zIndex = `${layer}`
    }

    let moving = false
    const onHeadPointerDown = (_e: PointerEvent) => {
      moving = true
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!moving) return
      paneConfig.x += e.movementX
      paneConfig.y += e.movementY
      pane.style.top = `${paneConfig.y}px`
      pane.style.left = `${paneConfig.x}px`
      persist()
    }

    const onPointerUp = (_e: PointerEvent) => {
      moving = false
    }

    const resizer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        paneConfig.width = entry.contentRect.width
        paneConfig.height = entry.contentRect.height
        persist()
      }
    })

    head.addEventListener('pointerdown', onHeadPointerDown)
    pane.addEventListener('pointerdown', onPanePointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    resizer.observe(pane)

    return () => {
      head.removeEventListener('pointerdown', onHeadPointerDown)
      pane.removeEventListener('pointerdown', onPanePointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      resizer.disconnect()
    }
  }, [])
}
