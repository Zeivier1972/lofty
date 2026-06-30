import React from "react"
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion"
import { KenBurns, KenBurnsEffect } from "../components/KenBurns"
import { Caption } from "../components/Caption"
import { GradientOverlay, FadeOut, AgentBar } from "../components/Overlay"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemotionScene {
  name: string
  scene_type: string
  script: string
  caption: string
  duration_seconds: number
  asset_url: string            // photo or video URL
  asset_type: "image" | "video"
  avatar_present: boolean
  ken_burns?: KenBurnsEffect
  caption_style?: "headline" | "lower-third" | "badge" | "kinetic"
  caption_position?: "top" | "middle" | "bottom"
}

export interface ListingVideoProps {
  scenes: RemotionScene[]
  agentName: string
  agentTitle: string
  agentPhone: string
  propertyAddress: string
  price: string
  brandColor: string           // hex e.g. "#FF4D1C"
  logoUrl?: string
}

// ─── Ken Burns cycle ──────────────────────────────────────────────────────────

const KB_CYCLE: KenBurnsEffect[] = ["zoom-in", "pan-right", "zoom-out", "pan-left", "zoom-in-right", "pan-up"]

// ─── Photo scene ──────────────────────────────────────────────────────────────

const PhotoScene: React.FC<{
  scene: RemotionScene
  color: string
  effectIndex: number
}> = ({ scene, color, effectIndex }) => {
  const { durationInFrames } = useVideoConfig()
  const effect = scene.ken_burns ?? KB_CYCLE[effectIndex % KB_CYCLE.length]

  return (
    <AbsoluteFill>
      <KenBurns src={scene.asset_url} durationInFrames={durationInFrames} effect={effect} />
      <GradientOverlay direction="full" opacity={0.5} />
      <Caption
        text={scene.caption}
        style={scene.caption_style ?? "lower-third"}
        position={scene.caption_position ?? "bottom"}
        color={color}
        delay={6}
      />
    </AbsoluteFill>
  )
}

// ─── Video (B-roll) scene ─────────────────────────────────────────────────────

const VideoScene: React.FC<{ scene: RemotionScene; color: string }> = ({ scene, color }) => {
  const { durationInFrames } = useVideoConfig()
  return (
    <AbsoluteFill>
      <Video
        src={scene.asset_url}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
        loop
      />
      <GradientOverlay direction="full" opacity={0.45} />
      <Caption
        text={scene.caption}
        style={scene.caption_style ?? "lower-third"}
        position={scene.caption_position ?? "bottom"}
        color={color}
        delay={6}
      />
    </AbsoluteFill>
  )
}

// ─── Avatar (talking head) scene ──────────────────────────────────────────────

const AvatarScene: React.FC<{
  scene: RemotionScene
  agentName: string
  agentTitle: string
  agentPhone: string
  propertyAddress: string
  price: string
  color: string
  isCTA?: boolean
}> = ({ scene, agentName, agentTitle, agentPhone, propertyAddress, price, color, isCTA }) => {
  const { durationInFrames } = useVideoConfig()

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Background: use asset_url if provided (Pexels fallback), else dark */}
      {scene.asset_url && (
        <div style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
          {scene.asset_type === "video" ? (
            <Video src={scene.asset_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted loop />
          ) : (
            <img src={scene.asset_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      )}

      <GradientOverlay direction="full" opacity={0.7} />

      {isCTA ? (
        <>
          <Caption text={scene.caption} style="kinetic" position="top" color={color} delay={4} />
          <FadeOut durationInFrames={durationInFrames}>
            <div style={{
              position: "absolute",
              top: "20%",
              left: 0,
              right: 0,
              padding: "0 28px",
              textAlign: "center",
            }}>
              <div style={{
                fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
                fontSize: 42,
                fontWeight: 900,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: 2,
                lineHeight: 1.2,
                textShadow: "0 2px 12px rgba(0,0,0,0.8)",
              }}>
                {propertyAddress}
              </div>
              {price && (
                <div style={{
                  fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
                  fontSize: 54,
                  fontWeight: 900,
                  color: color,
                  marginTop: 12,
                  textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                }}>
                  {price}
                </div>
              )}
            </div>
          </FadeOut>
          <AgentBar name={agentName} title={agentTitle} phone={agentPhone} color={color} delay={15} />
        </>
      ) : (
        <>
          <Caption text={scene.caption} style="headline" position="top" color={color} delay={4} />
        </>
      )}
    </AbsoluteFill>
  )
}

// ─── Transition flash ─────────────────────────────────────────────────────────

const SceneTransition: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame()
  const opacity =
    frame < 4  ? (frame / 4) :
    frame < 8  ? 1 :
    frame < 16 ? 1 - (frame - 8) / 8 :
    0

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      backgroundColor: color,
      opacity: opacity * 0.6,
      pointerEvents: "none",
    }} />
  )
}

// ─── Main Composition ─────────────────────────────────────────────────────────

export const ListingVideo: React.FC<ListingVideoProps> = ({
  scenes,
  agentName,
  agentTitle,
  agentPhone,
  propertyAddress,
  price,
  brandColor,
}) => {
  const { fps } = useVideoConfig()

  // Calculate cumulative frame offsets
  let offset = 0
  const sceneOffsets: number[] = []
  const sceneDurations: number[] = []

  for (const scene of scenes) {
    sceneOffsets.push(offset)
    const frames = Math.round(scene.duration_seconds * fps)
    sceneDurations.push(frames)
    offset += frames
  }

  let photoEffectCounter = 0

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {scenes.map((scene, i) => {
        const from = sceneOffsets[i]
        const dur  = sceneDurations[i]

        let photoIdx = 0
        if (scene.asset_type === "image") {
          photoIdx = photoEffectCounter++
        }

        const isCTA = scene.scene_type === "cta" || i === scenes.length - 1

        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {scene.avatar_present ? (
              <AvatarScene
                scene={scene}
                agentName={agentName}
                agentTitle={agentTitle}
                agentPhone={agentPhone}
                propertyAddress={propertyAddress}
                price={price}
                color={brandColor}
                isCTA={isCTA}
              />
            ) : scene.asset_type === "video" ? (
              <VideoScene scene={scene} color={brandColor} />
            ) : (
              <PhotoScene scene={scene} color={brandColor} effectIndex={photoIdx} />
            )}
            {/* Flash transition at end of each scene */}
            {i < scenes.length - 1 && (
              <Sequence from={dur - 12} durationInFrames={16}>
                <SceneTransition color={brandColor} />
              </Sequence>
            )}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
