import React, { useEffect, useRef, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EventType } from '@hyperscape/shared'
import type { ClientWorld, InventorySlotItem } from '../../types'

type InventorySlotViewItem = Pick<InventorySlotItem, 'slot' | 'itemId' | 'quantity'>

interface InventoryPanelProps {
  items: InventorySlotViewItem[]
  coins: number
  world?: ClientWorld
  onItemMove?: (fromIndex: number, toIndex: number) => void
  onItemUse?: (item: InventorySlotViewItem, index: number) => void
  onItemEquip?: (item: InventorySlotViewItem) => void
}

interface DraggableItemProps {
  item: InventorySlotViewItem | null
  index: number
  size: number
}

function DraggableInventorySlot({ item, index, size }: DraggableItemProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative bg-black/35 border rounded flex items-center justify-center text-white text-[10px] ${item ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      title={item ? `${item.itemId} (${item.quantity})` : 'Empty slot'}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!item) return
        const items = [
          { id: 'drop', label: `Drop ${item.itemId}`, enabled: true },
          { id: 'examine', label: 'Examine', enabled: true },
        ]
        const evt = new CustomEvent('contextmenu', {
          detail: {
            target: {
              id: `inventory_slot_${index}`,
              type: 'inventory',
              name: item.itemId,
            },
            mousePosition: { x: e.clientX, y: e.clientY },
            items,
          },
        })
        window.dispatchEvent(evt)
      }}
    >
      {item ? item.itemId.substring(0, 3) : ''}
      {item && item.quantity > 1 ? (
        <div className="absolute bottom-0.5 right-0.5 bg-black/70 font-bold rounded-sm py-0.5 px-1 text-[9px]" style={{ color: '#f2d08a' }}>
          {item.quantity}
        </div>
      ) : null}
    </div>
  )
}

export function InventoryPanel({ items, coins, world, onItemMove, onItemUse: _onItemUse, onItemEquip: _onItemEquip }: InventoryPanelProps) {
  const slots: (InventorySlotViewItem | null)[] = Array(28).fill(null)
  items.forEach((item) => {
    const s = (item as { slot?: number }).slot
    if (typeof s === 'number' && s >= 0 && s < 28) {
      slots[s] = item
    }
  })
  
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const coinsRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<number>(40)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [slotItems, setSlotItems] = useState<(InventorySlotViewItem | null)[]>(slots)

  useEffect(() => {
    const onCtxSelect = (evt: Event) => {
      const ce = evt as CustomEvent<{ actionId: string; targetId: string }>
      const target = ce.detail?.targetId || ''
      if (!target.startsWith('inventory_slot_')) return
      const slotIndex = parseInt(target.replace('inventory_slot_', ''), 10)
      if (Number.isNaN(slotIndex)) return
      const it = slotItems[slotIndex]
      if (!it) return
      if (ce.detail.actionId === 'drop') {
        if (world?.network?.dropItem) {
          world.network.dropItem(it.itemId, slotIndex, it.quantity || 1)
        } else if (world?.network?.send) {
          world.network.send('dropItem', { itemId: it.itemId, slot: slotIndex, quantity: it.quantity || 1 })
        }
      }
      if (ce.detail.actionId === 'examine') {
        world?.emit(EventType.UI_TOAST, { message: `It's a ${it.itemId}.`, type: 'info' })
      }
    }
    window.addEventListener('contextmenu:select', onCtxSelect as EventListener)
    return () => window.removeEventListener('contextmenu:select', onCtxSelect as EventListener)
  }, [slotItems, world])

  useEffect(() => {
    const newSlots: (InventorySlotViewItem | null)[] = Array(28).fill(null)
    items.forEach((item) => {
      const s = (item as { slot?: number }).slot
      if (typeof s === 'number' && s >= 0 && s < 28) {
        newSlots[s] = item
      }
    })
    setSlotItems(newSlots)
  }, [items])

  useEffect(() => {
    const compute = () => {
      const grid = gridRef.current
      const wrap = wrapperRef.current
      if (!grid || !wrap) return
      const parent = grid.parentElement as HTMLElement | null
      const columns = 4
      const rows = 7
      const gap = 8
      // Available width from wrapper (preferred) or parent
      const widthAvailable = (wrap.clientWidth || parent?.clientWidth || grid.clientWidth)
      const byWidth = Math.floor((widthAvailable - gap * (columns - 1)) / columns)
      // Available height strictly from wrapper's current content box
      const coinsMargins = coinsRef.current ? (parseFloat(getComputedStyle(coinsRef.current).marginTop || '0') + parseFloat(getComputedStyle(coinsRef.current).marginBottom || '0')) : 10
      const coinsBarHeight = (coinsRef.current?.offsetHeight || 44) + coinsMargins
      const wrapHeight = wrap.clientHeight || 0
      const heightAvailable = Math.max(0, wrapHeight - coinsBarHeight - 2)
      const byHeight = Math.floor((heightAvailable - gap * (rows - 1)) / rows)
      const maxSlot = 68
      const minSlot = 44
      const next = Math.max(minSlot, Math.min(byWidth, byHeight, maxSlot))
      setSize(next)
    }
    compute()
    // one more pass after layout settles
    const t = window.setTimeout(compute, 200)
    window.addEventListener('resize', compute)
    return () => { window.clearTimeout(t); window.removeEventListener('resize', compute) }
  }, [])

  const rows = 7
  const columns = 4
  const gap = 8
  const gridWidth = size * columns + gap * (columns - 1)

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
      <div ref={wrapperRef} className="w-full flex-1 min-h-0 flex flex-col box-border overflow-hidden">
        <div className="mx-auto" style={{ width: gridWidth }}>
          <SortableContext items={slotItems.map((_, i) => `inventory-${i}`)} strategy={rectSortingStrategy}>
            <div 
              ref={gridRef} 
              className="mx-auto grid grid-flow-row"
              style={{ 
                gridTemplateColumns: `repeat(${columns}, ${size}px)`, 
                gridTemplateRows: `repeat(${rows}, ${size}px)`,
                gap: gap, 
                width: gridWidth 
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
            ref={coinsRef}
            className="mt-2.5 flex justify-between items-center bg-black/35 border rounded-md py-2 px-2.5 text-[13px] mx-auto"
            style={{
              borderColor: 'rgba(242, 208, 138, 0.3)',
              color: '#f2d08a',
              width: gridWidth
            }}
          >
            <span>Coins</span>
            <span className="font-bold">{coins.toLocaleString()} gp</span>
          </div>
        </div>
      </div>
    </DndContext>
  )
}


