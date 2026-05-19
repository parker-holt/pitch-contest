// ── Browser client (safe to expose) ──────────────────────────
import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Prevent duplicate app init in Next.js dev mode
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const db = getFirestore(app)

// ── Collection helpers ────────────────────────────────────────
export const submissionsCol = () => collection(db, 'submissions')
export const scoresCol      = () => collection(db, 'scores')
export const judgesCol      = () => collection(db, 'judges')
export const contestsCol    = () => collection(db, 'contests')

// ── Types ─────────────────────────────────────────────────────
export type Submission = {
  id:               string
  contestId:        string
  contestantName:   string
  teamName:         string
  driveLink:        string
  notes:            string | null
  aiScore:          number | null
  aiBreakdown:      Record<string, number> | null
  aiFeedback:       string | null
  finalScore:       number | null
  judgeScoreCount:  number
  judgeScoreTotal:  number
  status:           'pending' | 'scoring' | 'scored'
  submittedAt:      string
}

export type Score = {
  id:           string
  submissionId: string
  judgeId:      string
  judgeName:    string
  breakdown:    Record<string, number>
  average:      number
  submittedAt:  string
}

export type Judge = {
  id:        string
  contestId: string
  name:      string
  token:     string
}

// ── Live leaderboard listener ─────────────────────────────────
export function subscribeLeaderboard(
  contestId: string,
  callback: (subs: Submission[]) => void
): Unsubscribe {
  const q = query(
    submissionsCol(),
    where('contestId', '==', contestId),
    orderBy('finalScore', 'desc')
  )
  return onSnapshot(q, snap => {
    const subs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission))
    callback(subs)
  })
}

// Re-export Firestore helpers so callers don't need to import firebase directly
export {
  doc, addDoc, setDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  collection,
}
