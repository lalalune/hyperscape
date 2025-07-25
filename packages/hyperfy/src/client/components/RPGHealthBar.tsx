import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import type { 
  RPGPlayerStatsUpdateEvent,
  RPGPlayerHealthChangeEvent,
  RPGPlayerStatusEffectEvent,
  RPGPlayerStaminaUpdateEvent
} from '../../types/rpg-events'

interface PlayerStats {
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
  experience?: number
  nextLevelExp?: number
  combatLevel?: number
}

const HealthBarContainer = styled.div`
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #444;
  border-radius: 8px;
  padding: 15px;
  color: white;
  min-width: 250px;
  font-family: 'Courier New', monospace;
`

const StatBar = styled.div<{ width?: string }>`
  width: ${props => props.width || '100%'};
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
  background: ${props => {
    if (props.percent > 75) return '#4caf50'  // Green
    if (props.percent > 50) return '#8bc34a'  // Light green
    if (props.percent > 25) return '#ff9800'  // Orange
    return '#f44336'                          // Red
  }};
  transition: width 0.5s ease;
`

const StaminaFill = styled.div<{ percent: number }>`
  width: ${props => props.percent}%;
  height: 100%;
  background: ${props => {
    if (props.percent > 50) return '#2196f3'  // Blue
    if (props.percent > 25) return '#ff9800'  // Orange
    return '#f44336'                          // Red
  }};
  transition: width 0.3s ease;
`

const ExperienceFill = styled.div<{ percent: number }>`
  width: ${props => props.percent}%;
  height: 100%;
  background: linear-gradient(90deg, #9c27b0, #e91e63);
  transition: width 0.5s ease;
`

const StatText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
`

const StatLabel = styled.div`
  font-size: 12px;
  color: #ccc;
  margin: 2px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const CombatLevel = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #666;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 10px;
  text-align: center;
`

const StatusEffects = styled.div`
  margin-top: 10px;
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
`

const StatusEffect = styled.div<{ type: 'positive' | 'negative' | 'neutral' }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: ${props => {
    switch (props.type) {
      case 'positive': return 'rgba(76, 175, 80, 0.8)'
      case 'negative': return 'rgba(244, 67, 54, 0.8)'
      default: return 'rgba(96, 125, 139, 0.8)'
    }
  }};
`

const RegenerationIndicator = styled.div<{ active: boolean }>`
  position: absolute;
  top: -2px;
  right: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4caf50;
  opacity: ${props => props.active ? 1 : 0};
  animation: ${props => props.active ? 'pulse 1s infinite' : 'none'};
  
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
`

export const RPGHealthBar: React.FC<{ 
  playerId: string
}> = ({ playerId }) => {
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    combatLevel: 1
  })
  const [statusEffects, setStatusEffects] = useState<Array<{
    name: string
    type: 'positive' | 'negative' | 'neutral'
    duration?: number
  }>>([])
  const [isRegenerating, setIsRegenerating] = useState(false)

  useEffect(() => {
    // Listen for player stats updates
    const handleStatsUpdate = (event: RPGPlayerStatsUpdateEvent) => {
      if (event.detail.playerId === playerId) {
        const newStats = event.detail.stats
        setStats(prev => ({
          health: newStats.constitution?.current || prev.health,
          maxHealth: newStats.constitution?.max || prev.maxHealth,
          stamina: newStats.stamina?.current || prev.stamina,
          maxStamina: newStats.stamina?.max || prev.maxStamina,
          experience: newStats.experience?.current,
          nextLevelExp: newStats.experience?.nextLevel,
          combatLevel: newStats.combatLevel || prev.combatLevel
        }))
      }
    }

    // Listen for health changes (damage/healing)
    const handleHealthChange = (event: RPGPlayerHealthChangeEvent) => {
      if (event.detail.playerId === playerId) {
        setStats(prev => ({
          ...prev,
          health: Math.max(0, Math.min(prev.maxHealth, event.detail.newHealth))
        }))
        
        // Show regeneration indicator for healing
        if (event.detail.changeType === 'heal') {
          setIsRegenerating(true)
          setTimeout(() => setIsRegenerating(false), 2000)
        }
      }
    }

    // Listen for status effects
    const handleStatusEffect = (event: RPGPlayerStatusEffectEvent) => {
      if (event.detail.playerId === playerId) {
        const { effect, action } = event.detail
        
        if (action === 'add') {
          setStatusEffects(prev => [...prev.filter(e => e.name !== effect.name), effect])
        } else if (action === 'remove') {
          setStatusEffects(prev => prev.filter(e => e.name !== effect.name))
        }
      }
    }

    // Listen for stamina updates
    const handleStaminaUpdate = (event: RPGPlayerStaminaUpdateEvent) => {
      if (event.detail.playerId === playerId) {
        setStats(prev => ({
          ...prev,
          stamina: Math.max(0, Math.min(prev.maxStamina, event.detail.stamina))
        }))
      }
    }

    window.addEventListener('rpg:player:stats:updated', handleStatsUpdate)
    window.addEventListener('rpg:player:health:changed', handleHealthChange)
    window.addEventListener('rpg:player:status:effect', handleStatusEffect)
    window.addEventListener('rpg:player:stamina:updated', handleStaminaUpdate)

    return () => {
      window.removeEventListener('rpg:player:stats:updated', handleStatsUpdate)
      window.removeEventListener('rpg:player:health:changed', handleHealthChange)
      window.removeEventListener('rpg:player:status:effect', handleStatusEffect)
      window.removeEventListener('rpg:player:stamina:updated', handleStaminaUpdate)
    }
  }, [playerId])

  const healthPercent = (stats.health / stats.maxHealth) * 100
  const staminaPercent = (stats.stamina / stats.maxStamina) * 100
  const expPercent = stats.experience && stats.nextLevelExp 
    ? (stats.experience / stats.nextLevelExp) * 100 
    : 0

  return (
    <HealthBarContainer>
      {stats.combatLevel && (
        <CombatLevel>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            Combat Level: {stats.combatLevel}
          </div>
        </CombatLevel>
      )}

      <StatLabel>
        <span>Health</span>
        <span style={{ fontSize: '10px' }}>
          {stats.health} / {stats.maxHealth}
        </span>
      </StatLabel>
      <StatBar style={{ position: 'relative' }}>
        <HealthFill percent={healthPercent} />
        <StatText>{Math.round(healthPercent)}%</StatText>
        <RegenerationIndicator active={isRegenerating} />
      </StatBar>

      <StatLabel>
        <span>Stamina</span>
        <span style={{ fontSize: '10px' }}>
          {stats.stamina} / {stats.maxStamina}
        </span>
      </StatLabel>
      <StatBar>
        <StaminaFill percent={staminaPercent} />
        <StatText>{Math.round(staminaPercent)}%</StatText>
      </StatBar>

      {stats.experience && stats.nextLevelExp && (
        <>
          <StatLabel>
            <span>Experience</span>
            <span style={{ fontSize: '10px' }}>
              {stats.experience} / {stats.nextLevelExp}
            </span>
          </StatLabel>
          <StatBar>
            <ExperienceFill percent={expPercent} />
            <StatText>{Math.round(expPercent)}%</StatText>
          </StatBar>
        </>
      )}

      {statusEffects.length > 0 && (
        <StatusEffects>
          {statusEffects.map((effect, index) => (
            <StatusEffect key={index} type={effect.type}>
              {effect.name}
              {effect.duration && ` (${effect.duration}s)`}
            </StatusEffect>
          ))}
        </StatusEffects>
      )}
    </HealthBarContainer>
  )
}