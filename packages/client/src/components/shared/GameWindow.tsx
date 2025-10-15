import React, { useRef } from 'react'
import { DraggableWindow } from '../DraggableWindow'

interface GameWindowProps {
  title: string
  onClose: () => void
  defaultX: number
  defaultY: number
  children: React.ReactNode
}

export function GameWindow({ title, onClose, defaultX, defaultY, children }: GameWindowProps) {
  const dragHandleRef = useRef<HTMLDivElement>(null)
  
  return (
    <DraggableWindow
      initialPosition={{ x: defaultX, y: defaultY }}
      dragHandle={
        <div
          ref={dragHandleRef}
          className="bg-[rgba(11,10,21,0.98)] border-b border-white/[0.08] py-2.5 px-3 flex items-center justify-between cursor-grab select-none rounded-t-xl"
        >
          <div className="font-semibold text-sm">{title}</div>
          <button
            onClick={onClose}
            className="bg-red-500 border-none text-white rounded-md w-6 h-6 cursor-pointer flex items-center justify-center text-sm font-bold touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            ✕
          </button>
        </div>
      }
      className="bg-[rgba(11,10,21,0.96)] border border-white/[0.08] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] min-w-[300px] max-w-[500px] max-h-[80vh] pointer-events-auto z-[1000]"
    >
      <div className="p-3 overflow-y-auto max-h-[calc(80vh-48px)]">
        {children}
      </div>
    </DraggableWindow>
  )
}


