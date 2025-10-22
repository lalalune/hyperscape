/**
 * Inventory Panel
 * Modern MMORPG-style inventory interface with drag-and-drop functionality
 */

import React, { useEffect, useState } from 'react'
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
}

const SLOTS_PER_PAGE = 24 // 3 rows × 8 cols on mobile, 4 rows × 6 cols on desktop

function DraggableInventorySlot({ item, index }: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `inventory-${index}`, data: { item, index } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isEmpty = !item

  // Get icon for item
  const getItemIcon = (itemId: string) => {
    if (itemId.includes('sword') || itemId.includes('dagger') || itemId.includes('scimitar')) return '⚔️'
    if (itemId.includes('shield') || itemId.includes('defender')) return '🛡️'
    if (itemId.includes('helmet') || itemId.includes('helm') || itemId.includes('hat')) return '⛑️'
    if (itemId.includes('boots') || itemId.includes('boot')) return '👢'
    if (itemId.includes('glove') || itemId.includes('gauntlet')) return '🧤'
    if (itemId.includes('cape') || itemId.includes('cloak')) return '🧥'
    if (itemId.includes('amulet') || itemId.includes('necklace')) return '📿'
    if (itemId.includes('ring')) return '💍'
    if (itemId.includes('arrow') || itemId.includes('bolt')) return '🏹'
    if (itemId.includes('fish') || itemId.includes('lobster') || itemId.includes('shark')) return '🐟'
    if (itemId.includes('log') || itemId.includes('wood')) return '🪵'
    if (itemId.includes('ore') || itemId.includes('bar')) return '⛏️'
    if (itemId.includes('coin')) return '💰'
    if (itemId.includes('potion') || itemId.includes('vial')) return '🧪'
    if (itemId.includes('food') || itemId.includes('bread') || itemId.includes('meat')) return '🍖'
    if (itemId.includes('axe')) return '🪓'
    if (itemId.includes('pickaxe')) return '⛏️'
    return itemId.substring(0, 2).toUpperCase()
  }

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="relative border rounded transition-all duration-200 group aspect-square w-full"
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
      title={item ? `${item.itemId} (${item.quantity})` : 'Empty slot'}
      style={{
        ...style,
        borderColor: isEmpty ? 'rgba(242, 208, 138, 0.2)' : 'rgba(242, 208, 138, 0.4)',
        background: isEmpty
          ? 'rgba(0, 0, 0, 0.35)'
          : 'linear-gradient(135deg, rgba(242, 208, 138, 0.08) 0%, rgba(242, 208, 138, 0.04) 100%)',
        boxShadow: isEmpty
          ? 'inset 0 1px 2px rgba(0, 0, 0, 0.3)'
          : '0 1px 3px rgba(242, 208, 138, 0.2), inset 0 1px 0 rgba(242, 208, 138, 0.05)',
        cursor: isEmpty ? 'default' : 'grab',
      }}
    >
      {/* Item Icon - Centered */}
      {!isEmpty ? (
        <div
          className="flex items-center justify-center h-full transition-transform duration-200 group-hover:scale-110 text-xs sm:text-sm"
          style={{
            color: '#f2d08a',
          }}
        >
          {getItemIcon(item.itemId)}
        </div>
      ) : (
        <div
          className="flex items-center justify-center h-full opacity-20 text-[0.4rem] sm:text-[0.5rem]"
          style={{
            color: '#f2d08a',
          }}
        >
          •
        </div>
      )}

      {/* Quantity Badge */}
      {item && item.quantity > 1 && (
        <div
          className="absolute bottom-0.5 right-0.5 font-bold rounded px-0.5 py-0.5 leading-none"
          style={{
            background: 'linear-gradient(135deg, rgba(242, 208, 138, 0.95) 0%, rgba(242, 208, 138, 0.85) 100%)',
            color: 'rgba(20, 20, 30, 0.95)',
            fontSize: 'clamp(0.375rem, 0.75vw, 0.438rem)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
          }}
        >
          {item.quantity}
        </div>
      )}

      {/* Hover Glow */}
      {!isEmpty && (
        <div
          className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(242, 208, 138, 0.1) 0%, transparent 70%)',
          }}
        />
      )}
    </button>
  )
}

export function InventoryPanel({ items, coins, world, onItemMove, onItemUse: _onItemUse, onItemEquip: _onItemEquip }: InventoryPanelProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [slotItems, setSlotItems] = useState<(InventorySlotViewItem | null)[]>([])

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const fromIndex = parseInt((active.id as string).split('-')[1])
    const toIndex = parseInt((over.id as string).split('-')[1])

    // Use page-relative indices directly (0-23) within current page
    const newSlots = [...slotItems]
    const [movedItem] = newSlots.splice(fromIndex, 1)
    newSlots.splice(toIndex, 0, movedItem)
    setSlotItems(newSlots)

    if (onItemMove) {
      onItemMove(fromIndex, toIndex)
    }
  }

  const activeItem = activeId ? slotItems[parseInt(activeId.split('-')[1])] : null

  // Calculate stats
  const totalWeight = items.reduce((sum, item) => {
    // Estimate weight based on item type (since we don't have full item data)
    const baseWeight = 0.5
    const quantity = item.quantity || 1
    return sum + (baseWeight * quantity)
  }, 0)

  const itemCount = items.filter(item => item !== null).length
  const maxSlots = 28

  // Pagination - 24 slots per page (3 rows × 8 columns on mobile, 4 rows × 6 columns on desktop)
  const totalPages = Math.ceil(maxSlots / SLOTS_PER_PAGE)
  const startIndex = currentPage * SLOTS_PER_PAGE
  const endIndex = Math.min(startIndex + SLOTS_PER_PAGE, maxSlots)

  // Get only the items for the current page
  const currentPageItems = slotItems.slice(startIndex, endIndex)

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full overflow-hidden gap-0.5 sm:gap-1">
        {/* Header Stats */}
        <div className="flex gap-0.5 sm:gap-1">
          {/* Item Count */}
          <div
            className="flex-1 border rounded transition-all duration-200 flex items-center justify-between py-0.5 px-1 sm:py-1 sm:px-1.5"
            style={{
              background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)',
              borderColor: 'rgba(242, 208, 138, 0.35)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="flex items-center gap-0.5 sm:gap-1">
              <span className="text-xs sm:text-sm">🎒</span>
              <span className="font-medium opacity-75 text-[0.563rem] sm:text-[0.625rem]" style={{ color: '#f2d08a' }}>
                Items
              </span>
            </div>
            <span className="font-semibold text-[0.563rem] sm:text-[0.625rem]" style={{ color: 'rgba(242, 208, 138, 0.9)' }}>
              {itemCount}/{maxSlots}
            </span>
          </div>

          {/* Weight */}
          <div
            className="flex-1 border rounded transition-all duration-200 flex items-center justify-between py-0.5 px-1 sm:py-1 sm:px-1.5"
            style={{
              background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)',
              borderColor: 'rgba(242, 208, 138, 0.35)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="flex items-center gap-0.5 sm:gap-1">
              <span className="text-xs sm:text-sm">⚖️</span>
              <span className="font-medium opacity-75 text-[0.563rem] sm:text-[0.625rem]" style={{ color: '#f2d08a' }}>
                Weight
              </span>
            </div>
            <span className="font-semibold text-[0.563rem] sm:text-[0.625rem]" style={{ color: 'rgba(242, 208, 138, 0.9)' }}>
              {totalWeight.toFixed(1)} kg
            </span>
          </div>
        </div>

        {/* Inventory Grid */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div
            className="flex-1 border rounded transition-all duration-200 flex flex-col p-0.5 sm:p-1"
            style={{
              background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)',
              borderColor: 'rgba(242, 208, 138, 0.35)',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            }}
          >
            <SortableContext items={currentPageItems.map((_, i) => `inventory-${startIndex + i}`)} strategy={rectSortingStrategy}>
              <div
                className="grid grid-cols-8 flex-1 gap-0.5 sm:gap-1"
                style={{
                  gridAutoRows: '1fr',
                }}
              >
                {currentPageItems.map((item, i) => {
                  const actualIndex = startIndex + i
                  return (
                    <DraggableInventorySlot
                      key={actualIndex}
                      item={item}
                      index={actualIndex}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div
              className="border rounded flex items-center justify-center aspect-square"
              style={{
                width: 'clamp(40px, 8vw, 60px)',
                borderColor: 'rgba(242, 208, 138, 0.4)',
                background: 'linear-gradient(135deg, rgba(242, 208, 138, 0.15) 0%, rgba(242, 208, 138, 0.08) 100%)',
                fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
                color: '#f2d08a',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
              }}
            >
              {activeItem.itemId.substring(0, 2).toUpperCase()}
            </div>
          ) : null}
        </DragOverlay>

        {/* Footer */}
        <div className="flex flex-col gap-0.5 sm:gap-1">
          {/* Page Navigation - Only show if multiple pages */}
          {totalPages > 1 && (
            <div
              className="border rounded transition-all duration-200 flex items-center justify-center py-0.5 px-1 sm:py-1 sm:px-1.5"
              style={{
                background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)',
                borderColor: 'rgba(242, 208, 138, 0.35)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="transition-all duration-200"
                  style={{
                    color: currentPage === 0 ? 'rgba(242, 208, 138, 0.3)' : '#f2d08a',
                    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                    cursor: currentPage === 0 ? 'default' : 'pointer',
                    opacity: currentPage === 0 ? 0.5 : 1,
                    fontWeight: 'bold',
                  }}
                >
                  ◀
                </button>
                <div
                  className="font-medium"
                  style={{
                    color: '#f2d08a',
                    fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                    minWidth: 'clamp(2.5rem, 5vw, 3.5rem)',
                    textAlign: 'center',
                  }}
                >
                  Page {currentPage + 1}/{totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="transition-all duration-200"
                  style={{
                    color: currentPage === totalPages - 1 ? 'rgba(242, 208, 138, 0.3)' : '#f2d08a',
                    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                    cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                    opacity: currentPage === totalPages - 1 ? 0.5 : 1,
                    fontWeight: 'bold',
                  }}
                >
                  ▶
                </button>
              </div>
            </div>
          )}

          {/* Coins */}
          <div
            className="border rounded transition-all duration-200 flex items-center justify-between py-px px-1 sm:py-1 sm:px-1.5"
            style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.08) 100%)',
              borderColor: 'rgba(251, 191, 36, 0.4)',
              boxShadow: '0 1px 3px rgba(251, 191, 36, 0.2)',
            }}
          >
            <div className="flex items-center gap-0.5 sm:gap-1">
              <span className="text-sm sm:text-base">💰</span>
              <span className="font-medium text-[0.625rem] sm:text-[0.688rem]" style={{ color: '#fbbf24' }}>
                Coins
              </span>
            </div>
            <span
              className="font-bold text-[0.688rem] sm:text-xs"
              style={{
                color: '#fbbf24',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
              }}
            >
              {coins.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </DndContext>
  )
}
