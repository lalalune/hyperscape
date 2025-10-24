/**
 * Game Style Selector Component
 * Visual grid-based selector for game art styles
 */

interface GameStyleOption {
  id: string
  name: string
  emoji: string
}

const GAME_STYLES: GameStyleOption[] = [
  { id: 'pixel-art', name: 'Pixel Art', emoji: '🟦' },
  { id: 'low-poly', name: 'Low Poly', emoji: '🔷' },
  { id: 'realistic', name: 'Realistic', emoji: '📷' },
  { id: 'stylized', name: 'Stylized', emoji: '🎨' },
  { id: 'cartoon', name: 'Cartoon', emoji: '🎪' },
  { id: 'anime', name: 'Anime', emoji: '✨' },
  { id: 'voxel', name: 'Voxel', emoji: '🧊' },
  { id: 'hand-painted', name: 'Hand-Painted', emoji: '🖌️' },
]

interface GameStyleSelectorProps {
  value: string | null
  onChange: (style: string | null) => void
}

export function GameStyleSelector({ value, onChange }: GameStyleSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {GAME_STYLES.map((style) => {
        const isSelected = value === style.id

        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(isSelected ? null : style.id)}
            className={`
              p-4 rounded-lg border-2 transition-all
              ${
                isSelected
                  ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20'
                  : 'bg-bg-tertiary border-border-primary hover:border-gray-500 hover:bg-gray-600'
              }
            `}
          >
            <div className="text-3xl mb-2">{style.emoji}</div>
            <div
              className={`text-sm font-medium ${
                isSelected ? 'text-blue-300' : 'text-text-primary'
              }`}
            >
              {style.name}
            </div>
          </button>
        )
      })}
    </div>
  )
}
