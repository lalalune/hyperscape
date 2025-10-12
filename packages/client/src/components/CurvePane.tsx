import React from 'react'
import { useEffect, useRef } from 'react'
import { Curve } from '@hyperscape/shared'
import { usePane } from './usePane'
import type { CurvePaneProps } from '@hyperscape/shared'
// import { X } from 'lucide-react'

export function CurvePane({ curve, xLabel, xRange, yLabel, yMin, yMax, onCommit, onCancel }: CurvePaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<{ curve: Curve; canvas: HTMLCanvasElement } | null>(null)

  usePane('curve', paneRef, headRef)

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize curve editor
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Create editor
    const editor = {
      curve,
      canvas,
    }
    editorRef.current = editor

    // Render curve
    renderCurve(ctx, curve, rect.width, rect.height, xRange, yMin, yMax)

    return () => {
      editorRef.current = null
    }
  }, [curve, xRange, yMin, yMax])

  const renderCurve = (ctx: CanvasRenderingContext2D, curve: Curve, width: number, height: number, xRange: [number, number] | undefined, yMin: number, yMax: number) => {
    ctx.clearRect(0, 0, width, height)
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()

      const y = (i / 10) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw curve
    if (curve) {
      ctx.strokeStyle = '#00a7ff'
      ctx.lineWidth = 2
      ctx.beginPath()

      const range = xRange || [0, 1]
      for (let x = 0; x < width; x++) {
        const t = (x / width) * (range[1] - range[0]) + range[0]
        const y = curve.evaluate(t)
        const normalizedY = 1 - ((y - yMin) / (yMax - yMin))
        const pixelY = normalizedY * height
        
        if (x === 0) {
          ctx.moveTo(x, pixelY)
        } else {
          ctx.lineTo(x, pixelY)
        }
      }
      ctx.stroke()
    }
  }

  return (
    <div
      ref={paneRef}
      className='curvepane absolute top-5 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[rgba(22,22,28,1)] border border-white/[0.03] rounded-[10px] shadow-[rgba(0,0,0,0.5)_0px_10px_30px] pointer-events-auto flex flex-col'
    >
      <div className='curvepane-head h-[50px] border-b border-white/5 flex items-center px-5' ref={headRef}>
        <div className='curvepane-head-title flex-1 font-medium'>Curve Editor</div>
        <div className='curvepane-head-close w-10 h-10 flex items-center justify-center text-white/50 hover:text-white cursor-pointer' onClick={onCancel}>
          ×
        </div>
      </div>
      <div className='curvepane-content flex-1 p-5 flex flex-col'>
        <canvas ref={canvasRef} className='curvepane-canvas w-full flex-1 bg-[#1a1a1a] rounded-[5px] cursor-crosshair' />
        <div className='curvepane-labels flex justify-between mt-2.5 text-xs text-white/50'>
          <span>{xLabel} ({xRange ? `${xRange[0]} - ${xRange[1]}` : '0 - 1'})</span>
          <span>{yLabel} ({yMin} - {yMax})</span>
        </div>
      </div>
      <div className='curvepane-footer p-5 border-t border-white/5 flex gap-2.5 justify-end'>
        <button className='curvepane-btn px-4 py-2 rounded-[5px] border-none text-sm cursor-pointer bg-[#333] text-white' onClick={onCancel}>
          Cancel
        </button>
        <button className='curvepane-btn px-4 py-2 rounded-[5px] border-none text-sm cursor-pointer bg-[#00a7ff] text-white' onClick={onCommit}>
          Apply
        </button>
      </div>
    </div>
  )
}

