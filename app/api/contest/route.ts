import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { JUDGE_NAMES } from '@/lib/config'

export async function GET() {
  const db = adminDb()

  // Check for existing active contest
  const snap = await db.collection('contests').where('isActive', '==', true).limit(1).get()

  if (!snap.empty) {
    return NextResponse.json({ id: snap.docs[0].id, ...snap.docs[0].data() })
  }

  // Seed first contest + judges if none exists
  const contestRef = await db.collection('contests').add({
    name:          process.env.NEXT_PUBLIC_CONTEST_NAME || 'TruRisk Pitch & Demo Contest',
    isActive:      true,
    aiWeight:      0.30,
    judgeWeight:   0.70,
    createdAt:     new Date().toISOString(),
  })

  // Seed judges with unique tokens
  for (const name of JUDGE_NAMES) {
    const token = Math.random().toString(36).slice(2, 14)
    await db.collection('judges').add({
      contestId: contestRef.id,
      name,
      token,
      email: '',
    })
  }

  return NextResponse.json({ id: contestRef.id, seeded: true })
}
