/**
 * Multi-Agent Store
 *
 * Zustand store for managing multi-agent AI collaboration and playtester swarm state.
 */

import { create } from 'zustand'

import type {
  CollaborationSession,
  PlaytestSession,
  PlaytesterPersonasResponse,
} from '../types/multi-agent'

interface MultiAgentStore {
  // NPC Collaboration State
  collaborations: CollaborationSession[]
  activeCollaboration: CollaborationSession | null
  isCollaborating: boolean
  collaborationError: string | null

  // Playtester Swarm State
  playtestSessions: PlaytestSession[]
  activePlaytest: PlaytestSession | null
  isTesting: boolean
  testError: string | null

  // Playtester Personas (cached from server)
  availablePersonas: PlaytesterPersonasResponse | null
  loadingPersonas: boolean

  // NPC Collaboration Actions
  addCollaboration: (session: CollaborationSession) => void
  setActiveCollaboration: (session: CollaborationSession | null) => void
  deleteCollaboration: (sessionId: string) => void
  setCollaborating: (isCollaborating: boolean) => void
  setCollaborationError: (error: string | null) => void
  clearCollaborations: () => void

  // Playtester Swarm Actions
  addPlaytestSession: (session: PlaytestSession) => void
  setActivePlaytest: (session: PlaytestSession | null) => void
  deletePlaytestSession: (sessionId: string) => void
  setTesting: (isTesting: boolean) => void
  setTestError: (error: string | null) => void
  clearPlaytestSessions: () => void

  // Persona Actions
  setAvailablePersonas: (personas: PlaytesterPersonasResponse) => void
  setLoadingPersonas: (loading: boolean) => void

  // Utility Actions
  reset: () => void
}

const initialState = {
  // NPC Collaboration
  collaborations: [],
  activeCollaboration: null,
  isCollaborating: false,
  collaborationError: null,

  // Playtester Swarm
  playtestSessions: [],
  activePlaytest: null,
  isTesting: false,
  testError: null,

  // Personas
  availablePersonas: null,
  loadingPersonas: false,
}

export const useMultiAgentStore = create<MultiAgentStore>((set) => ({
  ...initialState,

  // NPC Collaboration Actions
  addCollaboration: (session) =>
    set((state) => ({
      collaborations: [session, ...state.collaborations],
      activeCollaboration: session,
    })),

  setActiveCollaboration: (session) =>
    set({ activeCollaboration: session }),

  deleteCollaboration: (sessionId) =>
    set((state) => ({
      collaborations: state.collaborations.filter((c) => c.sessionId !== sessionId),
      activeCollaboration:
        state.activeCollaboration?.sessionId === sessionId
          ? null
          : state.activeCollaboration,
    })),

  setCollaborating: (isCollaborating) =>
    set({ isCollaborating }),

  setCollaborationError: (error) =>
    set({ collaborationError: error }),

  clearCollaborations: () =>
    set({ collaborations: [], activeCollaboration: null }),

  // Playtester Swarm Actions
  addPlaytestSession: (session) =>
    set((state) => ({
      playtestSessions: [session, ...state.playtestSessions],
      activePlaytest: session,
    })),

  setActivePlaytest: (session) =>
    set({ activePlaytest: session }),

  deletePlaytestSession: (sessionId) =>
    set((state) => ({
      playtestSessions: state.playtestSessions.filter((p) => p.sessionId !== sessionId),
      activePlaytest:
        state.activePlaytest?.sessionId === sessionId
          ? null
          : state.activePlaytest,
    })),

  setTesting: (isTesting) =>
    set({ isTesting }),

  setTestError: (error) =>
    set({ testError: error }),

  clearPlaytestSessions: () =>
    set({ playtestSessions: [], activePlaytest: null }),

  // Persona Actions
  setAvailablePersonas: (personas) =>
    set({ availablePersonas: personas }),

  setLoadingPersonas: (loading) =>
    set({ loadingPersonas: loading }),

  // Utility
  reset: () => set(initialState),
}))
