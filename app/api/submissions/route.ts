import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  const { contestantName, teamName, driveLink, notes } = await req.json()
  if (!contestantName || !teamName || !driveLink)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const db = adminDb()
  const contestsSnap = await db.collection('contests').where('isActive', '==', true).limit(1).get()
  if (contestsSnap.empty) return NextResponse.json({ error: 'No active contest' }, { status: 404 })
  const contestId = contestsSnap.docs[0].id
  const ref = await db.collection('submissions').add({
    contestId, contestantName, teamName, driveLink, notes: notes || null,
    aiScore: null, aiBreakdown: null, aiFeedback: null, finalScore: null,
    judgeScoreCount: 0, status: 'pending', submittedAt: FieldValue.serverTimestamp(),
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  fetch(`${appUrl}/api/score-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: ref.id }) }).catch(console.error)
  return NextResponse.json({ success: true, id: ref.id })
}

export async function GET() {
  const db = adminDb()
  const snap = await db.collection('submissions').orderBy('finalScore', 'desc').get()
  return NextResponse.json(snap.docs.map(d => ({ id: d.id, ...d.data(), submittedAt: (d.data().submittedAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() || '' })))
}
