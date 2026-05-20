'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { db, type Submission } from '@/lib/firebase'
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore'
import { TEAMS } from '@/lib/config'

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_BORDER: Record<number, string> = { 0: '#e0b84a', 1: '#b0bec5', 2: '#cd8c50' }

const TEAM_PHOTOS: Record<string, string> = {
  'Kristin Wade':    '/kristinwade.jpeg',
  'Ashley Leabsher': '/ashley laubscher.jpeg',
  'Ashley Estrade':  '/ashley estrada.jpeg',
  'Sean Ireland':    '/seanireland.jpeg',
  'Christin Merkel': '/christinmerkel.jpeg',
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Leaderboard() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function setup() {
      try {
        const contestSnap = await getDocs(query(collection(db, 'contests'), where('isActive', '==', true)))
        if (contestSnap.empty) { setError('No active contest found.'); setLoading(false); return }
        const contestId = contestSnap.docs[0].id
        const q = query(collection(db, 'submissions'), where('contestId', '==', contestId), orderBy('finalScore', 'desc'))
        const unsub = onSnapshot(q, snap => {
          setSubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)))
          setLoading(false)
        }, err => { console.error(err); setError('Failed to load leaderboard.'); setLoading(false) })
        return unsub
      } catch (err) { console.error(err); setError('Failed to connect to database.'); setLoading(false) }
    }
    let unsub: (() => void) | undefined
    setup().then(u => { unsub = u })
    return () => { if (unsub) unsub() }
  }, [])

  const totalScores = subs.reduce((a, s) => a + (s.judgeScoreCount || 0), 0)

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 20px 52px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--navy)', textAlign: 'center', letterSpacing: '-.02em', marginBottom: 7 }}>
          TruRisk Pitch &amp; Demo Contest
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--tm)', fontSize: 14, marginBottom: 4 }}>Live scores update as judges vote</p>
        <p style={{ textAlign: 'center', color: 'var(--tl)', fontSize: 13, marginBottom: 30 }}>
          {subs.length} pitcher{subs.length !== 1 ? 's' : ''} · {totalScores} score{totalScores !== 1 ? 's' : ''} submitted
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
          {TEAMS.map(t => {
            const tsubs = subs.filter(s => s.teamName === t.name)
            const scored = tsubs.filter(s => s.finalScore !== null)
            const avg = scored.length ? (scored.reduce((a, b) => a + (b.finalScore || 0), 0) / scored.length / 10).toFixed(2) : null
            const photo = TEAM_PHOTOS[t.member]
            return (
              <div key={t.name} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '18px 12px 14px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 10px', background: '#dce6f2', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: 'var(--navy2)' }}>
                  {photo
                    ? <img src={photo} alt={t.member} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(t.member)
                  }
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--blue)', lineHeight: 1.3, marginBottom: 2 }}>{t.name.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: 'var(--tm)', marginBottom: 10 }}>({t.member.split(' ')[0]})</div>
                <div style={{ width: 28, height: 3, background: 'var(--gold)', borderRadius: 2, margin: '0 auto 7px' }} />
                {avg ? <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{avg}</div>
                      : <div style={{ fontSize: 12, color: 'var(--tl)', marginBottom: 2 }}>avg score</div>}
                <div style={{ fontSize: 11, color: 'var(--tl)' }}>{scored.length} submission{scored.length !== 1 ? 's' : ''}</div>
              </div>
            )
          })}
        </div>

        {loading && <p style={{ textAlign: 'center', color: 'var(--tl)', padding: 40 }}>Loading...</p>}
        {error && <p style={{ textAlign: 'center', color: '#f87171', padding: 40 }}>{error}</p>}

        {subs.map((s, i) => {
          const ranked = s.finalScore !== null
          const medal = ranked ? (MEDALS[i] || `#${i + 1}`) : '🏅'
          const borderColor = ranked && i < 3 ? MEDAL_BORDER[i] : 'var(--border)'
          return (
            <div key={s.id} style={{ background: i === 0 && ranked ? '#fffdf4' : 'var(--white)', border: `1px solid ${borderColor}`, borderRadius: 'var(--r)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 22, minWidth: 28, textAlign: 'center' }}>{medal}</div>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#dce6f2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--navy2)' }}>
                {initials(s.contestantName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{s.contestantName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--tm)', marginBottom: 4 }}>{s.teamName}</div>
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: '#eef4ff', color: 'var(--blue)', border: '1px solid #c3d9f7' }}>
                  ⚖️ {s.judgeScoreCount || 0}/4 judges
                </span>
              </div>
              <div style={{ textAlign: 'right', minWidth: 70 }}>
                {ranked
                  ? <span style={{ fontSize: 16, fontWeight: 700 }}>{(s.finalScore! / 10).toFixed(2)}<span style={{ fontSize: 12, color: 'var(--tl)', fontWeight: 400 }}> / 10.00</span></span>
                  : <><div style={{ fontSize: 22, color: 'var(--gold)', fontWeight: 700, lineHeight: 1 }}>—</div><div style={{ fontSize: 12, color: 'var(--tl)' }}>/ 10.00</div></>
                }
              </div>
            </div>
          )
        })}
        {!loading && !error && subs.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--tl)', padding: 60, fontSize: 15 }}>No submissions yet — share the submit link to get started!</p>
        )}
      </div>
    </>
  )
}
