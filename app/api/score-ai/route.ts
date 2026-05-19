import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { adminDb } from '@/lib/firebase-admin'
import { METRICS } from '@/lib/config'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { submissionId } = await req.json()
  if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 })

  const db = adminDb()
  const subRef = db.collection('submissions').doc(submissionId)
  const subSnap = await subRef.get()
  if (!subSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sub = subSnap.data()!
  await subRef.update({ status: 'scoring' })

  const metricList = METRICS.map((m, i) => `${i + 1}. ${m.name} — ${m.desc}`).join('\n')

  const prompt = `You are an expert sales pitch judge evaluating a submission.

CONTESTANT: ${sub.contestantName}
TEAM: ${sub.teamName}
VIDEO: ${sub.driveLink}
NOTES: ${sub.notes || 'None'}

Score each metric 0–10:
${metricList}

GUIDE: 9-10 exceptional, 7-8 strong, 5-6 solid, 3-4 developing, 0-2 needs work.
Use 5–6 as baseline when video unavailable; adjust based on context clues.

Return ONLY valid JSON, no markdown:
{
  "scores": { ${METRICS.map(m => `"${m.id}": <0-10>`).join(', ')} },
  "average": <mean 1 decimal>,
  "feedback": "<2-3 sentence constructive summary>"
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('').replace(/```json|```/g, '').trim()

    const result = JSON.parse(raw)
    const aiScore100 = Math.round(result.average * 10)

    await subRef.update({
      aiScore:     aiScore100,
      aiBreakdown: result.scores,
      aiFeedback:  result.feedback,
      finalScore:  aiScore100,
      status:      'pending',
    })
    return NextResponse.json({ success: true, score: aiScore100 })
  } catch (err) {
    console.error('AI scoring failed:', err)
    await subRef.update({ status: 'pending' })
    return NextResponse.json({ error: 'AI scoring failed' }, { status: 500 })
  }
}
