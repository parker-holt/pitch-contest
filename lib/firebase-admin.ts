import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { AI_WEIGHT, JUDGE_WEIGHT } from './config'

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY not set')
  
  const formattedKey = privateKey.includes('\\n') 
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey

  return initializeApp({
    credential: cert({
      projectId:   'trurisk-pitch-demo-contest',
      clientEmail: 'firebase-adminsdk-fbsvc@trurisk-pitch-demo-contest.iam.gserviceaccount.com',
      privateKey:  formattedKey,
    }),
  })
}

export function adminDb() {
  getAdminApp()
  return getFirestore()
}

export async function recomputeFinalScore(submissionId: string) {
  const db = adminDb()
  const scoresSnap = await db.collection('scores').where('submissionId', '==', submissionId).get()
  if (scoresSnap.empty) return
  const averages = scoresSnap.docs.map(d => d.data().average as number)
  const judgeAvg = averages.reduce((a, b) => a + b, 0) / averages.length
  const subRef = db.collection('submissions').doc(submissionId)
  const subSnap = await subRef.get()
  const aiScore = (subSnap.data()?.aiScore as number) ?? null
  const finalScore = aiScore !== null
    ? judgeAvg * JUDGE_WEIGHT * 10 + (aiScore / 10) * AI_WEIGHT * 10
    : judgeAvg * 10
  await subRef.update({
    finalScore: Math.round(finalScore * 10) / 10,
    judgeScoreCount: averages.length,
    status: 'scored',
  })
}
