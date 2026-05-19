import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { adminDb } from '@/lib/firebase-admin'
import { METRICS } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { submissionId } = await req.json()
  if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
  const db = adminDb()
  const subRef = db.collection('submissions').doc(submissionId)
  const subSnap = await subRef.get()
  if (!subSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const sub = subSnap.data() as { contestantName: string; teamName: string; driveLink: string; notes?: string }
  await subRef.update({ status: 'scoring' })

  const metricList = METRICS.map((m, i) => `${i+1}. ${m.name} (weight: ${m.weight*100}%) — ${m.desc}`).join('\n')

  const prompt = `You are an expert sales pitch judge. Score this submission on each metric from 0–10 (0.5 increments allowed).

CONTESTANT: ${sub.contestantName}
TEAM: ${sub.teamName}
VIDEO: ${sub.driveLink}
NOTES: ${sub.notes || 'None provided'}

SCORING METRICS:
${metricList}

SCORING GUIDE:
- 9–10: Exceptional, best-in-class
- 7–8: Strong, compelling with minor gaps
- 5–6: Solid, gets the point across
- 3–4: Developing, key elements weak
- 0–2: Needs significant work

Compute the WEIGHTED average using the weights above.
Since you cannot watch the video directly, use the notes and context to infer quality. Use 5–6 as a neutral baseline when limited info is available.

Return ONLY valid JSON, no markdown, no preamble:
{
  "scores": {
    ${METRICS.map(m => `"${m.id}": <number 0-10, 0.5 increments>`).join(',\n    ')}
  },
  "weightedAverage": <weighted mean using the metric weights, 1 decimal>,
  "feedback": "<2-3 sentenc
