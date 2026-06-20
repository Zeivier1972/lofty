import React from "react"
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion"

interface CaptionProps {
  text: string
  subtitle?: string
  position?: "top" | "middle" | "bottom"
  style?: "headline" | "lower-third" | "badge" | "kinetic"
  delay?: number
  color?: string
}

export const Caption: React.FC<CaptionProps> = ({
  text,
  subtitle,
  position = "bottom",
  style = "lower-third",
  delay = 0,
  color = "#FF4D1C",
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const adjustedFrame = Math.max(0, frame - delay)
  const slideIn = spring({ frame: adjustedFrame, fps, config: { damping: 24, stiffness: 180 }, durationInFrames: 20 })

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames - 2],
    [1, 0],
    { easing: Easing.ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  )

  const opacity = Math.min(slideIn, fadeOut)

  const positionStyle: React.CSSProperties =
    position === "top"    ? { top: "8%", left: 0, right: 0 } :
    position === "middle" ? { top: "50%", left: 0, right: 0, transform: `translateY(-50%) translateY(${(1 - slideIn) * 30}px)` } :
                            { bottom: "12%", left: 0, right: 0 }

  const translateY = position !== "middle" ? (1 - slideIn) * 40 : 0

  if (style === "headline") {
    return (
      <div style={{
        position: "absolute",
        ...positionStyle,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 32px",
      }}>
        <div style={{
          backgroundColor: color,
          color: "#fff",
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontSize: 52,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 3,
          padding: "12px 28px",
          textAlign: "center",
          lineHeight: 1.1,
          boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        }}>
          {text}
        </div>
        {subtitle && (
          <div style={{
            backgroundColor: "rgba(0,0,0,0.75)",
            color: "#fff",
            fontFamily: "Arial, sans-serif",
            fontSize: 28,
            fontWeight: 600,
            padding: "8px 20px",
            marginTop: 4,
            textAlign: "center",
          }}>
            {subtitle}
          </div>
        )}
      </div>
    )
  }

  if (style === "kinetic") {
    const words = text.split(" ")
    return (
      <div style={{
        position: "absolute",
        ...positionStyle,
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: "0 24px",
        textAlign: "center",
      }}>
        {words.map((word, wi) => {
          const wordDelay = delay + wi * 3
          const wordSpring = spring({
            frame: Math.max(0, frame - wordDelay),
            fps,
            config: { damping: 18, stiffness: 200 },
            durationInFrames: 15,
          })
          return (
            <span key={wi} style={{
              display: "inline-block",
              fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
              fontSize: 58,
              fontWeight: 900,
              textTransform: "uppercase",
              color: wi % 2 === 0 ? "#fff" : color,
              textShadow: "0 3px 12px rgba(0,0,0,0.8)",
              marginRight: 10,
              transform: `scale(${wordSpring}) translateY(${(1 - wordSpring) * 20}px)`,
              lineHeight: 1.15,
            }}>
              {word}
            </span>
          )
        })}
        {subtitle && (
          <div style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 26,
            color: "#fff",
            textShadow: "0 2px 8px rgba(0,0,0,0.9)",
            marginTop: 6,
            fontWeight: 600,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    )
  }

  if (style === "badge") {
    return (
      <div style={{
        position: "absolute",
        ...positionStyle,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        justifyContent: "center",
        padding: "0 32px",
      }}>
        <div style={{
          display: "inline-block",
          border: `4px solid ${color}`,
          color: "#fff",
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontSize: 44,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 4,
          padding: "10px 24px",
          textShadow: "0 2px 8px rgba(0,0,0,0.9)",
          boxShadow: `0 0 0 2px ${color}44`,
        }}>
          {text}
        </div>
      </div>
    )
  }

  // default: lower-third
  return (
    <div style={{
      position: "absolute",
      ...positionStyle,
      opacity,
      transform: `translateY(${translateY}px)`,
      padding: "0 24px",
    }}>
      <div style={{
        display: "inline-block",
        borderLeft: `6px solid ${color}`,
        paddingLeft: 16,
        background: "rgba(0,0,0,0.65)",
        padding: "12px 20px 12px 20px",
        borderLeftWidth: 6,
        borderLeftStyle: "solid",
        borderLeftColor: color,
      }}>
        <div style={{
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontSize: 36,
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#fff",
          letterSpacing: 2,
          lineHeight: 1.1,
        }}>
          {text}
        </div>
        {subtitle && (
          <div style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 22,
            color: color,
            fontWeight: 700,
            marginTop: 4,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
