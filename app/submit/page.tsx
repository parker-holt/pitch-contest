'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'
import { TEAMS } from '@/lib/config'

export default function Submit() {
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!name.trim() || !team || !link.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    const nameParts = name.trim().split(' ')
    if (nameParts.length < 2 || !nameParts[1]) {
      setError('Please enter your first and last name.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestantName: name.trim(), teamName: team, driveLink: link.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
      setName(''); setTeam(''); setLink('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 'var(--rs)', color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 18, transition: 'border-color .15s' } as React.CSSProperties

  return (
    <>
      <Nav />
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 20px', background: '#e6e9ef', minHeight: 'calc(100vh - 96px)' }}>
        <div style={{ background: 'var(--navy-card)', borderRadius: 18, padding: '32px 30px', width: '100%', maxWidth: 480, height: 'fit-content' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 5 }}>Submit Your Pitch</h1>
          <p style={{ fontSize: 13.5, color: 'rgba(200,220,240,.65)', marginBottom: 26 }}>Record your pitch, then fill in your details below.</p>

          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(200,218,238,.55)', marginBottom: 6 }}>First &amp; Last Name</label>
          <input style={inputStyle} placeholder="First Last" value={name} onChange={e => setName(e.target.value)} />

          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(200,218,238,.55)', marginBottom: 6 }}>Select team</label>
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <select value={team} onChange={e => setTeam(e.target.value)} style={{ ...inputStyle, marginBottom: 0, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Select a team...</option>
              {TEAMS.map(t => <option key={t.name} value={t.name}>{t.name} — {t.member}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)', pointerEvents: 'none' }}>▾</span>
          </div>

          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(200,218,238,.55)', marginBottom: 6 }}>Video link</label>
          <input style={inputStyle} placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.32)', marginTop: -14, marginBottom: 18 }}>
            Paste a link to your pitch video (Google Drive, Loom, etc.)
          </p>

          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 14, background: loading ? '#c4841a' : 'var(--gold)', color: '#000', border: 'none', borderRadius: 22, fontSize: 15, fontWeight: 700, letterSpacing: '.01em', opacity: loading ? .8 : 1, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Submitting...' : 'Submit Pitch →'}
          </button>

          {done && (
            <div style={{ background: 'rgba(62,207,178,.12)', border: '1px solid rgba(62,207,178,.3)', borderRadius: 'var(--rs)', padding: 12, marginTop: 14, color: 'var(--teal)', fontSize: 13.5 }}>
              ✓ Submitted! You&apos;re in the queue — your score will appear on the leaderboard shortly.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
