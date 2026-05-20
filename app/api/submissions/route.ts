import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { contestantName, teamName, driveLink } = await req.json()
  if (!contestantName || !teamName || !driveLink)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const db = adminDb()
  const contestsSnap = await db.collection('contests').where('isActive', '==', true).limit(1).get()
  if (contestsSnap.empty) return NextResponse.json({ error: 'No active contest' }, { status: 404 })
  const contestId = contestsSnap.docs[0].id
  const ref = await db.collection('submissions').add({
    contestId, contestantName, teamName, driveLink, notes: null,
    aiScore: null, aiBreakdown: null, aiFeedback: null, finalScore: null,
    judgeScoreCount: 0, status: 'pending', submittedAt: FieldValue.serverTimestamp(),
  })
  return NextResponse.json({ success: true, id: ref.id })
}

export async function GET() {
  const db = adminDb()
  const snap = await db.collection('submissions').orderBy('finalScore', 'desc').get()
  return NextResponse.json(snap.docs.map(d => ({ id: d.id, ...d.data(), submittedAt: (d.data().submittedAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() || '' })))
}
