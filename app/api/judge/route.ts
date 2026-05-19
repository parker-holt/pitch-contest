import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const db = adminDb()

  const judgeSnap = await db.collection('judges').where('token', '==', token).limit(1).get()
  if (judgeSnap.empty) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const judgeDoc = judgeSnap.docs[0]
  const judge = { id: judgeDoc.id, ...judgeDoc.data() }

  // All submissions for this contest
  const subsSnap = await db
    .collection('submissions')
    .where('contestId', '==', judge.contestId)
    .orderBy('submittedAt', 'asc')
    .get()

  // This judge's scores (keyed by submissionId)
  const scoresSnap = await db
    .collection('scores')
    .where('judgeId', '==', judge.id)
    .get()

  const myScores: Record<string, { average: number; breakdown: Record<string, number> }> = {}
  scoresSnap.docs.forEach(d => {
    const data = d.data()
    myScores[data.submissionId] = { average: data.average, breakdown: data.breakdown }
  })

  const submissions = subsSnap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    submittedAt: d.data().submittedAt?.toDate?.()?.toISOString() || '',
    myScore: myScores[d.id] || null,
  }))

  return NextResponse.json({ judge: { id: judge.id, name: judge.name, token }, submissions })
}
