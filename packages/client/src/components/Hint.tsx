import React, { createContext, useMemo, useState } from 'react'
import type { HintContextType, HintProviderProps } from '@hyperscape/shared'

export const HintContext = createContext<HintContextType | undefined>(undefined)

export function HintProvider({ children }: HintProviderProps) {
  const [hint, setHint] = useState<string | null>(null)
  const api = useMemo(() => {
    return { hint, setHint }
  }, [hint])
  return <HintContext.Provider value={api}>{children}</HintContext.Provider>
}
