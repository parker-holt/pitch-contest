import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { METRICS } from '@/lib/config'
import Anthropic from '@anthropic-ai/sdk'

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

  const sub = subSnap.data() as { contestantName: string; teamName: string; driveLink: string }
  await subRef.update({ status: 'scoring' })

  const metricList = METRICS.map((m, i) => `${i+1}. ${m.name} (weight: ${m.weight*100}%) — ${m.desc}`).join('\n')

  const prompt = `You are an expert sales pitch judge. Score this submission.

CONTESTANT: ${sub.contestantName}
TEAM: ${sub.teamName}
VIDEO: ${sub.driveLink}

Score each metric 0–10 (0.5 increments):
${metricList}

Use 5.0 as a neutral baseline. Compute WEIGHTED average.

Return ONLY valid JSON:
{
  "scores": { ${METRICS.map(m => `"${m.id}": 5`).join(', ')} },
  "weightedAverage": 5.0,
  "feedback": "Score pending video review."
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    })
    const raw = msg.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('').replace(/```json|```/g, '').trim()
    const result = JSON.parse(raw) as { scores: Record<string, number>; weightedAverage: number; feedback: string }
    const aiScore100 = Math.round(result.weightedAverage * 10)
    await subRef.update({ aiScore: aiScore100, aiBreakdown: result.scores, aiFeedback: result.feedback, finalScore: aiScore100, status: 'pending' })
    return NextResponse.json({ success: true, score: aiScore100 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('AI scoring failed:', msg)
    await subRef.update({ status: 'pending' })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
