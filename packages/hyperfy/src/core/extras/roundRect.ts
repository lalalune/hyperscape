export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  if (!radius) {
    ctx.rect(x, y, width, height)
    return
  }
  const maxRadius = Math.min(width / 2, height / 2)
  radius = Math.min(radius, maxRadius)
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0) // Top-right
  ctx.lineTo(x + width, y + height - radius)
  ctx.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2) // Bottom-right
  ctx.lineTo(x + radius, y + height)
  ctx.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI) // Bottom-left
  ctx.lineTo(x, y + radius)
  ctx.arc(x + radius, y + radius, radius, Math.PI, (Math.PI * 3) / 2) // Top-left
  ctx.closePath()
}

export function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fillStyle: string | CanvasGradient | CanvasPattern): void {
  ctx.beginPath()
  roundRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = fillStyle
  ctx.fill()
}

export function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, strokeStyle: string | CanvasGradient | CanvasPattern, lineWidth = 1): void {
  ctx.beginPath()
  roundRect(ctx, x, y, width, height, radius)
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

export function imageRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, img: CanvasImageSource, imgX?: number, imgY?: number, imgWidth?: number, imgHeight?: number): void {
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, x, y, width, height, radius)
  ctx.clip()
  // If optional image dimensions are provided, use them
  // This allows for handling objectFit cases where the image dimensions differ from container
  if (imgX !== undefined && imgY !== undefined && imgWidth !== undefined && imgHeight !== undefined) {
    ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight)
  } else {
    // Original behavior - draw image at the same position and size as the container
    ctx.drawImage(img, x, y, width, height)
  }
  ctx.restore()
}
