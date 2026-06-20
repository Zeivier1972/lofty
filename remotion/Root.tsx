import React from "react"
import { Composition } from "remotion"
import { ListingVideo, ListingVideoProps } from "./compositions/ListingVideo"

// Default props for Remotion Studio preview
const DEFAULT_SCENES: ListingVideoProps["scenes"] = [
  {
    name: "Hook",
    scene_type: "hook",
    script: "¡Bienvenidos a esta increíble propiedad en Miami!",
    caption: "JUST LISTED",
    duration_seconds: 4,
    asset_url: "https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg",
    asset_type: "image",
    avatar_present: false,
    ken_burns: "zoom-in",
    caption_style: "headline",
    caption_position: "middle",
  },
  {
    name: "Exterior",
    scene_type: "exterior",
    script: "Fachada de lujo con acabados de primera.",
    caption: "STUNNING EXTERIOR",
    duration_seconds: 5,
    asset_url: "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg",
    asset_type: "image",
    avatar_present: false,
    ken_burns: "pan-right",
    caption_style: "lower-third",
    caption_position: "bottom",
  },
  {
    name: "Living Room",
    scene_type: "living_room",
    script: "Sala de estar abierta y luminosa perfecta para entretener.",
    caption: "OPEN CONCEPT LIVING",
    duration_seconds: 5,
    asset_url: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg",
    asset_type: "image",
    avatar_present: false,
    caption_style: "lower-third",
  },
  {
    name: "Kitchen",
    scene_type: "kitchen",
    script: "Cocina de chef con electrodomésticos de primera.",
    caption: "CHEF'S KITCHEN",
    duration_seconds: 4,
    asset_url: "https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg",
    asset_type: "image",
    avatar_present: false,
    ken_burns: "zoom-in",
    caption_style: "badge",
  },
  {
    name: "CTA",
    scene_type: "cta",
    script: "Llámame hoy. Esta propiedad no va a durar.",
    caption: "CONTACT US TODAY",
    duration_seconds: 5,
    asset_url: "",
    asset_type: "image",
    avatar_present: true,
    caption_style: "kinetic",
  },
]

export const RemotionRoot: React.FC = () => {
  // Calculate total duration in frames (30 fps)
  const fps = 30
  const totalFrames = DEFAULT_SCENES.reduce(
    (sum, s) => sum + Math.round(s.duration_seconds * fps),
    0
  )

  return (
    <>
      <Composition
        id="ListingVideo"
        component={ListingVideo as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={totalFrames}
        fps={fps}
        width={720}
        height={1280}
        defaultProps={{
          scenes: DEFAULT_SCENES,
          agentName: "Catherine Gomez",
          agentTitle: "Real Estate Agent",
          agentPhone: "(305) 555-0100",
          propertyAddress: "1234 Ocean Drive, Miami Beach, FL",
          price: "$1,250,000",
          brandColor: "#FF4D1C",
        }}
      />
    </>
  )
}
