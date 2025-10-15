// import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, XIcon } from 'lucide-react'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Curve } from '@hyperscape/shared'
import { downloadFile } from '@hyperscape/shared'
import type { LoadingFile } from '@hyperscape/shared'
import type {
  FieldBtnProps,
  FieldCurveProps,
  FieldFileProps,
  FieldNumberProps,
  FieldRangeProps,
  FieldSwitchProps,
  FieldTextProps,
  FieldTextareaProps,
  FieldToggleProps,
  FieldVec3Props,
  SwitchOption
} from '@hyperscape/shared'
import { hashFile } from '@hyperscape/shared'
import { CurvePane } from './CurvePane'
import { CurvePreview } from './CurvePreview'
import { HintContext } from './Hint'
import { Portal } from './Portal'
import { useUpdate } from './useUpdate'



export function FieldText({ label, hint, placeholder, value, onChange }: FieldTextProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  return (
    <label
      className='field field-text block mb-2 relative'
      onPointerEnter={() => hint && setHint(hint)}
      onPointerLeave={() => hint && setHint(null)}
    >
      <div className='field-label text-[0.8125rem] mb-1.5 opacity-70 font-medium'>{label}</div>
      <input
        type='text'
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm py-1.5 px-2 bg-white/5 border border-white/10 rounded text-white hover:bg-white/10 hover:border-white/20 focus:bg-white/10 focus:border-white/30 focus:outline-none"
        onKeyDown={e => {
          if (e.code === 'Escape') {
            const target = e.target as HTMLInputElement
            target.blur()
          }
        }}
      />
    </label>
  )
}



export function FieldTextarea({ label, hint, placeholder, value, onChange }: FieldTextareaProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    function update() {
      if (!textarea) return
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
    update()
    textarea.addEventListener('input', update)
    return () => {
      textarea.removeEventListener('input', update)
    }
  }, [])
  return (
    <label
      className='field field-textarea block mb-2 relative'
      onPointerEnter={() => hint && setHint(hint)}
      onPointerLeave={() => hint && setHint(null)}
    >
      <div className='field-label text-[0.8125rem] mb-1.5 opacity-70 font-medium'>{label}</div>
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm py-1.5 px-2 bg-white/5 border border-white/10 rounded resize-none min-h-12 text-white hover:bg-white/10 hover:border-white/20 focus:bg-white/10 focus:border-white/30 focus:outline-none"
        onKeyDown={e => {
          if (e.code === 'Escape') {
            const target = e.target as HTMLTextAreaElement
            target.blur()
          }
        }}
      />
    </label>
  )
}



export function FieldSwitch({ label, hint, options, value, onChange }: FieldSwitchProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  const idx = options.findIndex((o: SwitchOption) => o.value === value)
  const prev = () => {
    const newIdx = idx - 1
    if (newIdx < 0) {
      onChange(options[options.length - 1].value)
    } else {
      onChange(options[newIdx].value)
    }
  }
  const next = () => {
    const newIdx = idx + 1
    if (newIdx >= options.length) {
      onChange(options[0].value)
    } else {
      onChange(options[newIdx].value)
    }
  }
  return (
    <div
      className='field field-switch mb-2'
      onPointerEnter={() => hint && setHint(hint)}
      onPointerLeave={() => hint && setHint(null)}
    >
      <div className='field-label text-[0.8125rem] mb-1.5 opacity-70 font-medium'>{label}</div>
      <div className='field-switch-control flex items-center gap-2 text-sm'>
        <div
          className='field-switch-btn w-6 h-6 flex items-center justify-center bg-white/5 border border-white/10 rounded cursor-pointer hover:bg-white/10 hover:border-white/20'
          onClick={prev}
        >
          ‹
        </div>
        <div className='field-switch-value flex-1 text-center'>{options[idx]?.label || ''}</div>
        <div
          className='field-switch-btn w-6 h-6 flex items-center justify-center bg-white/5 border border-white/10 rounded cursor-pointer hover:bg-white/10 hover:border-white/20'
          onClick={next}
        >
          ›
        </div>
      </div>
    </div>
  )
}



export function FieldToggle({ label, hint, trueLabel = 'Yes', falseLabel = 'No', value, onChange }: FieldToggleProps) {
  return (
    <FieldSwitch
      label={label}
      hint={hint}
      options={[
        { label: falseLabel, value: false },
        { label: trueLabel, value: true },
      ]}
      value={value}
      onChange={(val: unknown) => onChange(val as boolean)}
    />
  )
}



export function FieldRange({ label, hint, min = 0, max = 1, step = 0.05, instant, value, onChange }: FieldRangeProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  const trackRef = useRef<HTMLDivElement | null>(null)
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value)
  const [sliding, setSliding] = useState(false)
  useEffect(() => {
    if (!sliding && local !== value) setLocal(value)
  }, [sliding, value, local])
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    function calculateValueFromPointer(e: PointerEvent, trackElement: HTMLElement) {
      const rect = trackElement.getBoundingClientRect()
      const position = (e.clientX - rect.left) / rect.width
      const rawValue = min + position * (max - min)
      // Round to nearest step
      const steppedValue = Math.round(rawValue / step) * step
      // Clamp between min and max
      return Math.max(min, Math.min(max, steppedValue))
    }
    let sliding = false
    function onPointerDown(e: PointerEvent) {
      sliding = true
      setSliding(true)
      const newValue = calculateValueFromPointer(e, e.currentTarget as HTMLElement)
      setLocal(newValue)
      if (instant) onChange(newValue)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    function onPointerMove(e: PointerEvent) {
      if (!sliding) return
      const newValue = calculateValueFromPointer(e, e.currentTarget as HTMLElement)
      setLocal(newValue)
      if (instant) onChange(newValue)
    }
    function onPointerUp(e: PointerEvent) {
      if (!sliding) return
      sliding = false
      setSliding(false)
      const finalValue = calculateValueFromPointer(e, e.currentTarget as HTMLElement)
      setLocal(finalValue)
      onChange(finalValue)
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    }
    track.addEventListener('pointerdown', onPointerDown)
    track.addEventListener('pointermove', onPointerMove)
    track.addEventListener('pointerup', onPointerUp)
    return () => {
      track.removeEventListener('pointerdown', onPointerDown)
      track.removeEventListener('pointermove', onPointerMove)
      track.removeEventListener('pointerup', onPointerUp)
    }
  }, [min, max, step, instant, onChange])
  const barWidthPercentage = ((local - min) / (max - min)) * 100 + ''
  const text = useMemo(() => {
    const num = local
    const decimalDigits = (num.toString().split('.')[1] || '').length
    if (decimalDigits <= 2) {
      return num.toString()
    }
    return num.toFixed(2)
  }, [local])
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div
      className={`fieldrange flex items-center h-10 px-4 ${isHovered ? 'bg-white/[0.03]' : 'bg-transparent'}`}
      onPointerEnter={() => {
        hint && setHint(hint)
        setIsHovered(true)
      }}
      onPointerLeave={() => {
        hint && setHint(null)
        setIsHovered(false)
      }}
    >
      <div className='fieldrange-label flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-[0.9375rem] text-white/60 pr-4'>{label}</div>
      <div className={`fieldrange-text text-[0.7rem] font-medium text-white/60 mr-2 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>{text}</div>
      <div className='fieldrange-track w-28 shrink-0 h-2 rounded-sm flex items-stretch bg-white/10 cursor-pointer' ref={trackRef}>
        <div 
          className='fieldrange-bar bg-white rounded-sm'
          style={{ width: `${barWidthPercentage}%` }}
        />
      </div>
    </div>
  )
}

export const fileKinds = {
  avatar: {
    type: 'avatar',
    accept: '.vrm',
    exts: ['vrm'],
    placeholder: 'vrm',
  },
  emote: {
    type: 'emote',
    accept: '.glb',
    exts: ['glb'],
    placeholder: 'glb',
  },
  model: {
    type: 'model',
    accept: '.glb',
    exts: ['glb'],
    placeholder: 'glb',
  },
  texture: {
    type: 'texture',
    accept: '.jpg,.jpeg,.png,.webp',
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    placeholder: 'jpg,png,webp',
  },
  image: {
    type: 'image',
    accept: '.jpg,.jpeg,.png,.webp',
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    placeholder: 'jpg,png,webp',
  },
  video: {
    type: 'video',
    accept: '.mp4',
    exts: ['mp4'],
    placeholder: 'mp4',
  },
  hdr: {
    type: 'hdr',
    accept: '.hdr',
    exts: ['hdr'],
    placeholder: 'hdr',
  },
  audio: {
    type: 'audio',
    accept: '.mp3',
    exts: ['mp3'],
    placeholder: 'mp3',
  },
}



export function FieldFile({ world, label, hint, kind: kindName, value, onChange }: FieldFileProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState<LoadingFile | null>(null)
  const kind = fileKinds[kindName]
  if (!kind) return null // invalid?
  const set = async e => {
    // trigger input rebuild
    const n = ++nRef.current
    update()
    // get file
    const file = e.target.files[0]
    if (!file) return
    // check ext
    const ext = file.name.split('.').pop().toLowerCase()
    if (!kind.exts.includes(ext)) {
      return console.error(`attempted invalid file extension for ${String(kindName)}: ${ext}`)
    }
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.${ext}`
    // canonical url to this file
    const url = `asset://${filename}`
    // show loading
    const newValue: LoadingFile = {
      type: kind.type,
      name: file.name,
      url,
    }
    setLoading(newValue)
    // Upload file - strong type assumption that network has upload method
    const networkWithUpload = world.network as { upload: (file: File) => Promise<unknown> }
    await networkWithUpload.upload(file)
    // ignore if new value/upload
    if (nRef.current !== n) return
    // cache file locally so this client can insta-load it
    if (world.loader) {
      world.loader.insert(kind.type, url, file)
    }
    // apply!
    setLoading(null)
    onChange(newValue)
  }
  const remove = e => {
    e.preventDefault()
    e.stopPropagation()
    onChange(null)
  }
  const handleDownload = e => {
    const fileValue = value as { url?: string; name?: string } | null
    if (e.shiftKey && fileValue?.url && world.loader) {
      e.preventDefault()
      const file = world.loader.getFile(fileValue.url, fileValue.name)
      if (!file) return
      downloadFile(file)
    }
  }
  const n = nRef.current
  const fileValue = value as { name?: string } | null
  const name = loading?.name || fileValue?.name
  return (
    <label
      className='fieldfile flex items-center h-10 px-4 overflow-hidden'
      onPointerEnter={() => hint && setHint(hint)}
      onPointerLeave={() => hint && setHint(null)}
      onClick={handleDownload}
    >
      <div className='fieldfile-label flex-1 whitespace-nowrap overflow-hidden text-ellipsis pr-4 text-[0.9375rem] text-white/60'>{label}</div>
      {!value && !loading && <div className='fieldfile-placeholder text-white/30'>{kind.placeholder}</div>}
      {name && <div className='fieldfile-name text-[0.9375rem] text-right whitespace-nowrap overflow-hidden text-ellipsis max-w-36'>{name}</div>}
      {!!value && !loading && (
        <div 
          className='fieldfile-x leading-none -mr-0.5 ml-1 text-white/30 hover:text-white cursor-pointer' 
          onClick={remove}
        >
          ×
        </div>
      )}
      {loading && (
        <div className='fieldfile-loading -mr-px ml-1 flex items-center justify-center'>
          ⟳
        </div>
      )}
      <input key={n} type='file' onChange={set} accept={kind.accept} />
    </label>
  )
}



export function FieldNumber({
  label,
  hint,
  dp = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  bigStep = 2,
  value,
  onChange,
}: FieldNumberProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value.toFixed(dp))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused && local !== value.toFixed(dp)) setLocal(value.toFixed(dp))
  }, [focused, value, local, dp])
  const setTo = (str: string) => {
    // Parse math expression - eval returns a number
    let num = (0, eval)(str) as number
    if (num < min || num > max) {
      num = value
    }
    setLocal(num.toFixed(dp))
    onChange(+num.toFixed(dp))
  }
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <label
      className={`fieldnumber flex items-center h-10 px-4 cursor-text ${isHovered ? 'bg-white/[0.03]' : 'bg-transparent'}`}
      onPointerEnter={() => {
        hint && setHint(hint)
        setIsHovered(true)
      }}
      onPointerLeave={() => {
        hint && setHint(null)
        setIsHovered(false)
      }}
    >
      <div className='fieldnumber-label w-[9.4rem] shrink-0 whitespace-nowrap overflow-hidden text-ellipsis text-[0.9375rem] text-white/60'>{label}</div>
      <div className='fieldnumber-field flex-1'>
        <input
          type='text'
          value={local}
          onChange={e => setLocal(e.target.value)}
          className="text-[0.9375rem] h-4 text-right overflow-hidden cursor-inherit bg-transparent border-none text-white w-full focus:outline-none"
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              setTo((value + amount).toString())
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              setTo((value - amount).toString())
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
            setFocused(false)
            // if blank, set back to original
            if (local === '') {
              setLocal(value.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            setTo(local)
          }}
        />
      </div>
    </label>
  )
}



export function FieldVec3({
  label,
  hint,
  dp = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  bigStep = 2,
  value,
  onChange,
}: FieldVec3Props) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  const valueX = value?.[0] || 0
  const valueY = value?.[1] || 0
  const valueZ = value?.[2] || 0
  const [localX, setLocalX] = useState(valueX.toFixed(dp))
  const [localY, setLocalY] = useState(valueY.toFixed(dp))
  const [localZ, setLocalZ] = useState(valueZ.toFixed(dp))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) {
      if (localX !== valueX.toFixed(dp)) setLocalX(valueX.toFixed(dp))
      if (localY !== valueY.toFixed(dp)) setLocalY(valueY.toFixed(dp))
      if (localZ !== valueZ.toFixed(dp)) setLocalZ(valueZ.toFixed(dp))
    }
  }, [focused, valueX, valueY, valueZ, localX, localY, localZ, dp])
  const parseStr = (str: string) => {
    // Parse math expression - eval returns a number
    let num = (0, eval)(str) as number
    if (num < min || num > max) {
      num = 0
    }
    return num
  }
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <label
      className={`fieldvec3 flex items-center h-10 px-4 cursor-text ${isHovered ? 'bg-white/[0.03]' : 'bg-transparent'}`}
      onPointerEnter={() => {
        hint && setHint(hint)
        setIsHovered(true)
      }}
      onPointerLeave={() => {
        hint && setHint(null)
        setIsHovered(false)
      }}
    >
      <div className='fieldvec3-label w-[9.4rem] shrink-0 whitespace-nowrap overflow-hidden text-ellipsis text-[0.9375rem] text-white/60'>{label}</div>
      <div className='fieldvec3-field flex-1 flex items-center gap-2'>
        <input
          type='text'
          value={localX}
          onChange={e => setLocalX(e.target.value)}
          className="text-[0.9375rem] h-4 text-right overflow-hidden cursor-inherit bg-transparent border-none text-white flex-1 focus:outline-none"
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueX + amount).toString())
              setLocalX(num.toFixed(dp))
              onChange([+num.toFixed(dp), valueY, valueZ])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueX - amount).toString())
              setLocalX(num.toFixed(dp))
              onChange([+num.toFixed(dp), valueY, valueZ])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
            setFocused(false)
            // if blank, set back to original
            if (localX === '') {
              setLocalX(valueX.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            const num = parseStr(localX)
            setLocalX(num.toFixed(dp))
            onChange([+num.toFixed(dp), valueY, valueZ])
          }}
        />
        <input
          type='text'
          value={localY}
          onChange={e => setLocalY(e.target.value)}
          className="text-[0.9375rem] h-4 text-right overflow-hidden cursor-inherit bg-transparent border-none text-white flex-1 focus:outline-none"
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueY + amount).toString())
              setLocalY(num.toFixed(dp))
              onChange([valueX, +num.toFixed(dp), valueZ])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueY - amount).toString())
              setLocalY(num.toFixed(dp))
              onChange([valueX, +num.toFixed(dp), valueZ])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
            setFocused(false)
            // if blank, set back to original
            if (localY === '') {
              setLocalY(valueY.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            const num = parseStr(localY)
            setLocalY(num.toFixed(dp))
            onChange([valueX, +num.toFixed(dp), valueZ])
          }}
        />
        <input
          type='text'
          value={localZ}
          onChange={e => setLocalZ(e.target.value)}
          className="text-[0.9375rem] h-4 text-right overflow-hidden cursor-inherit bg-transparent border-none text-white flex-1 focus:outline-none"
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.code === 'ArrowUp') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueZ + amount).toString())
              setLocalZ(num.toFixed(dp))
              onChange([valueX, valueY, +num.toFixed(dp)])
            }
            if (e.code === 'ArrowDown') {
              const amount = e.shiftKey ? bigStep : step
              const num = parseStr((valueZ - amount).toString())
              setLocalZ(num.toFixed(dp))
              onChange([valueX, valueY, +num.toFixed(dp)])
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={_e => {
            setFocused(false)
            // if blank, set back to original
            if (localZ === '') {
              setLocalZ(valueZ.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            const num = parseStr(localZ)
            setLocalZ(num.toFixed(dp))
            onChange([valueX, valueY, +num.toFixed(dp)])
          }}
        />
      </div>
    </label>
  )
}



export function FieldCurve({ label, hint, x, xRange, y, yMin, yMax, value, onChange }: FieldCurveProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  const curve = useMemo(() => new Curve().deserialize(value || '0,0.5,0,0|1,0.5,0,0'), [value])
  const [edit, setEdit] = useState<Curve | false>(false)
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div
      className={`fieldcurve cursor-pointer ${isHovered ? 'bg-white/[0.03]' : 'bg-transparent'}`}
    >
      <div
        className='fieldcurve-control flex items-center h-10 px-4'
        onClick={() => {
          if (edit) {
            setEdit(false)
          } else {
            setEdit(curve.clone())
          }
        }}
        onPointerEnter={() => {
          hint && setHint(hint)
          setIsHovered(true)
        }}
        onPointerLeave={() => {
          hint && setHint(null)
          setIsHovered(false)
        }}
      >
        <div className='fieldcurve-label flex-1 whitespace-nowrap overflow-hidden text-ellipsis pr-4 text-[0.9375rem] text-white/60'>{label}</div>
        <div className='fieldcurve-curve w-24 h-5 relative'>
          <CurvePreview curve={curve} yMin={yMin} yMax={yMax} />
        </div>
      </div>
      {edit && (
        <Portal>
          <CurvePane
            curve={edit as Curve}
            xLabel={x}
            xRange={[0, xRange || 1]}
            yLabel={y}
            yMin={yMin}
            yMax={yMax}
            onCommit={() => {
              onChange((edit as Curve).serialize())
              setEdit(false)
            }}
            onCancel={() => {
              setEdit(false)
            }}
          />
        </Portal>
      )}
    </div>
  )
}



export function FieldBtn({ label, note, hint, nav, onClick }: FieldBtnProps) {
  const hintContext = useContext(HintContext)
  if (!hintContext) {
    throw new Error('HintContext not found')
  }
  const setHint = hintContext.setHint
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div
      className={`fieldbtn flex items-center h-10 px-4 cursor-pointer ${isHovered ? 'bg-white/[0.03]' : 'bg-transparent'}`}
      onPointerEnter={() => {
        hint && setHint(hint)
        setIsHovered(true)
      }}
      onPointerLeave={() => {
        hint && setHint(null)
        setIsHovered(false)
      }}
      onClick={onClick}
    >
      <div className='fieldbtn-label flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-[0.9375rem] text-white/60'>{label}</div>
      {note && <div className='fieldbtn-note text-[0.9375rem] text-white/40'>{note}</div>}
      {nav && <span className="text-2xl">›</span>}
    </div>
  )
}
