import { NextRequest, NextResponse } from 'next/server'
import { adminDb, recomputeFinalScore } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  const { submissionId, judgeToken, breakdown } = await req.json()
  if (!submissionId || !judgeToken || !breakdown)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const db = adminDb()
  const judgeSnap = await db.collection('judges').where('token', '==', judgeToken).limit(1).get()
  if (judgeSnap.empty) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const judge = judgeSnap.docs[0]
  const values = Object.values(breakdown) as number[]
  const average = values.reduce((a, b) => a + b, 0) / values.length
  await db.collection('scores').doc(`${submissionId}_${judge.id}`).set({ submissionId, judgeId: judge.id, judgeName: (judge.data() as { name: string }).name, breakdown, average, submittedAt: FieldValue.serverTimestamp() })
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
