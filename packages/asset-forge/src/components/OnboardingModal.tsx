/**
 * OnboardingModal Component
 * Welcome modal for new users after sign up
 * Introduces Asset Forge features and capabilities
 */

import React, { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './common/Modal'
import { Button } from './common/Button'
import { useAuth } from '../hooks/useAuth'

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
}

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to Asset Forge',
    description: 'Your AI-powered 3D asset generation platform',
    content: (
      <div className="space-y-4">
        <p className="text-text-secondary">
          Asset Forge combines the power of GPT-4 and Meshy.ai to create
          professional 3D game assets from simple text descriptions.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
            <div className="text-2xl mb-2">🎨</div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              AI Generation
            </h4>
            <p className="text-xs text-text-secondary">
              Create 3D models from text descriptions
            </p>
          </div>
          <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
            <div className="text-2xl mb-2">⚔️</div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              Game Assets
            </h4>
            <p className="text-xs text-text-secondary">
              Weapons, armor, characters, and items
            </p>
          </div>
          <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
            <div className="text-2xl mb-2">🤖</div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              Smart Rigging
            </h4>
            <p className="text-xs text-text-secondary">
              Automatic armor fitting and weapon rigging
            </p>
          </div>
          <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
            <div className="text-2xl mb-2">📦</div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              Asset Library
            </h4>
            <p className="text-xs text-text-secondary">
              Organize and manage your creations
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Generate Your First Asset',
    description: 'Create 3D models in minutes',
    content: (
      <div className="space-y-4">
        <ol className="space-y-3 text-sm text-text-secondary">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-semibold">
              1
            </span>
            <div>
              <strong className="text-text-primary">Describe your asset</strong>
              <p className="text-xs mt-1">
                "A medieval iron sword with a leather-wrapped handle"
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-semibold">
              2
            </span>
            <div>
              <strong className="text-text-primary">AI generates concept art</strong>
              <p className="text-xs mt-1">
                GPT-4 enhances your prompt and DALL-E creates concept art
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-semibold">
              3
            </span>
            <div>
              <strong className="text-text-primary">3D model created</strong>
              <p className="text-xs mt-1">
                Meshy.ai converts the concept art into a 3D model
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-semibold">
              4
            </span>
            <div>
              <strong className="text-text-primary">Download & use</strong>
              <p className="text-xs mt-1">
                Get your game-ready GLB file and use it in your project
              </p>
            </div>
          </li>
        </ol>
      </div>
    ),
  },
  {
    title: 'Advanced Features',
    description: 'Take your assets to the next level',
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
            <h4 className="text-sm font-semibold text-text-primary mb-2">
              Material Variants
            </h4>
            <p className="text-xs text-text-secondary">
              Generate multiple material versions (bronze, steel, mithril) from a
              single base model to create tiered equipment sets.
            </p>
          </div>
          <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
            <h4 className="text-sm font-semibold text-text-primary mb-2">
              Armor Fitting
            </h4>
            <p className="text-xs text-text-secondary">
              Automatically fit armor pieces to character models with smart weight
              transfer and mesh deformation.
            </p>
          </div>
          <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
            <h4 className="text-sm font-semibold text-text-primary mb-2">
              Hand Rigging
            </h4>
            <p className="text-xs text-text-secondary">
              AI-powered hand pose detection automatically rigs weapons with proper
              grip points for realistic animations.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Ready to Create?',
    description: 'Start building your asset library',
    content: (
      <div className="space-y-4">
        <p className="text-text-secondary">
          Your account is all set up! Here are some tips to get started:
        </p>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              Visit the <strong className="text-text-primary">Generation</strong> page
              to create your first asset
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              Check the <strong className="text-text-primary">Asset Library</strong> to
              manage your creations
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              Explore <strong className="text-text-primary">Equipment</strong> to
              organize weapon and armor sets
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              Try <strong className="text-text-primary">Armor Fitting</strong> and{' '}
              <strong className="text-text-primary">Hand Rigging</strong> for advanced
              features
            </span>
          </li>
        </ul>
      </div>
    ),
  },
]

/**
 * OnboardingModal - Multi-step welcome modal for new users
 */
export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const { completeOnboarding } = useAuth()

  const step = ONBOARDING_STEPS[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding()
      onClose()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  const handleSkip = () => {
    completeOnboarding()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleSkip} size="lg">
      <ModalHeader onClose={handleSkip}>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-text-primary">{step.title}</h2>
          <p className="text-sm text-text-secondary mt-1">{step.description}</p>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="min-h-[300px]">
          {step.content}

          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-primary'
                    : 'bg-surface-tertiary hover:bg-surface-quaternary'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={handleSkip} size="sm">
            Skip Tutorial
          </Button>

          <div className="flex gap-2">
            {!isFirstStep && (
              <Button variant="secondary" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button variant="primary" onClick={handleNext}>
              {isLastStep ? "Get Started" : "Next"}
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  )
}
