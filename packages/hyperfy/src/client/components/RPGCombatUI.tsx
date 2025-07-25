import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import type { 
  RPGCombatStartedEvent,
  RPGCombatEndedEvent,
  RPGCombatStyleChangeEvent
} from '../../types/rpg-events'

interface CombatState {
  inCombat: boolean
  target?: {
    id: string
    name: string
    health: number
    maxHealth: number
  }
  combatStyle: 'attack' | 'strength' | 'defense' | 'ranged'
}

const CombatContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #444;
  border-radius: 8px;
  padding: 15px;
  color: white;
  min-width: 250px;
`

const HealthBar = styled.div`
  width: 100%;
  height: 20px;
  background: #111;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  margin: 5px 0;
`

const HealthFill = styled.div<{ percent: number }>`
  width: ${props => props.percent}%;
  height: 100%;
  background: ${props => props.percent > 60 ? '#4caf50' : props.percent > 30 ? '#ff9800' : '#f44336'};
  transition: width 0.3s ease;
`

const HealthText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight: bold;
`

const CombatStyleSelector = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 15px;
`

const StyleButton = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 8px;
  background: ${props => props.active ? '#4caf50' : '#333'};
  border: 1px solid ${props => props.active ? '#4caf50' : '#555'};
  color: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  
  &:hover {
    background: ${props => props.active ? '#45a049' : '#444'};
  }
`

const TargetInfo = styled.div`
  margin-bottom: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
`

export const RPGCombatUI: React.FC<{ 
  playerId: string
}> = ({ playerId }) => {
  const [combatState, setCombatState] = useState<CombatState>({
    inCombat: false,
    combatStyle: 'attack'
  })

  useEffect(() => {
    // Listen for combat updates
    const handleCombatUpdate = (event: RPGCombatStartedEvent) => {
      if (event.detail.attackerId === playerId || event.detail.targetId === playerId) {
        setCombatState(prev => ({
          ...prev,
          inCombat: true,
          target: event.detail.target
        }))
      }
    }

    const handleCombatEnd = (event: RPGCombatEndedEvent) => {
      if (event.detail.playerId === playerId) {
        setCombatState(prev => ({
          ...prev,
          inCombat: false,
          target: undefined
        }))
      }
    }

    window.addEventListener('rpg:combat:started', handleCombatUpdate)
    window.addEventListener('rpg:combat:ended', handleCombatEnd)

    return () => {
      window.removeEventListener('rpg:combat:started', handleCombatUpdate)
      window.removeEventListener('rpg:combat:ended', handleCombatEnd)
    }
  }, [playerId])

  const handleStyleChange = (style: CombatState['combatStyle']) => {
    setCombatState(prev => ({ ...prev, combatStyle: style }))
    
    // Emit combat style change event
    window.dispatchEvent(new CustomEvent('rpg:combat:style:change', {
      detail: { playerId, style }
    }) as RPGCombatStyleChangeEvent)
  }

  if (!combatState.inCombat) {
    return (
      <CombatContainer>
        <h3>Combat</h3>
        <p style={{ color: '#888', fontSize: '14px' }}>Not in combat</p>
        
        <h4 style={{ marginTop: '15px', fontSize: '14px' }}>Combat Style</h4>
        <CombatStyleSelector>
          <StyleButton 
            active={combatState.combatStyle === 'attack'}
            onClick={() => handleStyleChange('attack')}
          >
            Attack
          </StyleButton>
          <StyleButton 
            active={combatState.combatStyle === 'strength'}
            onClick={() => handleStyleChange('strength')}
          >
            Strength
          </StyleButton>
          <StyleButton 
            active={combatState.combatStyle === 'defense'}
            onClick={() => handleStyleChange('defense')}
          >
            Defense
          </StyleButton>
          <StyleButton 
            active={combatState.combatStyle === 'ranged'}
            onClick={() => handleStyleChange('ranged')}
          >
            Ranged
          </StyleButton>
        </CombatStyleSelector>
      </CombatContainer>
    )
  }

  const healthPercent = combatState.target 
    ? (combatState.target.health / combatState.target.maxHealth) * 100
    : 0

  return (
    <CombatContainer>
      <h3>Combat</h3>
      
      {combatState.target && (
        <TargetInfo>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            Target: {combatState.target.name}
          </div>
          <HealthBar>
            <HealthFill percent={healthPercent} />
            <HealthText>
              {combatState.target.health} / {combatState.target.maxHealth}
            </HealthText>
          </HealthBar>
        </TargetInfo>
      )}
      
      <h4 style={{ fontSize: '14px' }}>Combat Style</h4>
      <CombatStyleSelector>
        <StyleButton 
          active={combatState.combatStyle === 'attack'}
          onClick={() => handleStyleChange('attack')}
        >
          Attack
        </StyleButton>
        <StyleButton 
          active={combatState.combatStyle === 'strength'}
          onClick={() => handleStyleChange('strength')}
        >
          Strength
        </StyleButton>
        <StyleButton 
          active={combatState.combatStyle === 'defense'}
          onClick={() => handleStyleChange('defense')}
        >
          Defense
        </StyleButton>
        <StyleButton 
          active={combatState.combatStyle === 'ranged'}
          onClick={() => handleStyleChange('ranged')}
        >
          Ranged
        </StyleButton>
      </CombatStyleSelector>
    </CombatContainer>
  )
}