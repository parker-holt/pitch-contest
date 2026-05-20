import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { METRICS } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

async function scoreWithGemini(sub: {
  contestantName: string
  teamName: string
  driveLink: string
  notes?: string
}): Promise<{ scores: Record<string, number>; weightedAverage: number; feedback: string }> {
  const metricList = METRICS.map((m, i) => `${i+1}. ${m.name} (weight: ${m.weight*100}%) — ${m.desc}`).join('\n')

  const prompt = `You are an expert sales pitch judge. Watch this video and score the presenter.

CONTESTANT: ${sub.contestantName}
TEAM: ${sub.teamName}
NOTES: ${sub.notes || 'None provided'}

Score each metric from 0–10 (0.5 increments):
${metricList}

SCORING GUIDE:
- 9–10: Exceptional, best-in-class
- 7–8: Strong, compelling with minor gaps
- 5–6: Solid, gets the point across
- 3–4: Developing, key elements weak
- 0–2: Needs significant work

Compute the WEIGHTED average using the weights above.

Return ONLY valid JSON, no markdown:
{
  "scores": {
    ${METRICS.map(m => `"${m.id}": <number 0-10, 0.5 increments>`).join(',\n    ')}
  },
  "weightedAverage": <weighted mean, 1 decimal>,
  "feedback": "<2-3 sentence constructive summary with specific strengths and one area to improve>"
}`

  const fileIdMatch = sub.driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/)
  const fileId = fileIdMatch ? fileIdMatch[1] : null

  let requestBody

  if (fileId) {
    requestBody = {
      contents: [{
        parts: [
          {
            file_data: {
              mime_type: 'video/mp4',
              file_uri: `https://drive.google.com/uc?export=download&id=${fileId}`
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    }
  } else {
    requestBody = {
      contents: [{ parts: [{ text: `Video URL: ${sub.driveLink}\n\n${prompt}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${err}`)
  }

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

  const sub = subSnap.data() as { contestantName: string; teamName: string; driveLink: string; notes?: string }
  await subRef.update({ status: 'scoring' })

  try {
    const result = await scoreWithGemini(sub)
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
    console.error('Gemini scoring failed:', err)
    await subRef.update({ status: 'pending' })
    return NextResponse.json({ error: 'AI scoring failed' }, { status: 500 })
  }
}
