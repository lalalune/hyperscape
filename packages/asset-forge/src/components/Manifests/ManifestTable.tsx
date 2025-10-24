/**
 * Manifest Table
 * Displays manifest data in a searchable table format
 */

import { Search, RefreshCw, Box, AlertCircle } from 'lucide-react'
import React, { useMemo } from 'react'

import type { AnyManifest } from '../../types/manifests'
import { hasValidModel } from '../../utils/manifest-to-generation-config'
import { Badge } from '../common/Badge'
import { Input } from '../common/Input'

interface ManifestTableProps {
  items: AnyManifest[]
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectItem: (item: AnyManifest) => void
  selectedItem: AnyManifest | null
  onRefresh?: () => void
  loading?: boolean
}

export const ManifestTable: React.FC<ManifestTableProps> = ({
  items,
  searchQuery,
  onSearchChange,
  onSelectItem,
  selectedItem,
  onRefresh,
  loading = false
}) => {
  // Helper to render cell value
  const renderCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // Get columns based on first item - memoized to avoid recalculating on every render
  const columns = useMemo(() => {
    if (items.length === 0) return []

    const firstItem = items[0]
    const keys = Object.keys(firstItem)

    // Prioritize certain columns
    const priority = ['id', 'name', 'type', 'level', 'description']
    const priorityKeys = priority.filter(k => keys.includes(k))
    const otherKeys = keys.filter(k => !priority.includes(k) && typeof firstItem[k as keyof typeof firstItem] !== 'object')

    return [...priorityKeys, ...otherKeys].slice(0, 6) // Limit to 6 columns
  }, [items])

  return (
    <div className="flex flex-col h-full bg-bg-secondary border border-border-primary rounded-xl shadow-theme-sm">
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all"
              title="Refresh data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          <Badge variant="secondary">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <p>No items found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-bg-tertiary z-10">
              <tr>
                {columns.map((col: string) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-primary"
                  >
                    {col}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-primary">
                  3D Model
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {items.map((item, idx) => {
                const hasModel = hasValidModel(item)
                return (
                  <tr
                    key={'id' in item ? item.id : idx}
                    onClick={() => onSelectItem(item)}
                    className={`
                      cursor-pointer transition-colors
                      ${
                        selectedItem === item
                          ? 'bg-primary bg-opacity-10'
                          : 'hover:bg-bg-tertiary'
                      }
                    `}
                  >
                    {columns.map((col: string) => (
                      <td
                        key={col}
                        className="px-4 py-3 text-sm text-text-primary whitespace-nowrap"
                      >
                        {renderCellValue(item[col as keyof typeof item])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {hasModel ? (
                        <div className="flex items-center gap-1 text-green-500">
                          <Box size={14} />
                          <span className="text-xs">Available</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertCircle size={14} />
                          <span className="text-xs">Missing</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

