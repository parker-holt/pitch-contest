'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import { METRICS } from '@/lib/config'

type Submission = {
  id: string
  contestantName: string
  teamName: string
  driveLink: string
  aiScore: number | null
  aiBreakdown: Record<string, number> | null
  aiFeedback: string | null
  status: string
  myScore: { average: number; breakdown: Record<string, number> } | null
}

type JudgeData = {
  judge: { id: string; name: string; token: string }
  submissions: Submission[]
}

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function computeWeightedAverage(sliders: Record<string, number>): number {
  return METRICS.reduce((sum, m) => sum + (sliders[m.id] ?? 0) * m.weight, 0)
}

function ScoringPanel({ sub, token, onDone }: { sub: Submission; token: string; onDone: () => void }) {
  const existing = sub.myScore?.breakdown || {}
  const init: Record<string, number> = {}
  METRICS.forEach(m => { init[m.id] = existing[m.id] !== undefined ? existing[m.id] : 5 })
  const [sliders, setSliders] = useState<Record<string, number>>(init)
  const [submitting, setSubmitting] = useState(false)
  const weightedAvg = computeWeightedAverage(sliders)

  async function submitScore() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: sub.id, judgeToken: token, breakdown: sliders }),
      })
      if (!res.ok) throw new Error('Failed')
      onDone()
    } catch { alert('Failed to submit score. Please try again.') }
    finally { setSubmitting(false) }
  }

  return (
    <div style={{ background: 'var(--navy-card)', borderRadius: 16, padding: '22px 24px 24px', marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#24405e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#a0c0dd', flexShrink: 0 }}>
          {initials(sub.contestantName)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>{sub.contestantName}</div>
          <div style={{ fontSize: 12, color: 'rgba(200,218,238,.6)' }}>{sub.teamName}</div>
        </div>
        <a href={sub.driveLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)', color: 'white', padding: '7px 14px', borderRadius: 'var(--rs)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
          ▶ Watch
        </a>
      </div>

      {METRICS.map(m => (
        <div key={m.id} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
              {m.name} <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 400 }}>{m.weight*100}%</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
              {(sliders[m.id] ?? 5) % 1 === 0 ? (sliders[m.id] ?? 5) : (sliders[m.id] ?? 5).toFixed(1)}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>{m.desc}</div>
          <input type="range" min="0" max="10" step="0.5" value={sliders[m.id] ?? 5}
            onChange={e => setSliders(prev => ({ ...prev, [m.id]: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: 'var(--gold)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,.28)', marginTop: 3 }}>
            <span>0</span><span>5</span><span>10</span>
          </div>
        </div>
      ))}

      <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 'var(--rs)', padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Weighted score</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{weightedAvg.toFixed(1)}/10</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {METRICS.map(m => (
            <div key={m.id} style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
              {m.name.split(' ')[0]}: <span style={{ color: 'rgba(255,255,255,.7)' }}>{((sliders[m.id] ?? 0) * m.weight).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDone} style={{ flex: 1, padding: 13, background: 'rgba(255,255,255,.08)', color: 'white', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={submitScore} disabled={submitting} style={{ flex: 2, padding: 13, background: submitting ? '#2aaa91' : 'var(--teal)', color: '#000', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, opacity: submitting ? .8 : 1, cursor: 'pointer', fontFamily: 'inherit' }}>
          {submitting ? 'Submitting...' : sub.myScore ? 'Update Score' : 'Submit Score'}
        </button>
      </div>
    </div>
  )
}

function JudgePanel() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [data, setData] = useState<JudgeData | null>(null)
  const [error, setError] = useState('')
  const [scoringId, setScoringId] = useState<string | null>(null)

  async function load() {
    if (!token) return
    const res = await fetch(`/api/judge?token=${token}`)
    if (!res.ok) { setError('Invalid or expired judge link.'); return }
    const d: JudgeData = await res.json()
    setData(d)
  }

  useEffect(() => { load() }, [token])

  if (!token) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>No judge token provided.</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>{error}</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#d4e4f5', color: 'var(--navy2)', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {data.judge.name[0]}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{data.judge.name}</div>
          <div style={{ fontSize: 13, color: 'var(--teal)' }}>Contest Judge · Scores saved instantly</div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: 10 }}>Submissions</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.submissions.map(s => (
          <div key={s.id}>
            <div style={{ background: 'var(--white)', border: `1px solid ${scoringId === s.id ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.myScore ? 'var(--teal)' : 'var(--gold)', flexShrink: 0 }} />
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dce6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--navy2)', flexShrink: 0 }}>
                {initials(s.contestantName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.contestantName}</div>
                <div style={{ fontSize: 12, color: 'var(--tm)' }}>{s.teamName}</div>
                {s.myScore && scoringId !== s.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                    {METRICS.map(m => (
                      <span key={m.id} style={{ fontSize: 11, color: 'var(--tl)' }}>
                        {m.name.split(' ')[0]}: <span style={{ color: 'var(--td)', fontWeight: 600 }}>{s.myScore!.breakdown[m.id]}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {s.myScore && (
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--td)' }}>{s.myScore.average.toFixed(1)}<span style={{ fontSize: 11, color: 'var(--tl)', fontWeight: 400 }}>/10</span></span>
                )}
                <button
                  onClick={() => setScoringId(scoringId === s.id ? null : s.id)}
                  style={{ padding: '6px 14px', background: s.myScore ? '#f0f2f5' : 'var(--gold)', color: s.myScore ? 'var(--td)' : '#000', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {scoringId === s.id ? 'Close' : s.myScore ? 'Edit' : 'Score'}
                </button>
              </div>
            </div>
            {scoringId === s.id && (
              <ScoringPanel sub={s} token={token} onDone={() => { setScoringId(null); load() }} />
            )}
          </div>
        ))}
        {data.submissions.length === 0 && <p style={{ color: 'var(--tl)', fontSize: 14, padding: '20px 0' }}>No submissions yet.</p>}
      </div>
    </div>
  )
}

export default function JudgePage() {
  return (
    <>
      <Nav />
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
        <JudgePanel />
      </Suspense>
    </>
  )
}
