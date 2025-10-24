/**
 * API Key Manager Component
 * Allows users to manage their API keys for OpenAI, Meshy, and ElevenLabs
 */

import { Plus, Trash2, Edit2, Eye, EyeOff, Loader2, AlertCircle, Check, X } from 'lucide-react'
import { useState, useEffect } from 'react'

import { apiFetch } from '@/utils/api'

interface APIKey {
  id: string
  provider: 'openai' | 'meshy' | 'elevenlabs'
  maskedKey: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

type Provider = 'openai' | 'meshy' | 'elevenlabs'

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    description: 'For GPT-4 Vision weapon detection and content generation',
    keyFormat: 'sk-...',
    placeholder: 'sk-proj-...',
  },
  meshy: {
    name: 'Meshy AI',
    description: 'For 3D model generation and retexturing',
    keyFormat: 'API key from Meshy dashboard',
    placeholder: 'Enter your Meshy API key',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'For voice generation and TTS',
    keyFormat: 'API key from ElevenLabs',
    placeholder: 'Enter your ElevenLabs API key',
  },
}

export function APIKeyManager() {
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalProvider, setModalProvider] = useState<Provider | null>(null)
  const [modalKey, setModalKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAPIKeys()
  }, [])

  const fetchAPIKeys = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch('/api/user/api-keys')

      if (!response.ok) {
        throw new Error('Failed to fetch API keys')
      }

      const data = await response.json()
      setApiKeys(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (provider: Provider) => {
    setModalProvider(provider)
    setModalKey('')
    setShowKey(false)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setModalProvider(null)
    setModalKey('')
    setShowKey(false)
  }

  const handleSaveKey = async () => {
    if (!modalProvider || !modalKey.trim()) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await apiFetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: modalProvider,
          apiKey: modalKey.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to save API key')
      }

      await fetchAPIKeys()
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return
    }

    try {
      setError(null)

      const response = await apiFetch(`/api/user/api-keys/${keyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to delete API key')
      }

      await fetchAPIKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key')
    }
  }

  const getKeyForProvider = (provider: Provider): APIKey | undefined => {
    return apiKeys.find((k) => k.provider === provider)
  }

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-text-secondary">Loading API keys...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-300 text-sm">
              Your API keys are encrypted and stored securely. They are only used when you generate
              content and are never shared with third parties.
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* API Key Sections */}
      <div className="space-y-4">
        {Object.entries(PROVIDER_INFO).map(([provider, info]) => {
          const key = getKeyForProvider(provider as Provider)

          return (
            <div key={provider} className="bg-bg-secondary rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{info.name}</h3>
                  <p className="text-sm text-text-secondary mt-1">{info.description}</p>
                </div>

                <div className="flex gap-2">
                  {key ? (
                    <>
                      <button
                        onClick={() => openModal(provider as Provider)}
                        className="p-2 text-text-secondary hover:text-white hover:bg-bg-tertiary rounded-lg transition-colors"
                        title="Update key"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="p-2 text-text-secondary hover:text-red-400 hover:bg-bg-tertiary rounded-lg transition-colors"
                        title="Delete key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openModal(provider as Provider)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Key</span>
                    </button>
                  )}
                </div>
              </div>

              {key ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-2 bg-bg-tertiary rounded-lg font-mono text-sm text-text-primary">
                      {key.maskedKey}
                    </div>
                    <div className="flex items-center gap-2">
                      {key.isActive ? (
                        <span className="flex items-center gap-1 text-green-400 text-sm">
                          <Check className="w-4 h-4" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-text-secondary text-sm">
                          <X className="w-4 h-4" />
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Added: {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.lastUsedAt && (
                      <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-text-tertiary text-sm">No API key configured</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && modalProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-lg max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">
              {getKeyForProvider(modalProvider) ? 'Update' : 'Add'} {PROVIDER_INFO[modalProvider].name} API Key
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={modalKey}
                    onChange={(e) => setModalKey(e.target.value)}
                    placeholder={PROVIDER_INFO[modalProvider].placeholder}
                    className="w-full px-4 py-2 pr-10 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Format: {PROVIDER_INFO[modalProvider].keyFormat}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-bg-tertiary hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveKey}
                  disabled={!modalKey.trim() || saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Key</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
