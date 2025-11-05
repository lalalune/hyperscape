import { Database, Wand2, Wrench, Hand, Shield, Shuffle } from 'lucide-react'
import React from 'react'

import { NAVIGATION_VIEWS } from '../../constants'
import { NavigationView } from '../../types'

interface NavigationProps {
  currentView: NavigationView
  onViewChange: (view: NavigationView) => void
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  return (
    <nav className="bg-bg-secondary border-b border-border-primary px-6 shadow-theme-sm relative z-[100]">
      <div className="flex items-center justify-between h-[60px]">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gradient">3D Asset Forge</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.GENERATION 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.GENERATION)}
          >
            <Wand2 size={18} />
            <span>Generate</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.ASSETS 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.ASSETS)}
          >
            <Database size={18} />
            <span>Assets</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.HAND_RIGGING 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.HAND_RIGGING)}
          >
            <Hand size={18} />
            <span>Hand Rigging</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.EQUIPMENT 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.EQUIPMENT)}
          >
            <Wrench size={18} />
            <span>Equipment Fitting</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.ARMOR_FITTING 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.ARMOR_FITTING)}
          >
            <Shield size={18} />
            <span>Armor Fitting</span>
          </button>

          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.RETARGET_ANIMATE 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.RETARGET_ANIMATE)}
          >
            <Shuffle size={18} />
            <span>Retarget & Animate</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navigation