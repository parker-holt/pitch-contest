import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { METRICS } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

async function downloadFromDrive(fileId: string): Promise<Uint8Array> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await fetch(url, { headers: { 'Accept': 'video/*' } })
  if (!res.ok) throw new Error(`Failed to download from Drive: ${res.status} ${res.statusText}`)
  const arrayBuffer = await res.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

async function uploadToGemini(videoBytes: Uint8Array, mimeType: string): Promise<string> {
  const numBytes = videoBytes.length
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': numBytes.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'pitch-video' } })
    }
  )
  if (!initRes.ok) throw new Error(`Failed to initiate upload: ${await initRes.text()}`)
  const uploadUrl = initRes.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('No upload URL returned')

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': numBytes.toString(),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: videoBytes
  })
  if (!uploadRes.ok) throw new Error(`Failed to upload file: ${await uploadRes.text()}`)
  const fileData = await uploadRes.json()
  const fileUri = fileData.file?.uri
  if (!fileUri) throw new Error('No file URI returned from Gemini')

  let state = fileData.file?.state
  const fileName = fileData.file?.name
  let attempts = 0
  while (state === 'PROCESSING' && attempts < 30) {
    await new Promise(r => setTimeout(r, 2000))
    const statusRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`)
    const statusData = await statusRes.json()
    state = statusData.state
    attempts++
  }
  if (state !== 'ACTIVE') throw new Error(`File processing failed. State: ${state}`)
  return fileUri
}

async function scoreVideo(fileUri: string, sub: { contestantName: string; teamName: string }): Promise<{ scores: Record<string, number>; weightedAverage: number; feedback: string }> {
  const metricList = METRICS.map((m, i) => `${i+1}. ${m.name} (weight: ${m.weight*100}%) — ${m.desc}`).join('\n')
  const prompt = `You are an expert sales pitch judge. Watch this video carefully and score the presenter.

CONTESTANT: ${sub.contestantName}
TEAM: ${sub.teamName}

Score each metric from 0–10 (0.5 increments allowed):
${metricList}

SCORING GUIDE:
- 9–10: Exceptional, best-in-class
- 7–8: Strong, compelling with minor gaps
- 5–6: Solid, gets the point across
- 3–4: Developing, key elements weak
- 0–2: Needs significant work

Compute the WEIGHTED average using the weights above.

Return ONLY valid JSON, no markdown, no preamble:
{
  "scores": {
    ${METRICS.map(m => `"${m.id}": <number 0-10, 0.5 increments>`).join(',\n    ')}
  },
  "weightedAverage": <weighted mean, 1 decimal>,
  "feedback": "<2-3 sentence constructive summary with specific strengths and one area to improve>"
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { file_data: { mime_type: 'video/mp4', file_uri: fileUri } },
            { text: prompt }
          ]
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    }
  )
  if (!res.ok) throw new Error(`Gemini scoring error: ${await res.text()}`)
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

export async function POST(req: NextRequest) {
  const { submissionId } = await req.json()
  if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 })

  const db = adminDb()
  const subRef = db.collection('submissions').doc(submissionId)
  const subSnap = await subRef.get()
  if (!subSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sub = subSnap.data() as { contestantName: string; teamName: string; driveLink: string }
  await subRef.update({ status: 'scoring' })

  try {
    const fileIdMatch = sub.driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (!fileIdMatch) throw new Error('Invalid Google Drive link.')
    const fileId = fileIdMatch[1]

    console.log(`Downloading video for ${sub.contestantName}...`)
    const videoBytes = await downloadFromDrive(fileId)

    console.log(`Uploading to Gemini File API (${videoBytes.length} bytes)...`)
    const fileUri = await uploadToGemini(videoBytes, 'video/mp4')

    console.log(`Scoring video...`)
    const result = await scoreVideo(fileUri, sub)
    const aiScore100 = Math.round(result.weightedAverage * 10)

    await subRef.update({
      aiScore: aiScore100,
      aiBreakdown: result.scores,
      aiFeedback: result.feedback,
      finalScore: aiScore100,
      status: 'pending'
    })
    return NextResponse.json({ success: true, score: aiScore100 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('AI scoring failed:', msg)
    await subRef.update({ status: 'pending' })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
