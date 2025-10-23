import React, { useEffect, useRef, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { InventorySlotItem } from '@hyperscape/shared'

// Economy integration components
import { MintItemButton } from '../inventory/MintItemButton'
import { ItemStatusBadge } from '../inventory/ItemStatusBadge'

// Safe wagmi hook wrapper
function useWalletAddress(): string | undefined {
  try {
    // Dynamic import to avoid errors if wagmi not configured
    const { useAccount } = require('wagmi')
    const { address } = useAccount()
    return address
  } catch {
    return undefined
  }
}

interface InventoryPanelProps {
  items: InventorySlotItem[]
  coins: number
  onItemMove?: (fromIndex: number, toIndex: number) => void
  onItemUse?: (item: InventorySlotItem, index: number) => void
  onItemEquip?: (item: InventorySlotItem) => void
}

interface DraggableItemProps {
  item: InventorySlotItem | null
  index: number
  size: number
}

function DraggableInventorySlot({ item, index, size }: DraggableItemProps) {
  const address = useWalletAddress()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `inventory-${index}`, data: { item, index } })

  const style = {
    width: size,
    height: size,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderColor: 'rgba(242, 208, 138, 0.3)',
  }

  // Debug: log what we're trying to render
  if (item) {
  }

  // Calculate instance ID for this item
  const instanceId = item && address 
    ? `0x${Buffer.from(`${address}${item.itemId}${index}hyperscape`).toString('hex').slice(0, 64).padEnd(64, '0')}`
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative bg-black/35 border rounded flex items-center justify-center text-white text-[10px] ${item ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      title={item ? `${item.itemId} (${item.quantity})` : 'Empty slot'}
      data-testid={`inventory-slot-${index}`}
    >
      {item ? item.itemId.substring(0, 3) : ''}
      {item && item.quantity > 1 ? (
        <div className="absolute bottom-0.5 right-0.5 bg-black/70 font-bold rounded-sm py-0.5 px-1 text-[9px]" style={{ color: '#f2d08a' }}>
          {item.quantity}
        </div>
      ) : null}
      
      {/* Economy features */}
      {item && instanceId && (
        <>
          <div className="absolute top-0.5 left-0.5">
            <ItemStatusBadge 
              instanceId={instanceId as `0x${string}`}
              itemsContract={(process.env.NEXT_PUBLIC_ITEMS_CONTRACT || '0x5FbDB2315678afecb367f032d93F642f64180aa3') as `0x${string}`}
            />
          </div>
          <div className="absolute top-0.5 right-0.5">
            <MintItemButton
              itemId={parseInt(item.itemId, 16)}
              amount={item.quantity}
              slot={index}
            />
          </div>
        </>
      )}
    </div>
  )
}

export function InventoryPanel({ items, coins, onItemMove, onItemUse: _onItemUse, onItemEquip: _onItemEquip }: InventoryPanelProps) {
  const slots: (InventorySlotItem | null)[] = Array(28).fill(null)
  items.forEach((item, i) => {
    if (i < 28) slots[i] = item
  })
  
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<number>(40)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [slotItems, setSlotItems] = useState<(InventorySlotItem | null)[]>(slots)

  useEffect(() => {
    const newSlots: (InventorySlotItem | null)[] = Array(28).fill(null)
    items.forEach((item, i) => { if (i < 28) newSlots[i] = item })
    setSlotItems(newSlots)
  }, [items])

  useEffect(() => {
    const compute = () => {
      const grid = gridRef.current
      if (!grid) return
      const parent = grid.parentElement as HTMLElement | null
      const columns = 4
      const gap = 8
      const widthAvailable = (parent?.clientWidth || grid.clientWidth)
      const byWidth = Math.floor((widthAvailable - gap * (columns - 1)) / columns)
      const next = Math.max(20, byWidth)
      setSize(next)
    }
    compute()
    window.addEventListener('resize', compute)
    const id = window.setInterval(compute, 500)
    return () => { window.removeEventListener('resize', compute); window.clearInterval(id) }
  }, [])

  const rows = 7
  const columns = 4
  const gap = 8
  const gridHeight = size * rows + gap * (rows - 1)

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const fromIndex = parseInt((active.id as string).split('-')[1])
    const toIndex = parseInt((over.id as string).split('-')[1])

    const newSlots = [...slotItems]
    const [movedItem] = newSlots.splice(fromIndex, 1)
    newSlots.splice(toIndex, 0, movedItem)
    setSlotItems(newSlots)

    if (onItemMove) {
      onItemMove(fromIndex, toIndex)
    }
  }

  const activeItem = activeId ? slotItems[parseInt(activeId.split('-')[1])] : null

  return (
    <DndContext 
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full flex flex-col box-border" style={{ height: gridHeight + 44 }}>
        <SortableContext items={slotItems.map((_, i) => `inventory-${i}`)} strategy={rectSortingStrategy}>
          <div 
            ref={gridRef} 
            className="mx-auto grid grid-flow-row"
            style={{ 
              gridTemplateColumns: `repeat(${columns}, ${size}px)`, 
              gridTemplateRows: `repeat(${rows}, ${size}px)`,
              gap: gap, 
              width: (size * columns + gap * (columns - 1)) 
            }}
          >
            {slotItems.map((item, i) => (
              <DraggableInventorySlot
                key={i}
                item={item}
                index={i}
                size={size}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <div
              className="bg-black/35 border rounded flex items-center justify-center text-white text-[10px]"
              style={{
                width: size,
                height: size,
                borderColor: 'rgba(242, 208, 138, 0.3)',
              }}
            >
              {activeItem.itemId.substring(0, 3)}
            </div>
          ) : null}
        </DragOverlay>

        <div
          className="mt-2.5 flex justify-between items-center bg-black/35 border rounded-md py-2 px-2.5 text-[13px]"
          style={{
            borderColor: 'rgba(242, 208, 138, 0.3)',
            color: '#f2d08a',
          }}
          data-testid="gold-display"
        >
          <span>Coins</span>
          <span className="font-bold" data-testid="gold-amount">{coins.toLocaleString()} gp</span>
        </div>
      </div>
    </DndContext>
  )
}


