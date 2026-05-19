import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { AI_WEIGHT, JUDGE_WEIGHT } from './config'

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId:    process.env.FIREBASE_PROJECT_ID,
      clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export function adminDb() {
  getAdminApp()
  return getFirestore()
}

// ── Recompute final score after a judge scores ────────────────
// Called from the scores API route after every upsert.
export async function recomputeFinalScore(submissionId: string) {
  const db = adminDb()

  // Get all scores for this submission
  const scoresSnap = await db
    .collection('scores')
    .where('submissionId', '==', submissionId)
    .get()

  if (scoresSnap.empty) return

  const averages = scoresSnap.docs.map(d => d.data().average as number)
  const judgeAvg = averages.reduce((a, b) => a + b, 0) / averages.length

  const subRef = db.collection('submissions').doc(submissionId)
  const subSnap = await subRef.get()
  const sub = subSnap.data()

  const aiScore = sub?.aiScore ?? null

  const finalScore = aiScore !== null
    ? judgeAvg * JUDGE_WEIGHT * 10 + (aiScore / 10) * AI_WEIGHT * 10
    : judgeAvg * 10

  await subRef.update({
    finalScore:      Math.round(finalScore * 10) / 10,
    judgeScoreCount: averages.length,
    judgeScoreTotal: averages.reduce((a, b) => a + b, 0),
    status:          'scored',
  })
}
