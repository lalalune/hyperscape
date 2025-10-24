/**
 * NavigationSection - Collapsible section component
 *
 * Renders navigation sections with optional collapsible behavior.
 * Supports single links, groups, and collapsible sections.
 */

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import { isNavLink } from '../../config/navigation-config'
import { useNavigationStore } from '../../store/useNavigationStore'
import type { NavigationSection as NavigationSectionType } from '../../types/navigation'

import NavigationItem from './NavigationItem'


interface NavigationSectionProps {
  section: NavigationSectionType
}

export default function NavigationSection({ section }: NavigationSectionProps) {
  const collapsed = useNavigationStore(state => state.collapsed)
  const expandedSections = useNavigationStore(state => state.expandedSections)
  const toggleSection = useNavigationStore(state => state.toggleSection)

  // Check if section is expanded
  const isExpanded = useMemo(
    () => expandedSections.includes(section.id),
    [expandedSections, section.id]
  )

  const handleToggle = useCallback(() => {
    if (section.collapsible) {
      toggleSection(section.id)
    }
  }, [section.collapsible, section.id, toggleSection])

  // Check permission and visibility
  if (section.permission && !section.permission()) return null
  if (section.visible && !section.visible()) return null

  // Single link section (like Home or Game Data)
  if (section.type === 'single' && section.path) {
    return (
      <div className="mb-1">
        <NavigationItem
          item={{
            id: section.id,
            type: 'link',
            label: section.label,
            icon: section.icon!,
            path: section.path,
            tooltip: section.tooltip,
            keywords: section.keywords,
          }}
        />
      </div>
    )
  }

  // Group or collapsible section
  if (!section.items || section.items.length === 0) return null

  // Get section-specific color
  const getSectionColor = (sectionId: string) => {
    const colorMap: Record<string, string> = {
      'quick-access': 'text-blue-400',
      'asset-creation': 'text-purple-400',
      'fitting-rigging': 'text-orange-400',
      'game-content': 'text-green-400',
    }
    return colorMap[sectionId] || 'text-text-secondary'
  }

  const sectionColor = getSectionColor(section.id)

  return (
    <div className="mb-3">
      {/* Section Header */}
      {section.type === 'collapsible' && (
        <button
          onClick={handleToggle}
          className={`
            w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg
            text-xs font-semibold uppercase tracking-wider
            ${sectionColor} hover:bg-bg-tertiary/50
            transition-all duration-200
            ${collapsed ? 'justify-center' : 'justify-between'}
          `}
          title={collapsed ? section.label : undefined}
          data-testid={`nav-section-${section.id}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {section.icon && <section.icon size={collapsed ? 18 : 16} className="flex-shrink-0" />}
            {!collapsed && <span className="truncate">{section.label}</span>}
          </div>

          {!collapsed && section.collapsible && (
            <div className="transition-transform duration-200 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </div>
          )}
        </button>
      )}

      {/* Section Items */}
      {(!section.collapsible || isExpanded || collapsed) && (
        <div className={`space-y-0.5 ${section.type === 'collapsible' && !collapsed ? 'mt-1.5 ml-1' : ''}`}>
          {section.items.map((item) => {
            if (!isNavLink(item)) return null
            return <NavigationItem key={item.id} item={item} />
          })}
        </div>
      )}

      {/* Section Badge */}
      {section.badge && !collapsed && (
        <div className="ml-3 mt-1 mb-2">
          {section.badge.type === 'count' && section.badge.count && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary bg-opacity-20 text-primary">
              {section.badge.count()}
            </span>
          )}
          {section.badge.type === 'text' && section.badge.label && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-bg-tertiary text-text-secondary">
              {section.badge.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
