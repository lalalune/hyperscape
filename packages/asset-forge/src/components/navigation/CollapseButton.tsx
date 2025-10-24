/**
 * CollapseButton - Sidebar collapse/expand toggle
 *
 * Beautiful toggle button for collapsing/expanding the sidebar.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useNavigationStore } from '../../store/useNavigationStore'

export default function CollapseButton() {
  const { collapsed, toggleCollapse } = useNavigationStore()

  return (
    <button
      onClick={toggleCollapse}
      className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-base"
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
    </button>
  )
}
