import { forwardRef } from 'react'

import { ErrorBoundary } from '../common/ErrorBoundary'
import { ThreeViewerErrorFallback } from '../errors'

import ThreeViewer, { ThreeViewerProps, ThreeViewerRef } from './ThreeViewer'

/**
 * SafeThreeViewer - ThreeViewer wrapped with error boundary
 * Use this instead of ThreeViewer directly to prevent 3D rendering errors from crashing the app
 */
export const SafeThreeViewer = forwardRef<ThreeViewerRef, ThreeViewerProps>((props, ref) => {
  return (
    <ErrorBoundary
      fallback={<ThreeViewerErrorFallback />}
      resetKeys={[props.modelUrl, props.assetId]}
    >
      <ThreeViewer ref={ref} {...props} />
    </ErrorBoundary>
  )
})

SafeThreeViewer.displayName = 'SafeThreeViewer'

export default SafeThreeViewer
