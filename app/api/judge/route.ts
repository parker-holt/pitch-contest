import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })
  const db = adminDb()
  const judgeSnap = await db.collection('judges').where('token', '==', token).limit(1).get()
  if (judgeSnap.empty) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const judgeDoc = judgeSnap.docs[0]
  const jd = judgeDoc.data() as { name: string; token: string; contestId: string }
  const subsSnap = await db.collection('submissions').where('contestId', '==', jd.contestId).orderBy('submittedAt', 'asc').get()
  const scoresSnap = await db.collection('scores').where('judgeId', '==', judgeDoc.id).get()
  const myScores: Record<string, { average: number; breakdown: Record<string, number> }> = {}
  scoresSnap.docs.forEach(d => { const x = d.data(); myScores[x.submissionId as string] = { average: x.average as number, breakdown: x.breakdown as Record<string, number> } })
  const submissions = subsSnap.docs.map(d => ({ id: d.id, ...d.data(), submittedAt: (d.data().submittedAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() || '', myScore: myScores[d.id] || null }))
  return NextResponse.json({ judge: { id: judgeDoc.id, name: jd.name, token: jd.token }, submissions })
}
