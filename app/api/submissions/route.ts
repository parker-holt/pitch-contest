import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SLACK_CHANNEL = 'C0B5Q9FURFA'
const JUDGE_TOKENS = [
  { name: 'Parker', token: 'vt5xx9j30wq' },
  { name: 'Laura',  token: 'd5y5y2j2lf7' },
  { name: 'Jon',    token: 'fxmlzjkuq0g' },
  { name: 'Tyler',  token: 'ii1nbc5bawe' },
]

async function sendSlackAlert(contestantName: string, teamName: string, driveLink: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pitch-contest.vercel.app'

  const judgeLinks = JUDGE_TOKENS.map(j =>
    `<${appUrl}/leaderboard?token=${j.token}|${j.name}>`
  ).join('  ·  ')

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: SLACK_CHANNEL,
      unfurl_links: false,
      unfurl_media: false,
      text: `🎤 New pitch submitted!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎤 *New pitch submitted!*\n*${contestantName}* · ${teamName}   <${driveLink}|▶ Watch Video>`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Jump to your panel: ${judgeLinks}`
            }
          ]
        }
      ]
    })
  })
}

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

  sendSlackAlert(contestantName, teamName, driveLink).catch(console.error)

  return NextResponse.json({ success: true, id: ref.id })
}

export async function GET() {
  const db = adminDb()
  const snap = await db.collection('submissions').orderBy('finalScore', 'desc').get()
  return NextResponse.json(snap.docs.map(d => ({
    id: d.id, ...d.data(),
    submittedAt: (d.data().submittedAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() || ''
  })))
}
