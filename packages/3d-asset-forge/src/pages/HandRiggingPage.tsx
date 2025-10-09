import { useRef, useCallback, useEffect } from 'react'
import {
  Search, Wand2, Camera, Activity
} from 'lucide-react'
import { ThreeViewerRef } from '../components/shared/ThreeViewer'
import { HandRiggingService, HandRiggingResult } from '../services/hand-rigging/HandRiggingService'
import { SimpleHandRiggingService, SimpleHandRiggingResult } from '../services/hand-rigging/SimpleHandRiggingService'
import { useHandRiggingStore } from '../store'
import type { ProcessingStage } from '../store'
import {
  HandAvatarSelector,
  HandProcessingSteps,
  HandRiggingControls,
  ModelViewer,
  ModelStats,
  RiggingResults,
  DebugImages,
  HelpSection,
  ExportModal
} from '../components/HandRigging'

export function HandRiggingPage() {
  const viewerRef = useRef<ThreeViewerRef>(null)
  const handRiggingService = useRef<HandRiggingService | null>(null)
  const simpleHandRiggingService = useRef<SimpleHandRiggingService | null>(null)

  // Get state and actions from store
  const {
    selectedAvatar,
    modelUrl,
    processingStage,
    leftHandData,
    rightHandData,
    showSkeleton,
    modelInfo,
    riggingResult,
    debugImages,
    showDebugImages,
    useSimpleMode,
    showExportModal,
    setModelUrl,
    setProcessingStage,
    setLeftHandData,
    setRightHandData,
    setError,
    setModelInfo,
    setRiggingResult,
    setServiceInitialized,
    setDebugImages,
    setShowExportModal,
    reset,
    toggleSkeleton,
    getProcessingSteps,
    canExport
  } = useHandRiggingStore()

  // Initialize services
  useEffect(() => {
    const initServices = async () => {
      try {
        console.log('Initializing hand rigging services...')

        if (useSimpleMode) {
          simpleHandRiggingService.current = new SimpleHandRiggingService()
        } else {
          const service = new HandRiggingService()
          await service.initialize()
          handRiggingService.current = service
        }

        setServiceInitialized(true)
        console.log('Hand rigging services initialized')
      } catch (err) {
        console.error('Failed to initialize services:', err)
        setError('Failed to initialize hand rigging service. Please refresh the page.')
      }
    }

    initServices()

    return () => {
      if (handRiggingService.current) {
        handRiggingService.current.dispose()
      }
    }
  }, [useSimpleMode, setServiceInitialized, setError])

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (modelUrl && modelUrl.startsWith('blob:')) {
        URL.revokeObjectURL(modelUrl)
      }
    }
  }, [modelUrl])

  const handleStartProcessing = async () => {
    if (!selectedAvatar || !modelUrl || (!handRiggingService.current && !simpleHandRiggingService.current)) {
      setError('Please select an avatar first')
      return
    }

    setError(null)
    setProcessingStage('idle')
    setLeftHandData(null)
    setRightHandData(null)
    setDebugImages({} as { [key: string]: string | undefined })

    // Artificial delay to show UI state
    await new Promise(resolve => setTimeout(resolve, 500))

    try {
      // Fetch the model data from the already set modelUrl (which points to t-pose if available)
      const response = await fetch(modelUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch avatar model')
      }

      const modelBlob = await response.blob()
      const modelFile = new File([modelBlob], `${selectedAvatar.name}.glb`, { type: 'model/gltf-binary' })

      // Update stages
      const updateStage = (stage: ProcessingStage) => {
        setProcessingStage(stage)
        return new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Simulate stage progression based on service events
      // In a real implementation, the service would emit events
      updateStage('detecting-wrists')

      let result: HandRiggingResult | SimpleHandRiggingResult

      if (useSimpleMode && simpleHandRiggingService.current) {
        // Run the simple rigging process
        result = await simpleHandRiggingService.current.rigHands(modelFile, {
          debugMode: true,
          palmBoneLength: 0.05,    // 5cm palm (reduced from 8cm)
          fingerBoneLength: 0.08   // 8cm fingers (reduced from 10cm)
        })

        // Update UI for simple mode
        updateStage('creating-bones')
        await new Promise(resolve => setTimeout(resolve, 1500))
        updateStage('applying-weights')
        await new Promise(resolve => setTimeout(resolve, 1500))

      } else if (handRiggingService.current) {
        // Run the complex AI-based rigging process
        result = await handRiggingService.current.rigHands(modelFile, {
          debugMode: true,
          minConfidence: 0.7,
          smoothingIterations: 3,
          captureResolution: 512,
          viewerRef: viewerRef  // Pass the viewer reference for better captures
        })

        if ('debugCaptures' in result && result.debugCaptures) {
          setDebugImages(result.debugCaptures as { [key: string]: string | undefined })
        }

        // Update hand data for complex mode
        if ('leftHand' in result && result.leftHand) {
          setLeftHandData({
            fingerCount: result.leftHand.detectionConfidence > 0 ? 5 : 0,
            confidence: result.leftHand.detectionConfidence,
            bonesAdded: result.leftHand.bones ? Object.keys(result.leftHand.bones).length : 0
          })
        }

        if ('rightHand' in result && result.rightHand) {
          setRightHandData({
            fingerCount: result.rightHand.detectionConfidence > 0 ? 5 : 0,
            confidence: result.rightHand.detectionConfidence,
            bonesAdded: result.rightHand.bones ? Object.keys(result.rightHand.bones).length : 0
          })
        }
      } else {
        throw new Error('No service available')
      }

      setRiggingResult(result)

      // Update the model in the viewer with the rigged version
      if (result.riggedModel) {
        const blob = new Blob([result.riggedModel], { type: 'model/gltf-binary' })
        const newUrl = URL.createObjectURL(blob)
        setModelUrl(newUrl)

        // If skeleton was visible, turn it off and on to refresh with new bones
        if (showSkeleton && viewerRef.current) {
          console.log('Refreshing skeleton view to show new bones...')
          // Wait a bit for the model to load, then refresh skeleton
          setTimeout(() => {
            if (viewerRef.current && viewerRef.current.refreshSkeleton) {
              viewerRef.current.refreshSkeleton()
            }
          }, 500)
        }
      }

      updateStage('complete')

    } catch (err) {
      console.error('Hand rigging failed:', err)
      setError(err instanceof Error ? err.message : 'Hand rigging failed')
      setProcessingStage('error')
    }
  }

  const handleModelLoad = useCallback((info: { vertices: number; faces: number; materials: number }) => {
    setModelInfo(info)
  }, [setModelInfo])

  const handleToggleSkeleton = () => {
    if (viewerRef.current) {
      viewerRef.current.toggleSkeleton()
      toggleSkeleton()
    }
  }

  const handleExport = () => {
    if (!riggingResult || !riggingResult.riggedModel) return

    // Create download link
    const blob = new Blob([riggingResult.riggedModel], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // Generate a proper filename
    let filename = 'rigged_model.glb'
    if (selectedAvatar) {
      const baseName = selectedAvatar.name
      // Remove any existing rigged suffix
      const nameWithoutRigged = baseName.replace(/[-_]?rigged$/i, '')
      // Add _rigged suffix and .glb extension
      filename = `${nameWithoutRigged}_rigged.glb`
    }

    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-tertiary p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Configuration */}
          <div className="lg:col-span-4 space-y-6">

            {/* Upload Card with Controls */}
            <HandAvatarSelector />

            {selectedAvatar && (
              <HandRiggingControls onStartProcessing={handleStartProcessing} />
            )}

            {/* Processing Pipeline */}
            <HandProcessingSteps />
          </div>

          {/* Center - 3D Viewer */}
          <div className="lg:col-span-8 space-y-6">
            <ModelViewer
              modelUrl={modelUrl}
              selectedAvatar={selectedAvatar}
              showSkeleton={showSkeleton}
              canExport={canExport()}
              leftHandData={leftHandData}
              rightHandData={rightHandData}
              processingStage={processingStage}
              viewerRef={viewerRef}
              onToggleSkeleton={handleToggleSkeleton}
              onExport={() => setShowExportModal(true)}
              onModelLoad={handleModelLoad}
            />

            {/* Model Stats */}
            <ModelStats modelInfo={modelInfo} />

            {/* Results Card */}
            <RiggingResults riggingResult={riggingResult} />
          </div>
        </div>

        {/* Debug Images */}
        <DebugImages debugImages={debugImages} showDebugImages={showDebugImages} />

        {/* Help Section */}
        <HelpSection useSimpleMode={useSimpleMode} />
      </div>

      {/* Export Modal */}
      <ExportModal
        showModal={showExportModal}
        selectedAvatar={selectedAvatar}
        riggingResult={riggingResult}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />
    </div>
  )
} 