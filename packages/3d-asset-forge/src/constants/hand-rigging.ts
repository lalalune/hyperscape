// MediaPipe Hand landmark indices
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
} as const

// Bone naming conventions for hand rigging
export const HAND_BONE_NAMES = {
  left: {
    wrist: 'Hand_L',
    palm: 'Palm_L',
    thumb: ['Thumb_01_L', 'Thumb_02_L', 'Thumb_03_L'],
    index: ['Index_01_L', 'Index_02_L', 'Index_03_L'],
    middle: ['Middle_01_L', 'Middle_02_L', 'Middle_03_L'],
    ring: ['Ring_01_L', 'Ring_02_L', 'Ring_03_L'],
    pinky: ['Pinky_01_L', 'Pinky_02_L', 'Pinky_03_L']
  },
  right: {
    wrist: 'Hand_R',
    palm: 'Palm_R',
    thumb: ['Thumb_01_R', 'Thumb_02_R', 'Thumb_03_R'],
    index: ['Index_01_R', 'Index_02_R', 'Index_03_R'],
    middle: ['Middle_01_R', 'Middle_02_R', 'Middle_03_R'],
    ring: ['Ring_01_R', 'Ring_02_R', 'Ring_03_R'],
    pinky: ['Pinky_01_R', 'Pinky_02_R', 'Pinky_03_R']
  }
} as const

// Finger joint indices for each finger (using HAND_LANDMARKS values)
export const FINGER_JOINTS = {
  thumb: [HAND_LANDMARKS.THUMB_CMC, HAND_LANDMARKS.THUMB_MCP, HAND_LANDMARKS.THUMB_IP, HAND_LANDMARKS.THUMB_TIP],
  index: [HAND_LANDMARKS.INDEX_MCP, HAND_LANDMARKS.INDEX_PIP, HAND_LANDMARKS.INDEX_DIP, HAND_LANDMARKS.INDEX_TIP],
  middle: [HAND_LANDMARKS.MIDDLE_MCP, HAND_LANDMARKS.MIDDLE_PIP, HAND_LANDMARKS.MIDDLE_DIP, HAND_LANDMARKS.MIDDLE_TIP],
  ring: [HAND_LANDMARKS.RING_MCP, HAND_LANDMARKS.RING_PIP, HAND_LANDMARKS.RING_DIP, HAND_LANDMARKS.RING_TIP],
  pinky: [HAND_LANDMARKS.PINKY_MCP, HAND_LANDMARKS.PINKY_PIP, HAND_LANDMARKS.PINKY_DIP, HAND_LANDMARKS.PINKY_TIP]
} as const

// Type exports
export type HandLandmarkKey = keyof typeof HAND_LANDMARKS
export type HandLandmarkValue = typeof HAND_LANDMARKS[HandLandmarkKey]