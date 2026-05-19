import { NextRequest, NextResponse } from 'next/server'
import { adminDb, recomputeFinalScore } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  const { submissionId, judgeToken, breakdown } = await req.json()
  if (!submissionId || !judgeToken || !breakdown)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const db = adminDb()

  // Validate judge token
  const judgeSnap = await db.collection('judges').where('token', '==', judgeToken).limit(1).get()
  if (judgeSnap.empty)
    return NextResponse.json({ error: 'Invalid judge token' }, { status: 401 })

  const judge = { id: judgeSnap.docs[0].id, ...judgeSnap.docs[0].data() }
  const values = Object.values(breakdown) as number[]
  const average = values.reduce((a, b) => a + b, 0) / values.length

  // Upsert: one score doc per judge+submission combo
  const scoreId = `${submissionId}_${judge.id}`
  await db.collection('scores').doc(scoreId).set({
    submissionId,
    judgeId:    judge.id,
    judgeName:  judge.name,
    breakdown,
    average,
    submittedAt: FieldValue.serverTimestamp(),
  })

  // Recompute final score on the submission
  await recomputeFinalScore(submissionId)

  return NextResponse.json({ success: true, judge: judge.name, average })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const submissionId = searchParams.get('submissionId')
  const judgeToken   = searchParams.get('judgeToken')
  if (!submissionId || !judgeToken)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const db = adminDb()
  const judgeSnap = await db.collection('judges').where('token', '==', judgeToken).limit(1).get()
  if (judgeSnap.empty) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const judgeId = judgeSnap.docs[0].id
  const scoreDoc = await db.collection('scores').doc(`${submissionId}_${judgeId}`).get()
  return NextResponse.json({ score: scoreDoc.exists ? scoreDoc.data() : null })
}
