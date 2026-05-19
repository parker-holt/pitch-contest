'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { METRICS } from '@/lib/config'

type JudgeData = {
  judge: { id: string; name: string; token: string }
  submissions: Array<{
    id: string
    contestant_name: string
    team_name: string
    drive_link: string
    ai_score: number | null
    ai_breakdown: Record<string, number> | null
    ai_feedback: string | null
    status: string
    myScore: { average: number; breakdown: Record<string, number> } | null
  }>
}

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function JudgePanel() {
  const params = useSearchParams()
  const token = params.get('token') || ''

  const [data, setData] = useState<JudgeData | null>(null)
  const [error, setError] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [sliders, setSliders] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [scoreSuccess, setScoreSuccess] = useState(false)

  async function load() {
    if (!token) return
    const res = await fetch(`/api/judge?token=${token}`)
    if (!res.ok) { setError('Invalid or expired judge link.'); return }
    const d: JudgeData = await res.json()
    setData(d)
    if (!currentId && d.submissions.length > 0) {
      setCurrentId(d.submissions[0].id)
    }
  }

  useEffect(() => { load() }, [token])

  useEffect(() => {
    if (!currentId || !data) return
    const sub = data.submissions.find(s => s.id === currentId)
    const existing = sub?.myScore?.breakdown || {}
    const init: Record<string, number> = {}
    METRICS.forEach(m => { init[m.id] = existing[m.id] !== undefined ? existing[m.id] : 5 })
    setSliders(init)
    setScoreSuccess(false)
  }, [currentId, data])

  async function submitScore() {
    if (!currentId || !token) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: currentId, judgeToken: token, breakdown: sliders }),
      })
      if (!res.ok) throw new Error('Failed')
      setScoreSuccess(true)
      await load()
    } catch {
      alert('Failed to submit score. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>No judge token provided.</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>{error}</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Loading...</div>

  const currentSub = data.submissions.find(s => s.id === currentId)
  const avgSlider = Object.values(sliders).length
    ? (Object.values(sliders).reduce((a, b) => a + b, 0) / Object.values(sliders).length).toFixed(1)
    : '—'

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>
      {/* Judge identity card */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#d4e4f5', color: 'var(--navy2)', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {data.judge.name[0]}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{data.judge.name}</div>
          <div style={{ fontSize: 13, color: 'var(--teal)' }}>Contest Judge · Scores saved instantly</div>
        </div>
      </div>

      {/* Submission queue */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: 10 }}>
        Select submission to score
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
        {data.submissions.map(s => (
          <div key={s.id} onClick={() => setCurrentId(s.id)} style={{ background: 'var(--white)', border: `1px solid ${s.id === currentId ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 'var(--rs)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.myScore ? 'var(--teal)' : 'var(--gold)', flexShrink: 0 }} />
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dce6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--navy2)', flexShrink: 0 }}>
              {initials(s.contestant_name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.contestant_name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>{s.team_name}</div>
            </div>
            <div style={{ fontSize: 11.5, color: s.myScore ? 'var(--teal)' : 'var(--gold)' }}>
              {s.myScore ? `✓ ${s.myScore.average.toFixed(1)}/10` : 'Pending'}
            </div>
          </div>
        ))}
        {data.submissions.length === 0 && (
          <p style={{ color: 'var(--tl)', fontSize: 14, padding: '12px 0' }}>No submissions yet.</p>
        )}
      </div>

      {/* Scoring card */}
      {currentSub && (
        <div style={{ background: 'var(--navy-card)', borderRadius: 16, padding: '22px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#24405e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#a0c0dd', flexShrink: 0 }}>
              {initials(currentSub.contestant_name)}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'white' }}>{currentSub.contestant_name}</div>
              <div style={{ fontSize: 13, color: 'rgba(200,218,238,.6)' }}>{currentSub.team_name}</div>
            </div>
          </div>

          <a href={currentSub.drive_link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)', color: 'white', padding: '8px 16px', borderRadius: 'var(--rs)', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
            ▶ Watch Video
          </a>

          {/* AI pre-scores */}
          {currentSub.ai_breakdown && (
            <div style={{ background: 'rgba(62,207,178,.08)', border: '1px solid rgba(62,207,178,.2)', borderRadius: 'var(--rs)', padding: '12px 14px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', marginBottom: 8 }}>🤖 AI pre-score</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {METRICS.map(m => (
                  <div key={m.id} style={{ fontSize: 12, color: 'rgba(200,218,238,.7)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{m.name.split(' ')[0]}</span>
                    <span style={{ fontWeight: 600, color: 'white' }}>{currentSub.ai_breakdown![m.id] ?? '—'}/10</span>
                  </div>
                ))}
              </div>
              {currentSub.ai_feedback && (
                <p style={{ fontSize: 12, color: 'rgba(200,218,238,.6)', marginTop: 8, lineHeight: 1.5 }}>{currentSub.ai_feedback}</p>
              )}
            </div>
          )}

          {/* Metric sliders */}
          {METRICS.map(m => (
            <div key={m.id} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'white' }}>{m.name}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
                  {sliders[m.id] % 1 === 0 ? sliders[m.id] : sliders[m.id]?.toFixed(1)}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 9 }}>{m.desc}</div>
              <input
                type="range" min="0" max="10" step="0.5"
                value={sliders[m.id] ?? 5}
                onChange={e => setSliders(prev => ({ ...prev, [m.id]: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--gold)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,.28)', marginTop: 4 }}>
                <span>0</span><span>5</span><span>10</span>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.05)', borderRadius: 'var(--rs)', padding: '10px 14px', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Your average score</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{avgSlider}/10</span>
          </div>

          <button onClick={submitScore} disabled={submitting} style={{ display: 'block', width: '100%', padding: 14, background: submitting ? '#2aaa91' : 'var(--teal)', color: '#000', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, opacity: submitting ? .8 : 1 }}>
            {submitting ? 'Submitting...' : 'Submit Score'}
          </button>

          {scoreSuccess && (
            <div style={{ background: 'rgba(62,207,178,.12)', border: '1px solid rgba(62,207,178,.3)', borderRadius: 8, padding: 12, marginTop: 12, color: 'var(--teal)', fontSize: 13.5, textAlign: 'center' }}>
              ✓ Score submitted! The leaderboard has been updated.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function JudgePage() {
  return (
    <>
      {/* Judge page has its own minimal header */}
      <div style={{ background: 'var(--navy)', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', fontSize: 12.5, color: '#b8ccdf' }}>
        <span>TruRisk Pitch &amp; Demo Contest</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>
          <div style={{ width: 8, height: 8, background: 'var(--teal)', borderRadius: '50%' }} /> LIVE
        </div>
      </div>
      <div style={{ background: 'var(--navy2)', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: 'linear-gradient(135deg,#3ecfb2,#2a7fc4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="white"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>NIRVANA · Judge Portal</span>
        </div>
      </div>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
        <JudgePanel />
      </Suspense>
    </>
  )
}
