/**
 * Settings Page
 * Application settings and preferences
 */

import { Settings as SettingsIcon, Palette, Keyboard, Bell, Lock, Globe, Zap, Save, CheckCircle, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Key } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Checkbox, Input } from '@/components/common'
import { useNavigationStore } from '@/stores/useNavigationStore'

export function SettingsPage() {
  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Settings state
  const [settings, setSettings] = useState({
    // Appearance
    theme: 'dark' as 'dark' | 'light' | 'auto',
    compactMode: false,
    animationsEnabled: true,

    // Notifications
    emailNotifications: true,
    browserNotifications: false,
    generationNotifications: true,

    // Performance
    autoSaveEnabled: true,
    lowPowerMode: false,
    preloadModels: true,

    // Privacy
    analyticsEnabled: true,
    crashReportsEnabled: true,

    // Language
    language: 'en' as 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh',

    // API Configuration
    aiGatewayUrl: ''
  })

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('privy:token')}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          if (data.settings) {
            setSettings(prev => ({ ...prev, ...data.settings }))
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setSaveSuccess(null)
    setSaveError(null)

    try {
      // Save to API
      const response = await fetch('/api/users/me/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('privy:token')}`
        },
        body: JSON.stringify({ settings })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      // Also save to localStorage for faster loading
      localStorage.setItem('app-settings', JSON.stringify(settings))

      setSaveSuccess('Settings saved successfully!')
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings')
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleThemeChange = (newTheme: 'dark' | 'light' | 'auto') => {
    setSettings({ ...settings, theme: newTheme })
  }

  const handleLanguageChange = (newLanguage: 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh') => {
    setSettings({ ...settings, language: newLanguage })
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-primary backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 backdrop-blur-sm">
                <SettingsIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
                <p className="text-text-secondary mt-1">Customize your Asset Forge experience</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
        {/* Appearance */}
        <Card className="bg-bg-secondary border-border-primary backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize the look and feel of the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-primary mb-3 block">Theme</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`p-4 bg-bg-tertiary rounded-lg border-2 ${settings.theme === 'dark' ? 'border-primary' : 'border-border-primary'} hover:border-primary/50 transition-all`}
                >
                  <div className="w-full h-16 bg-gradient-to-br from-gray-900 to-gray-800 rounded mb-3 border border-border-primary"></div>
                  <p className="text-sm font-medium text-text-primary">Dark</p>
                  <p className="text-xs text-text-tertiary">Classic dark theme</p>
                </button>
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`p-4 bg-bg-tertiary rounded-lg border-2 ${settings.theme === 'light' ? 'border-primary' : 'border-border-primary'} hover:border-primary/50 transition-all`}
                >
                  <div className="w-full h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-3 border border-border-primary"></div>
                  <p className="text-sm font-medium text-text-primary">Light</p>
                  <p className="text-xs text-text-tertiary">Clean light theme</p>
                </button>
                <button
                  onClick={() => handleThemeChange('auto')}
                  className={`p-4 bg-bg-tertiary rounded-lg border-2 ${settings.theme === 'auto' ? 'border-primary' : 'border-border-primary'} hover:border-primary/50 transition-all`}
                >
                  <div className="w-full h-16 bg-gradient-to-br from-gray-900 via-gray-700 to-gray-100 rounded mb-3 border border-border-primary"></div>
                  <p className="text-sm font-medium text-text-primary">Auto</p>
                  <p className="text-xs text-text-tertiary">Match system</p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Compact Mode</h4>
                <p className="text-xs text-text-secondary mt-1">Reduce spacing for a denser layout</p>
              </div>
              <Checkbox
                checked={settings.compactMode}
                onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Animations</h4>
                <p className="text-xs text-text-secondary mt-1">Enable smooth transitions and animations</p>
              </div>
              <Checkbox
                checked={settings.animationsEnabled}
                onChange={(e) => setSettings({ ...settings, animationsEnabled: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-bg-secondary border-border-primary backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Manage how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Email Notifications</h4>
                <p className="text-xs text-text-secondary mt-1">Receive updates via email</p>
              </div>
              <Checkbox
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Browser Notifications</h4>
                <p className="text-xs text-text-secondary mt-1">Get real-time alerts in your browser</p>
              </div>
              <Checkbox
                checked={settings.browserNotifications}
                onChange={(e) => setSettings({ ...settings, browserNotifications: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Generation Completion</h4>
                <p className="text-xs text-text-secondary mt-1">Notify when asset generation completes</p>
              </div>
              <Checkbox
                checked={settings.generationNotifications}
                onChange={(e) => setSettings({ ...settings, generationNotifications: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card className="bg-bg-secondary border-border-primary backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle>Performance</CardTitle>
            </div>
            <CardDescription>Optimize application performance and resource usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Auto-Save</h4>
                <p className="text-xs text-text-secondary mt-1">Automatically save your work</p>
              </div>
              <Checkbox
                checked={settings.autoSaveEnabled}
                onChange={(e) => setSettings({ ...settings, autoSaveEnabled: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Low Power Mode</h4>
                <p className="text-xs text-text-secondary mt-1">Reduce resource usage for better battery life</p>
              </div>
              <Checkbox
                checked={settings.lowPowerMode}
                onChange={(e) => setSettings({ ...settings, lowPowerMode: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Preload 3D Models</h4>
                <p className="text-xs text-text-secondary mt-1">Load models in advance for faster viewing</p>
              </div>
              <Checkbox
                checked={settings.preloadModels}
                onChange={(e) => setSettings({ ...settings, preloadModels: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card className="bg-bg-secondary border-border-primary backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              <CardTitle>Privacy & Security</CardTitle>
            </div>
            <CardDescription>Control your data and privacy preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Anonymous Analytics</h4>
                <p className="text-xs text-text-secondary mt-1">Help improve the app by sharing usage data</p>
              </div>
              <Checkbox
                checked={settings.analyticsEnabled}
                onChange={(e) => setSettings({ ...settings, analyticsEnabled: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">Crash Reports</h4>
                <p className="text-xs text-text-secondary mt-1">Automatically send crash reports to help fix bugs</p>
              </div>
              <Checkbox
                checked={settings.crashReportsEnabled}
                onChange={(e) => setSettings({ ...settings, crashReportsEnabled: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Language & Region */}
        <Card className="bg-bg-secondary border-border-primary backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <CardTitle>Language & Region</CardTitle>
            </div>
            <CardDescription>Set your preferred language and regional settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium text-text-primary mb-3 block">Display Language</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { code: 'en', name: 'English' },
                  { code: 'es', name: 'Español' },
                  { code: 'fr', name: 'Français' },
                  { code: 'de', name: 'Deutsch' },
                  { code: 'ja', name: '日本語' },
                  { code: 'zh', name: '中文' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code as 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh')}
                    className={`p-3 bg-bg-tertiary rounded-lg border-2 ${
                      settings.language === lang.code ? 'border-primary' : 'border-border-primary'
                    } hover:border-primary/50 transition-all`}
                  >
                    <p className="text-sm font-medium text-text-primary">{lang.name}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card className="bg-bg-secondary border-border-primary backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle>API Configuration</CardTitle>
            </div>
            <CardDescription>Configure AI service endpoints and API keys</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="aiGatewayUrl" className="text-sm font-medium text-text-primary mb-2 block">
                AI Gateway URL
              </label>
              <Input
                id="aiGatewayUrl"
                type="url"
                value={settings.aiGatewayUrl}
                onChange={(e) => setSettings({ ...settings, aiGatewayUrl: e.target.value })}
                placeholder="https://api.example.com"
                className="w-full"
              />
              <p className="text-xs text-text-tertiary mt-2">
                Custom AI Gateway endpoint for routing AI requests (optional)
              </p>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key Management
              </h4>
              <p className="text-xs text-text-secondary mb-3">
                Manage your OpenAI, Meshy AI, and ElevenLabs API keys in your Profile settings
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => useNavigationStore.getState().navigateTo('profile')}
              >
                Go to Profile Settings →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts Info */}
        <Card className="bg-bg-secondary border-border-primary backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-primary" />
              <CardTitle>Keyboard Shortcuts</CardTitle>
            </div>
            <CardDescription>Learn keyboard shortcuts to work faster</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary mb-3">
              Press <kbd className="px-2 py-1 bg-bg-tertiary rounded border border-border-primary text-text-primary font-mono text-xs">?</kbd> anywhere in the app to view all keyboard shortcuts.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Trigger keyboard shortcuts help modal
                const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true })
                window.dispatchEvent(event)
              }}
            >
              View Shortcuts
            </Button>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end items-center gap-4 pt-4 border-t border-border-primary">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              {saveSuccess}
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </div>
          )}
          <Button
            variant="primary"
            className="gap-2"
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}
