/**
 * YouTube Data API v3 — OAuth2 resumable video upload
 * Railway env vars needed:
 *   YOUTUBE_CLIENT_ID      — Google Cloud Console → OAuth2 → Client ID
 *   YOUTUBE_CLIENT_SECRET  — Google Cloud Console → OAuth2 → Client Secret
 */

export interface YouTubeUploadOptions {
  videoUrl: string
  title: string
  description: string
  tags: string[]
  refreshToken: string
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return (data.access_token as string) ?? null
}

export async function uploadVideoToYouTube(opts: YouTubeUploadOptions): Promise<string | null> {
  const { videoUrl, title, description, tags, refreshToken } = opts

  try {
    const accessToken = await refreshAccessToken(refreshToken)
    if (!accessToken) {
      console.error("[youtube-upload] Could not obtain access token")
      return null
    }

    // Download the HeyGen video into memory
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Failed to fetch video: ${videoRes.status}`)
    const videoBuffer = await videoRes.arrayBuffer()

    // Step 1: Initiate resumable upload session
    const metadata = {
      snippet: {
        title: title.slice(0, 100),
        description,
        tags: tags.slice(0, 30),
        categoryId: "26", // Howto & Style
        defaultLanguage: "es",
        defaultAudioLanguage: "es",
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    }

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(videoBuffer.byteLength),
        },
        body: JSON.stringify(metadata),
      }
    )

    if (!initRes.ok) {
      const err = await initRes.text()
      throw new Error(`YouTube init failed (${initRes.status}): ${err}`)
    }

    const uploadUrl = initRes.headers.get("Location")
    if (!uploadUrl) throw new Error("YouTube: no upload URL in Location header")

    // Step 2: Upload video bytes to the resumable session URL
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoBuffer.byteLength),
      },
      body: videoBuffer,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`YouTube upload failed (${uploadRes.status}): ${err}`)
    }

    const data = await uploadRes.json()
    const videoId = data.id as string
    if (!videoId) throw new Error("YouTube: no video ID in response")

    console.log(`[youtube-upload] Uploaded successfully — videoId: ${videoId}`)
    return `https://www.youtube.com/shorts/${videoId}`
  } catch (err) {
    console.error("[youtube-upload] Upload failed:", err)
    return null
  }
}
