export function borderRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, thickness: number): void {
  // Calculate inset rect that accounts for border width
  const insetLeft = x + thickness / 2
  const insetTop = y + thickness / 2
  const insetWidth = width - thickness
  const insetHeight = height - thickness

  // Adjust radius to account for inset
  const adjustedRadius = Math.max(0, radius - thickness / 2)

  ctx.beginPath()
  // Draw inset rounded rect
  ctx.moveTo(insetLeft + adjustedRadius, insetTop)
  ctx.lineTo(insetLeft + insetWidth - adjustedRadius, insetTop)
  ctx.arcTo(insetLeft + insetWidth, insetTop, insetLeft + insetWidth, insetTop + adjustedRadius, adjustedRadius)
  ctx.lineTo(insetLeft + insetWidth, insetTop + insetHeight - adjustedRadius)
  ctx.arcTo(
    insetLeft + insetWidth,
    insetTop + insetHeight,
    insetLeft + insetWidth - adjustedRadius,
    insetTop + insetHeight,
    adjustedRadius
  )
  ctx.lineTo(insetLeft + adjustedRadius, insetTop + insetHeight)
  ctx.arcTo(insetLeft, insetTop + insetHeight, insetLeft, insetTop + insetHeight - adjustedRadius, adjustedRadius)
  ctx.lineTo(insetLeft, insetTop + adjustedRadius)
  ctx.arcTo(insetLeft, insetTop, insetLeft + adjustedRadius, insetTop, adjustedRadius)
  ctx.closePath()
  ctx.stroke()
}
