import React from "react"
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion"

export type KenBurnsEffect = "zoom-in" | "zoom-out" | "pan-right" | "pan-left" | "pan-up" | "zoom-in-right"

interface KenBurnsProps {
  src: string
  durationInFrames: number
  effect?: KenBurnsEffect
  startScale?: number
  endScale?: number
}

const EFFECT_CONFIG: Record<KenBurnsEffect, { startScale: number; endScale: number; startX: number; endX: number; startY: number; endY: number }> = {
  "zoom-in":       { startScale: 1.00, endScale: 1.18, startX:  0,   endX:  0,   startY:  0,  endY:  0 },
  "zoom-out":      { startScale: 1.18, endScale: 1.00, startX:  0,   endX:  0,   startY:  0,  endY:  0 },
  "pan-right":     { startScale: 1.10, endScale: 1.10, startX: -4,   endX:  4,   startY:  0,  endY:  0 },
  "pan-left":      { startScale: 1.10, endScale: 1.10, startX:  4,   endX: -4,   startY:  0,  endY:  0 },
  "pan-up":        { startScale: 1.12, endScale: 1.12, startX:  0,   endX:  0,   startY:  4,  endY: -2 },
  "zoom-in-right": { startScale: 1.00, endScale: 1.14, startX: -3,   endX:  2,   startY:  2,  endY: -2 },
}

export const KenBurns: React.FC<KenBurnsProps> = ({ src, durationInFrames, effect = "zoom-in" }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const cfg = EFFECT_CONFIG[effect]
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  const scale      = interpolate(progress, [0, 1], [cfg.startScale, cfg.endScale])
  const translateX = interpolate(progress, [0, 1], [cfg.startX, cfg.endX])
  const translateY = interpolate(progress, [0, 1], [cfg.startY, cfg.endY])

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      />
    </AbsoluteFill>
  )
}
