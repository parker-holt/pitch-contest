'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, Suspense } from 'react'

function NavInner() {
  const path = usePathname()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [time, setTime] = useState('')

  useEffect(() => {
    const fmt = () => {
      const n = new Date()
      setTime(`Last refresh: ${n.toLocaleDateString()} ${n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
    }
    fmt()
    const t = setInterval(fmt, 30000)
    return () => clearInterval(t)
  }, [])

  const tokenSuffix = token ? `?token=${token}` : ''

  const tabs = [
    { href: `/leaderboard${tokenSuffix}`, label: '🏆 Leaderboard', match: '/leaderboard' },
    { href: `/submit${tokenSuffix}`,      label: '🎤 Submit',      match: '/submit' },
    ...(token ? [{ href: `/judge?token=${token}`, label: '⚖️ Judge Panel', match: '/judge' }] : []),
    { href: `/admin${tokenSuffix}`,       label: '⚙️ Admin',       match: '/admin' },
  ]

  return (
    <>
      <div style={{ background: 'var(--navy)', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', fontSize: 12.5, color: '#b8ccdf' }}>
        <span>TruRisk Pitch &amp; Demo Contest</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{time}</span>
          <button onClick={() => window.location.reload()} style={{ background: 'var(--gold)', color: '#000', border: 'none', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Refresh
          </button>
          <button onClick={() => downloadCSV()} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: '#b8ccdf', padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ⬇ Download
          </button>
        </div>
      </div>

      <nav style={{ background: 'var(--navy2)', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/White_Logo.png" alt="Nirvana" style={{ height: 32, width: 'auto' }} />
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {tabs.map(tab => (
            <Link key={tab.href} href={tab.href} style={{
              padding: '6px 16px', borderRadius: 20,
              border: path === tab.match ? '1px solid rgba(255,255,255,.32)' : '1px solid transparent',
              color: path === tab.match ? 'white' : 'rgba(255,255,255,.5)',
              fontSize: 13.5, fontWeight: 500, transition: 'all .15s',
            }}>
              {tab.label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'white' }}>
          <div style={{ width: 8, height: 8, background: 'var(--teal)', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          LIVE
        </div>
      </nav>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>
    </>
  )
}

export default function Nav() {
  return (
    <Suspense fallback={
      <div style={{ background: 'var(--navy)', height: 40 }} />
    }>
      <NavInner />
    </Suspense>
  )
}

async function downloadCSV() {
  const res = await fetch('/api/submissions')
  const data = await res.json()
  const rows = [['Name', 'Team', 'Score', 'Status', 'Link']]
  data.forEach((s: { contestantName: string; teamName: string; finalScore: number | null; status: string; driveLink: string }) => {
    rows.push([s.contestantName, s.teamName, s.finalScore ? (s.finalScore / 10).toFixed(2) : '—', s.status, s.driveLink])
  })
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map(r => r.join(',')).join('\n'))
  a.download = 'pitch-scores.csv'
  a.click()
}
