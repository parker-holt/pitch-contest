'use client'
import { useEffect, useState, useRef } from 'react'
import Nav from '@/components/Nav'
import { db, type Submission } from '@/lib/firebase'
import { collection, query, where, orderBy, onSnapshot, getDocs, doc } from 'firebase/firestore'
import { TEAMS } from '@/lib/config'

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
const MEDAL_BORDER: Record<number, string> = { 0: '#e0b84a', 1: '#b0bec5', 2: '#cd8c50' }

const TEAM_PHOTOS: Record<string, string> = {
  'Kristin Wade':    '/kristinwade.jpeg',
  'Ashley Leabsher': '/ashley laubscher.jpeg',
  'Ashley Estrade':  '/ashley estrada.jpeg',
  'Sean Ireland':    '/seanireland.jpeg',
  'Christin Merkel': '/christinmerkel.jpeg',
}

const REVEAL_DATE = new Date('2026-06-10T01:30:00Z')

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, done: false })
  useEffect(() => {
    const tick = () => {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true }); return }
      setTimeLeft({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        done: false
      })
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [target])
  return timeLeft
}

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const colors = ['#f5a623', '#3ecfb2', '#3a7bd5', '#ff6b6b', '#ffd93d', '#ffffff']
    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width, y: -20,
      vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4, rotation: Math.random() * 360, vr: (Math.random() - 0.5) * 5,
    }))
    let frame: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rotation += p.vr
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180)
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      })
      frame = requestAnimationFrame(animate)
    }
    animate()
    const t = setTimeout(() => cancelAnimationFrame(frame), 6000)
    return () => { cancelAnimationFrame(frame); clearTimeout(t) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }} />
}

export default function Leaderboard() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [revealIndex, setRevealIndex] = useState(-1)
  const [showConfetti, setShowConfetti] = useState(false)
  const countdown = useCountdown(REVEAL_DATE)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'reveal'), snap => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.revealed) {
          setRevealed(true)
          setRevealIndex(data.revealIndex ?? -1)
          if (data.revealIndex >= 4) setShowConfetti(true)
        } else {
          setRevealed(false)
          setRevealIndex(-1)
          setShowConfetti(false)
        }
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    async function setup() {
      try {
        const contestSnap = await getDocs(query(collection(db, 'contests'), where('isActive', '==', true)))
        if (contestSnap.empty) { setLoading(false); return }
        const contestId = contestSnap.docs[0].id
        const q = query(collection(db, 'submissions'), where('contestId', '==', contestId), orderBy('finalScore', 'desc'))
        const unsub = onSnapshot(q, snap => {
          setSubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)))
          setLoading(false)
        })
        return unsub
      } catch { setLoading(false) }
    }
    let unsub: (() => void) | undefined
    setup().then(u => { unsub = u })
    return () => { if (unsub) unsub() }
  }, [])

  const totalScores = subs.reduce((a, s) => a + (s.judgeScoreCount || 0), 0)
  const ranked = [...subs].filter(s => s.finalScore !== null)
  const top5Reversed = ranked.slice(0, 5).reverse()

  return (
    <>
      <Nav />
      {showConfetti && <Confetti />}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 20px 52px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--navy)', textAlign: 'center', letterSpacing: '-.02em', marginBottom: 7 }}>
          TruRisk Pitch &amp; Demo Contest
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--tm)', fontSize: 14, marginBottom: 4 }}>Scores are being updated by the judges</p>
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
                  {photo ? <img src={photo} alt={t.member} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(t.member)}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--blue)', lineHeight: 1.3, marginBottom: 2 }}>{t.name.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: 'var(--tm)', marginBottom: 10 }}>({t.member.split(' ')[0]})</div>
                <div style={{ width: 28, height: 3, background: 'var(--gold)', borderRadius: 2, margin: '0 auto 7px' }} />
                {revealed && avg ? <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{avg}</div>
                  : <div style={{ fontSize: 12, color: 'var(--tl)', marginBottom: 2 }}>avg score</div>}
                <div style={{ fontSize: 11, color: 'var(--tl)' }}>{scored.length} submission{scored.length !== 1 ? 's' : ''}</div>
              </div>
            )
          })}
        </div>

        {loading && <p style={{ textAlign: 'center', color: 'var(--tl)', padding: 40 }}>Loading...</p>}

        {!revealed && !loading && (
          <div style={{ textAlign: 'center', padding: '52px 24px', background: 'linear-gradient(135deg, #0d1b2e 0%, #162236 100%)', borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(245,166,35,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ fontSize: 56, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>🏆</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 8, letterSpacing: '-.02em' }}>
              Results revealed at the offsite!
            </div>
            <div style={{ fontSize: 15, color: 'rgba(200,218,238,.6)', marginBottom: 44 }}>
              📍 Tuesday night · New Orleans
            </div>
            {countdown.done ? (
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', animation: 'pulse2 1.2s ease-in-out infinite', marginBottom: 8 }}>🎉 It&apos;s time!</div>
                <div style={{ fontSize: 16, color: 'rgba(200,218,238,.7)' }}>The winner is about to be revealed...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                {[
                  { val: countdown.days,    label: 'Days' },
                  { val: countdown.hours,   label: 'Hours' },
                  { val: countdown.minutes, label: 'Minutes' },
                  { val: countdown.seconds, label: 'Seconds' },
                ].map(({ val, label }, i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '16px 20px', minWidth: 80, textAlign: 'center' }}>
                      <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
                        {String(val).padStart(2, '0')}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(200,218,238,.45)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{label}</div>
                    </div>
                    {i < 3 && <div style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,.2)', margin: '0 4px', paddingBottom: 24 }}>:</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 44, fontSize: 13, color: 'rgba(200,218,238,.35)' }}>
              Scores are being finalized · {subs.length} pitches submitted · {totalScores} judge scores cast
            </div>
          </div>
        )}

        {revealed && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              {revealIndex < 4
                ? <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tm)' }}>Revealing #{5 - revealIndex} of 5...</div>
                : <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>🏆 Final Results!</div>
              }
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {top5Reversed.map((s, i) => {
                const position = 4 - i
                const isVisible = revealIndex >= i
                if (!isVisible) return null
                const medal = MEDALS[position]
                const borderColor = position < 3 ? MEDAL_BORDER[position] : 'var(--border)'
                const isFirst = position === 0
                return (
                  <div key={s.id} style={{
                    background: isFirst ? '#fffdf4' : 'var(--white)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 'var(--r)',
                    padding: isFirst ? '20px 22px' : '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    animation: 'slideIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: isFirst ? '0 8px 32px rgba(245,166,35,.25)' : 'none',
                  }}>
                    <div style={{ fontSize: isFirst ? 36 : 26, minWidth: 40, textAlign: 'center' }}>{medal}</div>
                    <div style={{ width: isFirst ? 52 : 42, height: isFirst ? 52 : 42, borderRadius: '50%', background: '#dce6f2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isFirst ? 18 : 14, fontWeight: 700, color: 'var(--navy2)' }}>
                      {initials(s.contestantName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: isFirst ? 20 : 15, fontWeight: 700 }}>{s.contestantName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--tm)' }}>{s.teamName}</div>
                    </div>
                    <div style={{ fontSize: isFirst ? 28 : 18, fontWeight: 700, color: isFirst ? 'var(--gold)' : 'var(--td)' }}>
                      {(s.finalScore! / 10).toFixed(2)}
                      <span style={{ fontSize: 12, color: 'var(--tl)', fontWeight: 400 }}> / 10</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {revealIndex >= 4 && ranked.slice(5).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--tl)', marginBottom: 10, textAlign: 'center' }}>Other submissions</div>
                {ranked.slice(5).map((s, i) => (
                  <div key={s.id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6, opacity: 0.65 }}>
                    <div style={{ fontSize: 14, minWidth: 36, textAlign: 'center', color: 'var(--tl)', fontWeight: 600 }}>#{i + 6}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.contestantName}</div>
                      <div style={{ fontSize: 12, color: 'var(--tm)' }}>{s.teamName}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{(s.finalScore! / 10).toFixed(2)}<span style={{ fontSize: 11, color: 'var(--tl)' }}> / 10</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(24px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulse2 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.8;transform:scale(1.04)} }
      `}</style>
    </>
  )
}
