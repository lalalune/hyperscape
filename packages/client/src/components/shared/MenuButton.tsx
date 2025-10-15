import React from 'react'

interface MenuButtonProps {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}

export function MenuButton({ icon, label, active, onClick }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 rounded-lg text-white cursor-pointer flex items-center justify-center text-2xl transition-all duration-200 touch-manipulation relative hover:scale-105 active:scale-95 ${
        active 
          ? 'border-2 border-blue-500/80 bg-blue-500/25 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
          : 'border border-white/20 bg-[rgba(12,12,20,0.95)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      title={label}
    >
      {icon}
    </button>
  )
}


