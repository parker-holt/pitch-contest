import { NextRequest, NextResponse } from 'next/server'
import { adminDb, recomputeFinalScore } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { METRICS } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { submissionId, judgeToken, breakdown } = await req.json()
  if (!submissionId || !judgeToken || !breakdown)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const db = adminDb()
  const judgeSnap = await db.collection('judges').where('token', '==', judgeToken).limit(1).get()
  if (judgeSnap.empty) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const judge = judgeSnap.docs[0]

  const weightedAverage = METRICS.reduce((sum, m) => sum + (breakdown[m.id] ?? 0) * m.weight, 0)

  await db.collection('scores').doc(`${submissionId}_${judge.id}`).set({
    submissionId,
    judgeId: judge.id,
    judgeName: (judge.data() as { name: string }).name,
    breakdown,
    average: weightedAverage,
    submittedAt: FieldValue.serverTimestamp()
  })
  await recomputeFinalScore(submissionId)
  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const submissionId = searchParams.get('submissionId')
  const judgeToken = searchParams.get('judgeToken')
  if (!submissionId || !judgeToken) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  const db = adminDb()
  const judgeSnap = await db.collection('judges').where('token', '==', judgeToken).limit(1).get()
  if (judgeSnap.empty) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const scoreDoc = await db.collection('scores').doc(`${submissionId}_${judgeSnap.docs[0].id}`).get()
  return NextResponse.json({ score: scoreDoc.exists ? scoreDoc.data() : null })
}
