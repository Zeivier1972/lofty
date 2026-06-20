import React from "react"
import { useCurrentFrame, interpolate, Easing } from "remotion"

export const GradientOverlay: React.FC<{ opacity?: number; direction?: "bottom" | "top" | "full" }> = ({
  opacity = 0.55,
  direction = "bottom",
}) => {
  const gradient =
    direction === "top"    ? `linear-gradient(to bottom, rgba(0,0,0,${opacity}), transparent)` :
    direction === "full"   ? `linear-gradient(to bottom, rgba(0,0,0,${opacity * 0.6}), transparent 40%, rgba(0,0,0,${opacity}))` :
                             `linear-gradient(to top, rgba(0,0,0,${opacity}), transparent 60%)`

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: gradient,
      pointerEvents: "none",
    }} />
  )
}

export const FadeIn: React.FC<{ children: React.ReactNode; durationFrames?: number; delay?: number }> = ({
  children,
  durationFrames = 15,
  delay = 0,
}) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [delay, delay + durationFrames], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  return <div style={{ opacity }}>{children}</div>
}

export const FadeOut: React.FC<{ children: React.ReactNode; durationInFrames: number; startFrame?: number }> = ({
  children,
  durationInFrames,
  startFrame = 8,
}) => {
  const frame = useCurrentFrame()
  const fadeIn = interpolate(frame, [0, startFrame], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  return <div style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</div>
}

export const AgentBar: React.FC<{
  name: string
  title: string
  phone: string
  color: string
  delay?: number
}> = ({ name, title, phone, color, delay = 0 }) => {
  const frame = useCurrentFrame()
  const slideUp = interpolate(Math.max(0, frame - delay), [0, 20], [80, 0], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  const opacity = interpolate(Math.max(0, frame - delay), [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  return (
    <div style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      transform: `translateY(${slideUp}px)`,
      opacity,
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        padding: "16px 24px",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontSize: 26,
          fontWeight: 900,
          color: "#fff",
          textTransform: "uppercase",
          letterSpacing: 1.5,
        }}>
          {name}
        </div>
        <div style={{
          fontFamily: "Arial, sans-serif",
          fontSize: 18,
          color: "rgba(255,255,255,0.85)",
          fontWeight: 500,
          marginTop: 2,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: "Arial, sans-serif",
          fontSize: 20,
          color: "#fff",
          fontWeight: 700,
          marginTop: 6,
          letterSpacing: 0.5,
        }}>
          {phone}
        </div>
      </div>
    </div>
  )
}
