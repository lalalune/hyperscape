/**
 * VoiceOrb Component
 *
 * Beautiful animated orb that plays when AI voices are speaking.
 * Features:
 * - 3 overlapping rotating spheres with glowing edges
 * - Orange, violet, and white color scheme
 * - Organic shape-shifting animation
 * - Scales with size prop
 */

import React from 'react'

interface VoiceOrbProps {
  isActive?: boolean
  size?: number // Size in pixels
  className?: string
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isActive = true,
  size = 150,
  className = ''
}) => {
  if (!isActive) return null

  const scale = size / 150 // Base size is 150px

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      {/* Circle 1 - Orange glow */}
      <div
        className="voice-orb-circle voice-orb-circle-1"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          transform: `scale(${scale})`,
        }}
      />

      {/* Circle 2 - Violet glow (reverse rotation) */}
      <div
        className="voice-orb-circle voice-orb-circle-2"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          transform: `scale(${scale})`,
        }}
      />

      {/* Circle 3 - White glow */}
      <div
        className="voice-orb-circle voice-orb-circle-3"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          transform: `scale(${scale})`,
        }}
      />

      <style>{`
        @keyframes rotateShape {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1);
            border-radius: 55%;
          }
          50% {
            transform: translate(-50%, -50%) rotate(180deg) scale(1.05);
            border-radius: 45% 55% 50% 50%;
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg) scale(1);
            border-radius: 55%;
          }
        }

        .voice-orb-circle {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 55%;
          animation: rotateShape 6s infinite ease-in-out;
        }

        .voice-orb-circle-1 {
          background: radial-gradient(
            circle,
            rgba(10, 10, 10, 0) 0%,
            rgba(10, 10, 10, 0) 67%,
            rgba(255, 120, 0, 1) 73%,
            rgba(255, 120, 0, 1) 100%
          );
          box-shadow: 0 0 20px 10px rgba(255, 120, 0, 0.05);
        }

        .voice-orb-circle-2 {
          background: radial-gradient(
            circle,
            rgba(10, 10, 10, 0) 0%,
            rgba(10, 10, 10, 0) 67%,
            rgba(139, 92, 246, 1) 75%,
            rgba(139, 92, 246, 1) 100%
          );
          box-shadow: 0 0 20px 10px rgba(139, 92, 246, 0.05);
          animation: rotateShape 6s infinite reverse ease-in-out;
        }

        .voice-orb-circle-3 {
          background: radial-gradient(
            circle,
            rgba(10, 10, 10, 0) 0%,
            rgba(10, 10, 10, 0) 70%,
            rgba(255, 255, 255, 1) 73%,
            rgba(255, 255, 255, 1) 100%
          );
          box-shadow: 0 0 20px 10px rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  )
}

export default VoiceOrb
