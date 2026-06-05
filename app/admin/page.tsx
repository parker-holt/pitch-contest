'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { submissionsCol, db, scoresCol } from '@/lib/firebase'
import { getDocs, query, orderBy, where, doc, setDoc, onSnapshot } from 'firebase/firestore'

type Sub = { id: string; contestantName: string; teamName: string; driveLink: string; finalScore: number | null; status: string; submittedAt: string; judgeScoreCount: number }

export default function Admin() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [appUrl, setAppUrl] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [revealIndex, setRevealIndex] = useState(-1)
  const [revealing, setRevealing] = useState(false)

  async function loadData() {
    getDocs(query(submissionsCol())).then(snap => {
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        submittedAt: d.data().submittedAt?.toDate?.()?.toISOString() || ''
      } as Sub))
      // Sort by finalScore descending, nulls last
      data.sort((a, b) => {
        if (a.finalScore === null && b.finalScore === null) return 0
        if (a.finalScore === null) return 1
        if (b.finalScore === null) return -1
        return b.finalScore - a.finalScore
      })
      setSubs(data)
    })
  }

  useEffect(() => {
    setAppUrl(window.location.origin)
    loadData()
    const unsub = onSnapshot(doc(db, 'settings', 'reveal'), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setRevealed(data.revealed ?? false)
        setRevealIndex(data.revealIndex ?? -1)
      }
    })
    return unsub
  }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  async function revealNext() {
    setRevealing(true)
    const next = revealIndex + 1
    await setDoc(doc(db, 'settings', 'reveal'), { revealed: true, revealIndex: next })
    setRevealIndex(next)
    setRevealed(true)
    setRevealing(false)
  }

  async function resetReveal() {
    if (!confirm('Reset the reveal? This will hide all results and show the countdown again.')) return
    await setDoc(doc(db, 'settings', 'reveal'), { revealed: false, revealIndex: -1 })
    setRevealed(false)
    setRevealIndex(-1)
  }

  const ranked = [...subs].filter(s => s.finalScore !== null)
  const top5 = ranked.slice(0, 5)
  const nextToReveal = top5[4 - (revealIndex + 1)]

  const card = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '18px 20px', marginBottom: 20 }
  const sectionTitle = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--tm)', marginBottom: 10, marginTop: 20 }

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>

        <div style={{ ...sectionTitle, marginTop: 0 }}>🎭 Reveal Controls</div>
        <div style={{ ...card, background: revealed ? '#fffdf4' : 'var(--white)', border: `1px solid ${revealed ? '#e0b84a' : 'var(--border)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {!revealed ? '⏳ Countdown mode — results hidden' : revealIndex >= 4 ? '🏆 All results revealed!' : `🎬 Revealing... ${revealIndex + 1} of 5 shown`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--tm)', marginTop: 3 }}>
                {!revealed ? 'Leaderboard shows countdown timer' : nextToReveal && revealIndex < 4 ? `Next: #${5 - revealIndex - 1} — ${nextToReveal.contestantName}` : 'All top 5 revealed'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {revealed && (
                <button onClick={resetReveal} style={{ padding: '8px 16px', background: '#f0f2f5', border: '1px solid var(--border)', color: 'var(--tm)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Reset
                </button>
              )}
              {revealIndex < 4 && (
                <button onClick={revealNext} disabled={revealing} style={{ padding: '10px 20px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: revealing ? 'default' : 'pointer', fontFamily: 'inherit', opacity: revealing ? .7 : 1 }}>
                  {!revealed ? '🎬 Start Reveal' : revealing ? 'Revealing...' : `Reveal #${5 - revealIndex - 1}`}
                </button>
              )}
            </div>
          </div>

          {top5.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tl)', marginBottom: 8 }}>Top 5 reveal order (5th → 1st):</div>
              {[...top5].reverse().map((s, i) => {
                const position = 4 - i
                const isRevealed = revealIndex >= i
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f5f5f5', opacity: isRevealed ? 1 : 0.4 }}>
                    <div style={{ fontSize: 16, minWidth: 28 }}>
                      {isRevealed ? ['🥇','🥈','🥉','4️⃣','5️⃣'][position] : '❓'}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{s.contestantName} · {s.teamName}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isRevealed ? 'var(--td)' : 'var(--tl)' }}>
                      {isRevealed ? (s.finalScore! / 10).toFixed(2) : '?.??'} / 10
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={sectionTitle}>Share links</div>
        <div style={card}>
          {[
            { label: 'Leaderboard', url: `${appUrl}/leaderboard` },
            { label: 'Submit', url: `${appUrl}/submit` },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--tm)', minWidth: 120 }}>{l.label}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--tm)', background: '#f5f7fa', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px' }}>{l.url}</span>
              <button onClick={() => copy(l.url, l.label)} style={{ background: '#f0f2f5', border: '1px solid var(--border)', color: 'var(--tm)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {copied === l.label ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        <div style={sectionTitle}>Submissions ({subs.length}) — sorted by score</div>
        <div style={card}>
          {subs.length === 0 && <p style={{ color: 'var(--tl)', fontSize: 13 }}>No submissions yet.</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            {subs.length > 0 && (
              <thead>
                <tr>
                  {['#', 'Name', 'Team', 'Video', 'Judges', 'Score'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: 'var(--tl)', fontWeight: 500, borderBottom: '1px solid var(--border)', fontSize: 11.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {subs.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5', color: 'var(--tl)', fontSize: 12 }}>
                    {s.finalScore !== null ? `#${i + 1}` : '—'}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5', fontWeight: 500 }}>
                    <a href={s.driveLink} target="_blank" rel="noreferrer" style={{ color: 'var(--td)', textDecoration: 'none' }}>{s.contestantName}</a>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5', color: 'var(--tm)', fontSize: 12 }}>{s.teamName}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5' }}>
                    <a href={s.driveLink} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 12 }}>📁</a>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} style={{ width: 10, height: 10, borderRadius: '50%', background: j < (s.judgeScoreCount || 0) ? 'var(--teal)' : '#e0e0e0' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--tl)', marginTop: 3 }}>{s.judgeScoreCount || 0}/5</div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5', fontWeight: 700, color: s.finalScore !== null ? 'var(--td)' : 'var(--tl)' }}>
                    {s.finalScore !== null ? (s.finalScore / 10).toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
