import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { JUDGE_NAMES } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const db = adminDb()
  const snap = await db.collection('contests').where('isActive', '==', true).limit(1).get()
  if (snap.empty) {
    const contestRef = await db.collection('contests').add({ name: process.env.NEXT_PUBLIC_CONTEST_NAME || 'TruRisk Pitch & Demo Contest', isActive: true, aiWeight: 0.30, judgeWeight: 0.70, createdAt: new Date().toISOString() })
    for (const name of JUDGE_NAMES) {
      const token = Math.random().toString(36).slice(2, 14)
      await db.collection('judges').add({ contestId: contestRef.id, name, token, email: '' })
    }
    return NextResponse.json({ id: contestRef.id, seeded: true })
  }

  // Reseed judges if none exist
  const contestId = snap.docs[0].id
  const judgesSnap = await db.collection('judges').where('contestId', '==', contestId).get()
  if (judgesSnap.empty) {
    for (const name of JUDGE_NAMES) {
      const token = Math.random().toString(36).slice(2, 14)
      await db.collection('judges').add({ contestId, name, token, email: '' })
    }
    return NextResponse.json({ id: contestId, judgesSeeded: true })
  }

  return NextResponse.json({ id: contestId, ...snap.docs[0].data() })
}
