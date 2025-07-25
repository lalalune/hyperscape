import React, { useState, useEffect } from 'react'
import styled from 'styled-components'

interface SkillData {
  level: number
  xp: number
}

interface Skills {
  attack: SkillData
  strength: SkillData
  defense: SkillData
  constitution: SkillData
  ranged: SkillData
  woodcutting: SkillData
  fishing: SkillData
  firemaking: SkillData
  cooking: SkillData
}

const SkillsContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #444;
  border-radius: 8px;
  padding: 20px;
  color: white;
  min-width: 350px;
`

const SkillsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 20px;
`

const SkillItem = styled.div`
  background: #222;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #333;
    border-color: #666;
  }
`

const SkillIcon = styled.div`
  width: 40px;
  height: 40px;
  background: #444;
  border-radius: 4px;
  margin: 0 auto 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
`

const SkillName = styled.div`
  font-size: 12px;
  color: #aaa;
  margin-bottom: 3px;
`

const SkillLevel = styled.div`
  font-size: 16px;
  font-weight: bold;
  color: #4caf50;
`

const XPBar = styled.div`
  width: 100%;
  height: 4px;
  background: #111;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 5px;
`

const XPFill = styled.div<{ percent: number }>`
  width: ${props => props.percent}%;
  height: 100%;
  background: #2196f3;
  transition: width 0.3s ease;
`

const CombatLevel = styled.div`
  text-align: center;
  margin: 20px 0;
  font-size: 18px;
  
  span {
    color: #4caf50;
    font-weight: bold;
    font-size: 24px;
  }
`

const skillIcons: Record<keyof Skills, string> = {
  attack: '⚔️',
  strength: '💪',
  defense: '🛡️',
  constitution: '❤️',
  ranged: '🏹',
  woodcutting: '🪓',
  fishing: '🎣',
  firemaking: '🔥',
  cooking: '🍳'
}

const skillNames: Record<keyof Skills, string> = {
  attack: 'Attack',
  strength: 'Strength',
  defense: 'Defense',
  constitution: 'Constitution',
  ranged: 'Ranged',
  woodcutting: 'Woodcutting',
  fishing: 'Fishing',
  firemaking: 'Firemaking',
  cooking: 'Cooking'
}

// RuneScape XP table for calculating progress to next level
const XP_TABLE = [
  0, 83, 174, 276, 388, 512, 650, 801, 969, 1154,
  1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470,
  5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363
  // ... continues to level 99
]

export const RPGSkillsUI: React.FC<{ 
  isOpen: boolean
  onClose: () => void
  playerId: string
}> = ({ isOpen, onClose, playerId }) => {
  const [skills, setSkills] = useState<Skills | null>(null)
  const [combatLevel, setCombatLevel] = useState(3)

  useEffect(() => {
    if (!isOpen) return

    // Listen for skills updates
    const handleSkillsUpdate = (event: CustomEvent) => {
      if (event.detail.playerId === playerId) {
        setSkills(event.detail.skills)
        
        // Calculate combat level
        if (event.detail.skills) {
          const { attack, strength, defense, constitution, ranged } = event.detail.skills
          const combat = Math.floor(
            (defense.level + constitution.level + Math.floor(ranged.level / 2)) * 0.25 +
            Math.max(attack.level + strength.level, ranged.level * 2 / 3) * 0.325
          )
          setCombatLevel(Math.max(3, combat))
        }
      }
    }

    window.addEventListener('rpg:skills:updated' as any, handleSkillsUpdate)

    return () => {
      window.removeEventListener('rpg:skills:updated' as any, handleSkillsUpdate)
    }
  }, [isOpen, playerId])

  if (!isOpen || !skills) return null

  const getXPPercent = (skill: SkillData): number => {
    if (skill.level >= 99) return 100
    
    const currentLevelXP = XP_TABLE[skill.level - 1] || 0
    const nextLevelXP = XP_TABLE[skill.level] || XP_TABLE[XP_TABLE.length - 1]
    const xpIntoLevel = skill.xp - currentLevelXP
    const xpForLevel = nextLevelXP - currentLevelXP
    
    return Math.min(100, (xpIntoLevel / xpForLevel) * 100)
  }

  return (
    <SkillsContainer>
      <h2>Skills</h2>
      <button 
        onClick={onClose}
        style={{ position: 'absolute', top: '10px', right: '10px' }}
      >
        X
      </button>

      <CombatLevel>
        Combat Level: <span>{combatLevel}</span>
      </CombatLevel>

      <SkillsGrid>
        {(Object.keys(skills) as Array<keyof Skills>).map(skillKey => {
          const skill = skills[skillKey]
          return (
            <SkillItem key={skillKey}>
              <SkillIcon>{skillIcons[skillKey]}</SkillIcon>
              <SkillName>{skillNames[skillKey]}</SkillName>
              <SkillLevel>{skill.level}</SkillLevel>
              <XPBar>
                <XPFill percent={getXPPercent(skill)} />
              </XPBar>
            </SkillItem>
          )
        })}
      </SkillsGrid>
    </SkillsContainer>
  )
}