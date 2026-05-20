'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { db, judgesCol, submissionsCol } from '@/lib/firebase'
import { getDocs, query, orderBy } from 'firebase/firestore'

type Judge = { id: string; name: string; token: string }
type Sub = { id: string; contestantName: string; teamName: string; driveLink: string; finalScore: number | null; aiScore: number | null; status: string; submittedAt: string }

export default function Admin() {
  const [judges, setJudges] = useState<Judge[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [rescoring, setRescoring] = useState<string | null>(null)
  const [appUrl, setAppUrl] = useState('')

  async function loadData() {
    getDocs(judgesCol()).then(snap => {
      setJudges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Judge)))
    })
    getDocs(query(submissionsCol(), orderBy('submittedAt', 'desc'))).then(snap => {
      setSubs(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        submittedAt: d.data().submittedAt?.toDate?.()?.toISOString() || ''
      } as Sub)))
    })
  }

  useEffect(() => {
    setAppUrl(window.location.origin)
    loadData()
  }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  async function rescore(submissionId: string) {
    setRescoring(submissionId)
    try {
      const res = await fetch('/api/score-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      })
      if (!res.ok) throw new Error('Failed')
      await loadData()
    } catch {
      alert('Re-scoring failed. Please try again.')
    } finally {
      setRescoring(null)
    }
  }

  const card = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '18px 20px', marginBottom: 20 }
  const sectionTitle = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--tm)', marginBottom: 10, marginTop: 20 }

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ ...sectionTitle, marginTop: 0 }}>Share links</div>
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
          {judges.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tl)', marginBottom: 8 }}>Judge links (private)</div>
              {judges.map(j => {
                const url = `${appUrl}/judge?token=${j.token}`
                return (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--tm)', minWidth: 120 }}>Judge: {j.name}</span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--tm)', background: '#f5f7fa', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                    <button onClick={() => copy(url, j.id)} style={{ background: '#f0f2f5', border: '1px solid var(--border)', color: 'var(--tm)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {copied === j.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={sectionTitle}>Submissions ({subs.length})</div>
        <div style={card}>
          {subs.length === 0 && <p style={{ color: 'var(--tl)', fontSize: 13 }}>No submissions yet.</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            {subs.length > 0 && (
              <thead>
                <tr>
                  {['Name', 'Team', 'Video', 'AI Score', 'Final', 'Re-score'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: 'var(--tl)', fontWeight: 500, borderBottom: '1px solid var(--border)', fontSize: 11.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {subs.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5', fontWeight: 500 }}>{s.contestantName}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5', color: 'var(--tm)', fontSize: 12 }}>{s.teamName}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5' }}>
                    <a href={s.driveLink} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 12 }}>📁 View</a>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5' }}>
                    {s.aiScore !== null
                      ? <span style={{ color: '#1a9e86', fontWeight: 600 }}>🤖 {(s.aiScore / 10).toFixed(1)}/10</span>
                      : <span style={{ color: '#999', fontSize: 12 }}>pending</span>
                    }
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5', fontWeight: 600 }}>
                    {s.finalScore !== null ? (s.finalScore / 10).toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #f0f2f5' }}>
                    <button
                      onClick={() => rescore(s.id)}
                      disabled={rescoring === s.id}
                      style={{ background: rescoring === s.id ? '#e0e0e0' : '#eaf9f6', border: '1px solid #b6ece3', color: rescoring === s.id ? '#999' : '#1a9e86', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: rescoring === s.id ? 'default' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {rescoring === s.id ? '⏳ Scoring...' : '🤖 Re-score'}
                    </button>
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
