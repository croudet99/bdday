'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { COUNTRIES, COUNTRY_MAP, flagEmoji } from '@/lib/countries'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Globe2, Bell, LogOut, Calendar as CalIcon, Search, Users, UserPlus, UserMinus,
  Instagram, Twitter, MapPin, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Gift, CalendarClock, Heart,
} from 'lucide-react'

const GlobeView = dynamic(() => import('@/components/GlobeView'), { ssr: false })

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const C = { pink:'#FF3D81', blue:'#2D6BFF', lime:'#C6FF3D', yellow:'#FFC93D', purple:'#7A3DFF', cream:'#FFF6EC', ink:'#0B0B14' }
const FIELD = 'rounded-xl border-[3px] border-black bg-white px-3 py-2 text-black font-semibold placeholder:text-black/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FFC93D] focus-visible:ring-offset-0'

function daysInMonth(month, year = 2024) { return new Date(year, month, 0).getDate() }
function ordinal(d) { const s=['th','st','nd','rd'], v=d%100; return d+(s[(v-20)%10]||s[v]||s[0]) }
function daysUntil(month, day) {
  const now = new Date(); const y = now.getFullYear()
  const today = new Date(y, now.getMonth(), now.getDate())
  let next = new Date(y, month - 1, day)
  if (next < today) next = new Date(y + 1, month - 1, day)
  return Math.round((next - today) / 86400000)
}
function untilLabel(n) { return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days` }

/* ============ Building blocks ============ */
function Btn({ color = C.pink, text = '#fff', className = '', children, ...props }) {
  return (
    <button {...props} style={{ background: color, color: text }}
      className={`inline-flex items-center justify-center gap-2 rounded-full border-[3px] border-black px-5 py-2.5 font-extrabold uppercase tracking-wide text-sm shadow-hard-sm transition hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60 disabled:pointer-events-none ${className}`}>
      {children}
    </button>
  )
}
function Panel({ className = '', children, style }) {
  return <div style={style} className={`rounded-3xl border-[3px] border-black bg-white shadow-hard ${className}`}>{children}</div>
}
function Sticker({ color = C.yellow, rotate = '-3deg', className = '', children }) {
  return <span style={{ background: color, transform: `rotate(${rotate})` }} className={`inline-block rounded-full border-[3px] border-black px-3 py-1 text-xs font-extrabold uppercase shadow-hard-sm ${className}`}>{children}</span>
}
function Avatar({ name, color = C.purple, size = 'w-11 h-11', text = '#fff' }) {
  return <div style={{ background: color, color: text }} className={`${size} shrink-0 rounded-full border-[3px] border-black flex items-center justify-center font-black`}>{(name || '?')[0]?.toUpperCase()}</div>
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('landing')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const user = session?.user || null

  const [publicBirthdays, setPublicBirthdays] = useState([])
  const [followedIds, setFollowedIds] = useState([])
  const [personal, setPersonal] = useState([])
  const [notifications, setNotifications] = useState([])

  const loadProfile = useCallback(async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    return data
  }, [])
  const loadPublic = useCallback(async () => {
    const { data } = await supabase.from('profiles')
      .select('id,display_name,country,country_code,x_handle,instagram_handle,birth_month,birth_day,birth_year,birth_year_public,is_public')
      .eq('is_public', true).not('birth_month', 'is', null)
    setPublicBirthdays(data || [])
  }, [])
  const loadFollows = useCallback(async (uid) => {
    const { data } = await supabase.from('follows').select('followed_id').eq('follower_id', uid)
    setFollowedIds((data || []).map((f) => f.followed_id))
  }, [])
  const loadPersonal = useCallback(async (uid) => {
    const { data } = await supabase.from('personal_birthdays').select('*').eq('owner_id', uid).order('birth_month')
    setPersonal(data || [])
  }, [])
  const loadNotifications = useCallback(async (uid) => {
    const { data } = await supabase.from('notifications').select('*').eq('recipient_id', uid).order('created_at', { ascending: false }).limit(50)
    setNotifications(data || [])
  }, [])
  const refreshUserData = useCallback(async (uid) => {
    await Promise.all([loadPublic(), loadFollows(uid), loadPersonal(uid), loadNotifications(uid)])
  }, [loadPublic, loadFollows, loadPersonal, loadNotifications])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      await loadPublic()
      const { data } = await supabase.auth.getSession()
      const sess = data?.session || null
      if (!mounted) return
      setSession(sess)
      if (sess?.user) {
        const prof = await loadProfile(sess.user.id)
        setProfile(prof)
        await refreshUserData(sess.user.id)
        setScreen(prof && prof.onboarded ? 'app' : 'onboarding')
      } else setScreen('landing')
      setLoading(false)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess)
      if (event === 'SIGNED_OUT' || !sess?.user) { setProfile(null); setScreen('landing') }
    })
    return () => { mounted = false; sub?.subscription?.unsubscribe() }
  }, [loadPublic, loadProfile, refreshUserData])

  if (loading) {
    return (
      <div className="min-h-screen bg-dots flex items-center justify-center" style={{ background: C.cream }}>
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl animate-floaty">🎂</div>
          <p className="font-display text-xl font-extrabold">Loading Birthday Globe…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dots" style={{ background: C.cream }}>
      {screen === 'landing' && <Landing publicBirthdays={publicBirthdays} onStart={() => setScreen('auth')} />}
      {screen === 'auth' && <Auth onBack={() => setScreen('landing')} onAuthed={async (sess) => {
        setSession(sess)
        const prof = await loadProfile(sess.user.id); setProfile(prof)
        await refreshUserData(sess.user.id)
        setScreen(prof && prof.onboarded ? 'app' : 'onboarding')
      }} />}
      {screen === 'onboarding' && user && (
        <Onboarding user={user} initial={profile} onDone={async (prof) => {
          setProfile(prof); await refreshUserData(user.id); setScreen('app'); toast.success('Welcome aboard! 🎉')
        }} />
      )}
      {screen === 'app' && user && (
        <Dashboard user={user} profile={profile} setProfile={setProfile}
          publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} notifications={notifications}
          reload={() => refreshUserData(user.id)}
          onLogout={async () => { await supabase.auth.signOut(); setScreen('landing') }} />
      )}
    </div>
  )
}

/* ============ Landing ============ */
function Landing({ publicBirthdays, onStart }) {
  const now = new Date(); const tM = now.getMonth() + 1; const tD = now.getDate()
  const points = useMemo(() => buildGlobePoints(publicBirthdays, tM, tD), [publicBirthdays, tM, tD])
  const todays = publicBirthdays.filter((b) => b.birth_month === tM && b.birth_day === tD)

  return (
    <div className="relative overflow-hidden">
      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-display text-2xl font-extrabold">
          <span className="w-10 h-10 rounded-xl border-[3px] border-black flex items-center justify-center shadow-hard-sm" style={{ background: C.pink }}>🎂</span>
          Birthday Globe
        </div>
        <Btn color={C.ink} onClick={onStart}>Get started</Btn>
      </nav>

      {/* floating deco */}
      <div className="pointer-events-none absolute inset-0 z-0 text-5xl">
        <span className="absolute left-[6%] top-[22%] animate-floaty" style={{ '--r':'-12deg' }}>🎈</span>
        <span className="absolute left-[3%] top-[62%] animate-floaty" style={{ '--r':'8deg' }}>🎁</span>
        <span className="absolute right-[46%] top-[10%] animate-floaty" style={{ '--r':'10deg' }}>✨</span>
        <span className="absolute right-[4%] bottom-[10%] animate-floaty" style={{ '--r':'-8deg' }}>🎉</span>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-10 items-center pt-4 pb-16">
        <div>
          <Sticker color={C.lime} rotate="-3deg">🌍 the world’s birthday calendar</Sticker>
          <h1 className="font-display text-6xl sm:text-7xl font-extrabold leading-[0.95] mt-5">
            NEVER MISS<br />A <span className="px-2 inline-block border-[3px] border-black rounded-2xl shadow-hard-sm" style={{ background: C.yellow }}>BIRTHDAY</span><br />
            <span style={{ color: C.pink }} className="text-stroke">ANYWHERE</span> ON EARTH
          </h1>
          <p className="mt-6 text-lg font-semibold max-w-md text-black/80">
            Pin your birthday to a live 3D globe, follow friends across the planet, and get an email the day before every birthday you love.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Btn color={C.pink} onClick={onStart} className="text-base px-7 py-3">🎂 Add your birthday</Btn>
            <Btn color="#fff" text="#000" onClick={onStart} className="text-base px-7 py-3">Explore the globe</Btn>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Sticker color="#fff" rotate="-2deg"><Globe2 className="w-3.5 h-3.5 inline mr-1" /> live 3D globe</Sticker>
            <Sticker color="#fff" rotate="2deg"><Bell className="w-3.5 h-3.5 inline mr-1" /> email reminders</Sticker>
            <Sticker color="#fff" rotate="-1deg"><Heart className="w-3.5 h-3.5 inline mr-1" /> follow friends</Sticker>
          </div>
        </div>

        <Panel className="overflow-hidden bg-grid-ink" style={{ background: C.ink }}>
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="font-display font-extrabold text-white text-lg">🎊 Celebrating today</p>
            <Sticker color={C.pink} rotate="6deg">{todays.length} live</Sticker>
          </div>
          <GlobeView points={points} />
          <div className="px-5 pb-5 text-center text-sm font-semibold text-white/70">
            {todays.length > 0 ? `${todays.length} ${todays.length === 1 ? 'person is' : 'people are'} celebrating right now 🎉` : 'Sign up and be the first pin on the globe!'}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ============ Auth ============ */
function Auth({ onBack, onAuthed }) {
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
        if (error) throw error
        if (!data.session) {
          const { data: si, error: se } = await supabase.auth.signInWithPassword({ email, password })
          if (se) { toast.info('Account created. Confirm your email, then sign in.'); setMode('login'); setBusy(false); return }
          onAuthed(si.session); return
        }
        onAuthed(data.session)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error; onAuthed(data.session)
      }
    } catch (err) { toast.error(err.message || 'Something went wrong') } finally { setBusy(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Panel className="w-full max-w-md p-7 relative">
        <div className="absolute -top-4 -right-3"><Sticker color={C.lime} rotate="8deg">no spam, promise</Sticker></div>
        <div className="flex flex-col items-center text-center mb-5">
          <span className="w-14 h-14 rounded-2xl border-[3px] border-black flex items-center justify-center text-2xl shadow-hard-sm" style={{ background: C.yellow }}>🎂</span>
          <h2 className="font-display text-3xl font-extrabold mt-3">{mode === 'signup' ? 'JOIN THE PARTY' : 'WELCOME BACK'}</h2>
          <p className="font-semibold text-black/60">{mode === 'signup' ? 'Create your account' : 'Sign in to your globe'}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div className="space-y-1"><Label className="font-extrabold">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className={FIELD} /></div>
          )}
          <div className="space-y-1"><Label className="font-extrabold">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className={FIELD} /></div>
          <div className="space-y-1"><Label className="font-extrabold">Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" minLength={6} required className={FIELD} /></div>
          <Btn type="submit" color={C.pink} disabled={busy} className="w-full py-3 text-base">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'signup' ? 'Sign up' : 'Sign in')}</Btn>
        </form>
        <div className="mt-4 text-center text-sm font-semibold">
          {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
          <button className="underline decoration-[3px] underline-offset-2" style={{ textDecorationColor: C.pink }} onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create one'}</button>
        </div>
        <button className="mt-3 w-full text-center text-xs font-bold text-black/50 hover:text-black" onClick={onBack}>← Back to home</button>
      </Panel>
    </div>
  )
}

/* ============ Onboarding ============ */
function Onboarding({ user, initial, onDone }) {
  const [name, setName] = useState(initial?.display_name || user.user_metadata?.display_name || '')
  const [month, setMonth] = useState(initial?.birth_month ? String(initial.birth_month) : '')
  const [day, setDay] = useState(initial?.birth_day ? String(initial.birth_day) : '')
  const [year, setYear] = useState(initial?.birth_year ? String(initial.birth_year) : '')
  const [yearPublic, setYearPublic] = useState(initial?.birth_year_public ?? false)
  const [country, setCountry] = useState(initial?.country_code || '')
  const [x, setX] = useState(initial?.x_handle || ''); const [ig, setIg] = useState(initial?.instagram_handle || '')
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true)
  const [busy, setBusy] = useState(false)
  const dayCount = month ? daysInMonth(Number(month)) : 31

  async function save() {
    if (!name || !month || !day || !country) { toast.error('Please fill name, birthday and country'); return }
    setBusy(true)
    const c = COUNTRY_MAP[country]
    const payload = { id: user.id, email: user.email, display_name: name, birth_month: Number(month), birth_day: Number(day),
      birth_year: year ? Number(year) : null, birth_year_public: yearPublic, country: c?.name || null, country_code: country,
      x_handle: x || null, instagram_handle: ig || null, is_public: isPublic, reminders_enabled: true, onboarded: true, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().maybeSingle()
    setBusy(false)
    if (error) { toast.error(error.message); return }
    onDone(data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Panel className="w-full max-w-lg p-7 relative">
        <div className="absolute -top-4 -left-3"><Sticker color={C.blue} text="#fff" rotate="-6deg">step 1 • you</Sticker></div>
        <h2 className="font-display text-3xl font-extrabold">SET UP YOUR BIRTHDAY 🎈</h2>
        <p className="font-semibold text-black/60 mb-5">This creates your pin on the global calendar.</p>
        <div className="space-y-4">
          <div className="space-y-1"><Label className="font-extrabold">Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="font-extrabold">Month</Label>
              <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className={FIELD}><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="font-extrabold">Day</Label>
              <Select value={day} onValueChange={setDay}><SelectTrigger className={FIELD}><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="font-extrabold">Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="opt" className={FIELD} /></div>
          </div>
          <ToggleRow title="Show my birth year" desc="Off = age stays secret" checked={yearPublic} onChange={setYearPublic} disabled={!year} color={C.blue} />
          <div className="space-y-1"><Label className="font-extrabold">Country</Label>
            <Select value={country} onValueChange={setCountry}><SelectTrigger className={FIELD}><SelectValue placeholder="Where are you?" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="font-extrabold flex items-center gap-1"><Twitter className="w-3.5 h-3.5" /> X</Label><Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className={FIELD} /></div>
            <div className="space-y-1"><Label className="font-extrabold flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</Label><Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className={FIELD} /></div>
          </div>
          <ToggleRow title="Make my birthday public 🌍" desc="Appears on the globe so people can wish you" checked={isPublic} onChange={setIsPublic} color={C.pink} />
          <Btn onClick={save} color={C.pink} disabled={busy} className="w-full py-3 text-base">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add me to the globe 🎂'}</Btn>
        </div>
      </Panel>
    </div>
  )
}

/* ============ Dashboard ============ */
function Dashboard({ user, profile, setProfile, publicBirthdays, followedIds, personal, notifications, reload, onLogout }) {
  const [tab, setTab] = useState('globe')
  const [mode, setMode] = useState('global')
  const [selected, setSelected] = useState(null)
  const unread = notifications.filter((n) => !n.read_at).length
  const now = new Date(); const tM = now.getMonth() + 1; const tD = now.getDate()

  async function follow(id) {
    if (id === user.id) { toast.info('That is you 🙂'); return }
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, followed_id: id })
    if (error) { toast.error(error.message); return }
    toast.success('Subscribed! You will get a reminder 🎉'); reload()
  }
  async function unfollow(id) {
    const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Unsubscribed'); reload()
  }
  async function markAllRead() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', user.id).is('read_at', null); reload()
  }

  const tabDef = [
    { v: 'globe', icon: Globe2, label: 'Globe' },
    { v: 'upcoming', icon: CalendarClock, label: 'Upcoming' },
    { v: 'calendar', icon: CalIcon, label: 'Calendar' },
    { v: 'discover', icon: Search, label: 'Discover' },
    { v: 'personal', icon: Users, label: 'My people' },
    { v: 'profile', icon: Gift, label: 'Profile' },
  ]

  return (
    <div>
      <header className="sticky top-0 z-30 border-b-[3px] border-black" style={{ background: C.cream }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-display text-xl font-extrabold">
            <span className="w-9 h-9 rounded-lg border-[3px] border-black flex items-center justify-center text-sm shadow-hard-sm" style={{ background: C.pink }}>🎂</span>
            <span className="hidden sm:inline">Birthday Globe</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border-[3px] border-black p-1 bg-white shadow-hard-sm">
            <button onClick={() => setMode('global')} style={{ background: mode === 'global' ? C.pink : 'transparent', color: mode === 'global' ? '#fff' : '#000' }} className="px-3 py-1 rounded-full text-xs font-extrabold uppercase">🌍 Global</button>
            <button onClick={() => setMode('personal')} style={{ background: mode === 'personal' ? C.blue : 'transparent', color: mode === 'personal' ? '#fff' : '#000' }} className="px-3 py-1 rounded-full text-xs font-extrabold uppercase">🔒 Personal</button>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative w-10 h-10 rounded-full border-[3px] border-black bg-white shadow-hard-sm flex items-center justify-center hover:-translate-y-0.5 transition">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && <span style={{ background: C.pink }} className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black rounded-full w-5 h-5 border-2 border-black flex items-center justify-center">{unread}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 rounded-2xl border-[3px] border-black shadow-hard p-3" align="end">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-display font-extrabold">Notifications</p>
                  {unread > 0 && <button onClick={markAllRead} className="text-xs font-bold underline">Mark all read</button>}
                </div>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {notifications.length === 0 && <p className="text-sm font-semibold text-black/50 py-6 text-center">No notifications yet 🎈</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className="rounded-xl border-[3px] border-black p-2.5" style={{ background: n.read_at ? '#fff' : C.yellow }}>
                      <p className="font-extrabold text-sm flex items-center gap-1.5"><Gift className="w-4 h-4" /> {n.title}</p>
                      {n.body && <p className="text-xs font-semibold text-black/70 mt-0.5">{n.body}</p>}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button onClick={onLogout} className="w-10 h-10 rounded-full border-[3px] border-black bg-white shadow-hard-sm flex items-center justify-center hover:-translate-y-0.5 transition"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 justify-start">
            {tabDef.map((t) => (
              <TabsTrigger key={t.v} value={t.v}
                className="rounded-full border-[3px] border-black bg-white px-4 py-2 font-extrabold uppercase text-xs shadow-hard-sm data-[state=active]:shadow-none data-[state=active]:translate-x-0.5 data-[state=active]:translate-y-0.5 data-[state=active]:!bg-black data-[state=active]:!text-white">
                <t.icon className="w-4 h-4 mr-1.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="globe" className="mt-6"><GlobeTab publicBirthdays={publicBirthdays} tM={tM} tD={tD} onSelect={setSelected} /></TabsContent>
          <TabsContent value="upcoming" className="mt-6"><UpcomingTab mode={mode} publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} profile={profile} onSelect={setSelected} /></TabsContent>
          <TabsContent value="calendar" className="mt-6"><CalendarTab mode={mode} publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} profile={profile} onSelect={setSelected} tM={tM} tD={tD} /></TabsContent>
          <TabsContent value="discover" className="mt-6"><DiscoverTab user={user} followedIds={followedIds} follow={follow} unfollow={unfollow} /></TabsContent>
          <TabsContent value="personal" className="mt-6"><PersonalTab user={user} personal={personal} reload={reload} followedIds={followedIds} publicBirthdays={publicBirthdays} unfollow={unfollow} onSelect={setSelected} /></TabsContent>
          <TabsContent value="profile" className="mt-6"><ProfileTab user={user} profile={profile} setProfile={setProfile} reload={reload} /></TabsContent>
        </Tabs>
      </div>

      <PersonDialog person={selected} onClose={() => setSelected(null)} followedIds={followedIds} follow={follow} unfollow={unfollow} meId={user.id} />
    </div>
  )
}

/* ============ Globe Tab ============ */
function GlobeTab({ publicBirthdays, tM, tD, onSelect }) {
  const points = useMemo(() => buildGlobePoints(publicBirthdays, tM, tD), [publicBirthdays, tM, tD])
  const todays = publicBirthdays.filter((b) => b.birth_month === tM && b.birth_day === tD)
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Panel className="lg:col-span-2 overflow-hidden bg-grid-ink" style={{ background: C.ink }}>
        <div className="flex items-center justify-between px-5 pt-4">
          <div><p className="font-display font-extrabold text-white text-lg">🌍 Live birthday globe</p><p className="text-sm font-semibold text-white/60">Pink pins celebrate today • click to wish them</p></div>
          <Sticker color={C.pink} rotate="6deg">{todays.length} today</Sticker>
        </div>
        <GlobeView points={points} onPointClick={(p) => onSelect(p.data)} />
      </Panel>
      <Panel className="p-4" style={{ background: C.yellow }}>
        <p className="font-display font-extrabold text-lg mb-3">🎊 Today — {MONTH_ABBR[tM - 1]} {tD}</p>
        <div className="space-y-2 max-h-[440px] overflow-auto pr-1">
          {todays.length === 0 && <p className="text-sm font-semibold text-black/60 py-8 text-center">No public birthdays today 🎂</p>}
          {todays.map((b) => <PersonRow key={b.id} b={b} onClick={() => onSelect(b)} />)}
        </div>
      </Panel>
    </div>
  )
}

function PersonRow({ b, onClick, right }) {
  const c = COUNTRY_MAP[b.country_code]
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-2.5 shadow-hard-sm hover:-translate-y-0.5 transition">
      <Avatar name={b.display_name} color={C.purple} size="w-10 h-10" />
      <div className="min-w-0 flex-1">
        <p className="font-extrabold truncate">{b.display_name}</p>
        <p className="text-xs font-semibold text-black/60 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c ? `${flagEmoji(b.country_code)} ${c.name}` : 'Earth'}</p>
      </div>
      {right}
    </button>
  )
}

/* ============ Upcoming Tab (next 7 days) ============ */
function buildEntries(mode, publicBirthdays, followedIds, personal, profile) {
  if (mode === 'global') return publicBirthdays.map((b) => ({ ...b, name: b.display_name, source: 'public' }))
  const list = []
  if (profile?.birth_month) list.push({ id: 'me', name: (profile.display_name || 'You') + ' (you)', birth_month: profile.birth_month, birth_day: profile.birth_day, source: 'self' })
  personal.forEach((p) => list.push({ id: p.id, name: p.person_name, birth_month: p.birth_month, birth_day: p.birth_day, relationship: p.relationship, source: 'personal' }))
  publicBirthdays.filter((b) => followedIds.includes(b.id)).forEach((b) => list.push({ ...b, name: b.display_name, source: 'subscribed' }))
  return list
}

function UpcomingTab({ mode, publicBirthdays, followedIds, personal, profile, onSelect }) {
  const entries = useMemo(() => buildEntries(mode, publicBirthdays, followedIds, personal, profile), [mode, publicBirthdays, followedIds, personal, profile])
  const upcoming = useMemo(() => entries.map((e) => ({ ...e, days: daysUntil(e.birth_month, e.birth_day) })).filter((e) => e.days <= 7).sort((a, b) => a.days - b.days), [entries])
  const badgeColor = (d) => d === 0 ? C.pink : d === 1 ? C.blue : C.purple

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-display text-3xl font-extrabold">NEXT 7 DAYS</h2>
        <Sticker color={C.lime} rotate="-4deg">{upcoming.length} coming up</Sticker>
      </div>
      {upcoming.length === 0 && (
        <Panel className="p-10 text-center"><div className="text-5xl mb-2">🎈</div><p className="font-display text-xl font-extrabold">No birthdays in the next week</p><p className="font-semibold text-black/60">{mode === 'global' ? 'Invite friends so the globe fills up!' : 'Follow people or add private birthdays.'}</p></Panel>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {upcoming.map((e, i) => {
          const c = COUNTRY_MAP[e.country_code]
          const clickable = e.source === 'public' || e.source === 'subscribed'
          return (
            <Panel key={i} className="p-4" style={{ background: e.days === 0 ? C.yellow : '#fff' }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ background: badgeColor(e.days), color: '#fff' }} className="rounded-full border-[3px] border-black px-3 py-1 text-xs font-extrabold uppercase shadow-hard-sm">{untilLabel(e.days)}</span>
                <span className="font-display font-extrabold">{MONTH_ABBR[e.birth_month - 1]} {e.birth_day}</span>
              </div>
              <button disabled={!clickable} onClick={() => clickable && onSelect(e)} className="w-full text-left flex items-center gap-3">
                <Avatar name={e.name} color={e.source === 'self' ? C.pink : e.source === 'personal' ? C.yellow : C.purple} text={e.source === 'personal' ? '#000' : '#fff'} />
                <div className="min-w-0">
                  <p className="font-extrabold truncate">{e.name} 🎂</p>
                  <p className="text-xs font-semibold text-black/60">{e.source === 'personal' ? (e.relationship || 'Private') : c ? `${flagEmoji(e.country_code)} ${c.name}` : (e.source === 'self' ? 'Your birthday' : 'Earth')}</p>
                </div>
              </button>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

/* ============ Calendar Tab ============ */
function CalendarTab({ mode, publicBirthdays, followedIds, personal, profile, onSelect, tM, tD }) {
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1)
  const entries = useMemo(() => buildEntries(mode, publicBirthdays, followedIds, personal, profile), [mode, publicBirthdays, followedIds, personal, profile])
  const byDay = useMemo(() => {
    const map = {}
    entries.filter((e) => e.birth_month === viewMonth).forEach((e) => { (map[e.birth_day] = map[e.birth_day] || []).push(e) })
    return map
  }, [entries, viewMonth])
  const firstDow = new Date(2025, viewMonth - 1, 1).getDay()
  const totalDays = daysInMonth(viewMonth, 2025)
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  const chipColor = (s) => s === 'self' ? C.pink : s === 'personal' ? C.yellow : C.purple

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="font-display text-3xl font-extrabold">{MONTHS[viewMonth - 1].toUpperCase()}</h2>
          <p className="font-semibold text-black/60">{mode === 'global' ? 'Public birthdays worldwide 🌍' : 'You, your people & subscriptions 🔒'}</p></div>
        <div className="flex gap-2">
          <button onClick={() => setViewMonth((m) => (m === 1 ? 12 : m - 1))} className="w-10 h-10 rounded-full border-[3px] border-black bg-white shadow-hard-sm flex items-center justify-center hover:-translate-y-0.5 transition"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => setViewMonth((m) => (m === 12 ? 1 : m + 1))} className="w-10 h-10 rounded-full border-[3px] border-black bg-white shadow-hard-sm flex items-center justify-center hover:-translate-y-0.5 transition"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center text-xs font-extrabold uppercase text-black/50">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const list = byDay[d] || []
          const isToday = viewMonth === tM && d === tD
          return (
            <div key={i} className="min-h-[82px] rounded-xl border-[3px] border-black p-1.5" style={{ background: isToday ? C.lime : '#fff' }}>
              <div className="text-xs font-extrabold">{d}</div>
              <div className="space-y-1 mt-1">
                {list.slice(0, 2).map((e, idx) => (
                  <button key={idx} onClick={() => (e.source === 'public' || e.source === 'subscribed') && onSelect(e)}
                    style={{ background: chipColor(e.source), color: e.source === 'personal' ? '#000' : '#fff' }}
                    className="w-full truncate text-left text-[10px] font-bold px-1.5 py-0.5 rounded-md border-2 border-black">🎂 {e.name}</button>
                ))}
                {list.length > 2 && <div className="text-[10px] font-bold text-black/50 px-1">+{list.length - 2} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/* ============ Discover Tab ============ */
function DiscoverTab({ user, followedIds, follow, unfollow }) {
  const [q, setQ] = useState(''); const [results, setResults] = useState([]); const [busy, setBusy] = useState(false)
  const search = useCallback(async (term) => {
    setBusy(true)
    let query = supabase.from('profiles').select('id,display_name,country,country_code,x_handle,instagram_handle,birth_month,birth_day,birth_year,birth_year_public,is_public').eq('is_public', true).not('birth_month', 'is', null).limit(40)
    if (term) query = query.ilike('display_name', `%${term}%`)
    const { data } = await query
    setResults((data || []).filter((r) => r.id !== user.id)); setBusy(false)
  }, [user.id])
  useEffect(() => { search('') }, [search])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-3xl font-extrabold">DISCOVER</h2>
        <Sticker color={C.blue} text="#fff" rotate="3deg">find & follow</Sticker>
      </div>
      <div className="flex gap-2 max-w-md">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(q)} placeholder="Search people by name…" className={FIELD + ' flex-1'} />
        <Btn color={C.ink} onClick={() => search(q)}><Search className="w-4 h-4" /></Btn>
      </div>
      {busy && <p className="font-semibold text-black/60">Searching…</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((b) => {
          const c = COUNTRY_MAP[b.country_code]; const following = followedIds.includes(b.id)
          return (
            <Panel key={b.id} className="p-4 flex items-center gap-3">
              <Avatar name={b.display_name} color={C.purple} />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold truncate">{b.display_name}</p>
                <p className="text-xs font-semibold text-black/60">🎂 {MONTH_ABBR[b.birth_month - 1]} {b.birth_day} • {c ? `${flagEmoji(b.country_code)} ${c.name}` : 'Earth'}</p>
              </div>
              {following
                ? <Btn color="#fff" text="#000" onClick={() => unfollow(b.id)} className="px-3 py-2"><UserMinus className="w-4 h-4" /></Btn>
                : <Btn color={C.pink} onClick={() => follow(b.id)} className="px-3 py-2"><UserPlus className="w-4 h-4" /></Btn>}
            </Panel>
          )
        })}
      </div>
      {!busy && results.length === 0 && <p className="font-semibold text-black/60">No public profiles found.</p>}
    </div>
  )
}

/* ============ Personal Tab ============ */
function PersonalTab({ user, personal, reload, followedIds, publicBirthdays, unfollow, onSelect }) {
  const [name, setName] = useState(''); const [month, setMonth] = useState(''); const [day, setDay] = useState('')
  const [year, setYear] = useState(''); const [rel, setRel] = useState(''); const [busy, setBusy] = useState(false)
  const subscribed = publicBirthdays.filter((b) => followedIds.includes(b.id))
  const dayCount = month ? daysInMonth(Number(month)) : 31

  async function add() {
    if (!name || !month || !day) { toast.error('Name, month and day are required'); return }
    setBusy(true)
    const { error } = await supabase.from('personal_birthdays').insert({ owner_id: user.id, person_name: name, birth_month: Number(month), birth_day: Number(day), birth_year: year ? Number(year) : null, relationship: rel || null })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    setName(''); setMonth(''); setDay(''); setYear(''); setRel(''); toast.success('Added to your private calendar 🔒'); reload()
  }
  async function remove(id) { await supabase.from('personal_birthdays').delete().eq('id', id); toast.success('Removed'); reload() }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Panel className="p-5" style={{ background: C.yellow }}>
        <p className="font-display text-2xl font-extrabold flex items-center gap-2"><Plus className="w-5 h-5" /> ADD A PRIVATE BIRTHDAY</p>
        <p className="font-semibold text-black/70 mb-4">Only you see these — for people not on Birthday Globe.</p>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person’s name" className={FIELD + ' w-full'} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className={FIELD}><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={day} onValueChange={setDay}><SelectTrigger className={FIELD}><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year?" className={FIELD} />
          </div>
          <Select value={rel} onValueChange={setRel}><SelectTrigger className={FIELD}><SelectValue placeholder="Relationship (optional)" /></SelectTrigger><SelectContent>{['Family','Friend','Partner','Colleague','Other'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          <Btn onClick={add} color={C.ink} disabled={busy} className="w-full py-3">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add birthday'}</Btn>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel className="p-5">
          <p className="font-display text-xl font-extrabold flex items-center gap-2 mb-3"><Users className="w-5 h-5" /> Private birthdays ({personal.length})</p>
          <div className="space-y-2 max-h-64 overflow-auto pr-1">
            {personal.length === 0 && <p className="text-sm font-semibold text-black/50 py-4 text-center">Nothing yet — add someone!</p>}
            {personal.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-2.5 shadow-hard-sm">
                <Avatar name={p.person_name} color={C.yellow} text="#000" size="w-10 h-10" />
                <div className="flex-1 min-w-0"><p className="font-extrabold truncate">{p.person_name}</p><p className="text-xs font-semibold text-black/60">🎂 {MONTH_ABBR[p.birth_month - 1]} {p.birth_day}{p.relationship ? ` • ${p.relationship}` : ''}</p></div>
                <button onClick={() => remove(p.id)} className="w-9 h-9 rounded-full border-[3px] border-black bg-white flex items-center justify-center hover:bg-red-100 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5">
          <p className="font-display text-xl font-extrabold flex items-center gap-2 mb-3"><Heart className="w-5 h-5" /> Subscriptions ({subscribed.length})</p>
          <div className="space-y-2 max-h-64 overflow-auto pr-1">
            {subscribed.length === 0 && <p className="text-sm font-semibold text-black/50 py-4 text-center">Follow people from Discover.</p>}
            {subscribed.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-2.5 shadow-hard-sm">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => onSelect(b)}>
                  <Avatar name={b.display_name} color={C.purple} size="w-10 h-10" />
                  <div className="min-w-0"><p className="font-extrabold truncate">{b.display_name}</p><p className="text-xs font-semibold text-black/60">🎂 {MONTH_ABBR[b.birth_month - 1]} {b.birth_day}</p></div>
                </button>
                <button onClick={() => unfollow(b.id)} className="w-9 h-9 rounded-full border-[3px] border-black bg-white flex items-center justify-center hover:bg-red-100 transition"><UserMinus className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ============ Profile Tab ============ */
function ProfileTab({ user, profile, setProfile, reload }) {
  const [name, setName] = useState(profile?.display_name || '')
  const [month, setMonth] = useState(profile?.birth_month ? String(profile.birth_month) : '')
  const [day, setDay] = useState(profile?.birth_day ? String(profile.birth_day) : '')
  const [year, setYear] = useState(profile?.birth_year ? String(profile.birth_year) : '')
  const [yearPublic, setYearPublic] = useState(profile?.birth_year_public ?? false)
  const [country, setCountry] = useState(profile?.country_code || '')
  const [x, setX] = useState(profile?.x_handle || ''); const [ig, setIg] = useState(profile?.instagram_handle || '')
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true)
  const [reminders, setReminders] = useState(profile?.reminders_enabled ?? true)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const dayCount = month ? daysInMonth(Number(month)) : 31

  async function save() {
    setBusy(true)
    const c = COUNTRY_MAP[country]
    const payload = { id: user.id, email: user.email, display_name: name, birth_month: month ? Number(month) : null, birth_day: day ? Number(day) : null,
      birth_year: year ? Number(year) : null, birth_year_public: yearPublic, country: c?.name || null, country_code: country || null,
      x_handle: x || null, instagram_handle: ig || null, is_public: isPublic, reminders_enabled: reminders, onboarded: true, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().maybeSingle()
    setBusy(false)
    if (error) { toast.error(error.message); return }
    setProfile(data); toast.success('Profile saved ✨'); reload()
  }

  async function testReminder() {
    setTesting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/reminders/self-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: '{}',
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to send')
      toast.success(`Test reminder sent to ${j.to} 🎉 Check your inbox!`)
    } catch (e) {
      toast.error(e.message || 'Could not send test')
    } finally { setTesting(false) }
  }

  return (
    <Panel className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <Avatar name={name || user.email} color={C.pink} size="w-14 h-14" />
        <div><h2 className="font-display text-2xl font-extrabold">YOUR PROFILE</h2><p className="font-semibold text-black/60">{user.email}</p></div>
      </div>
      <div className="space-y-4">
        <div className="space-y-1"><Label className="font-extrabold">Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={FIELD + ' w-full'} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1"><Label className="font-extrabold">Month</Label><Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className={FIELD}><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="font-extrabold">Day</Label><Select value={day} onValueChange={setDay}><SelectTrigger className={FIELD}><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="font-extrabold">Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="opt" className={FIELD} /></div>
        </div>
        <div className="space-y-1"><Label className="font-extrabold">Country</Label><Select value={country} onValueChange={setCountry}><SelectTrigger className={FIELD}><SelectValue placeholder="Country" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="font-extrabold flex items-center gap-1"><Twitter className="w-3.5 h-3.5" /> X</Label><Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className={FIELD} /></div>
          <div className="space-y-1"><Label className="font-extrabold flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</Label><Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className={FIELD} /></div>
        </div>
        <ToggleRow title="Public birthday 🌍" desc="Show on the global calendar & globe" checked={isPublic} onChange={setIsPublic} color={C.pink} />
        <ToggleRow title="Show birth year" desc="Reveal your age publicly" checked={yearPublic} onChange={setYearPublic} disabled={!year} color={C.blue} />
        <ToggleRow title="Email reminders" desc="Emailed 24h before birthdays you follow" checked={reminders} onChange={setReminders} color={C.purple} />
        <Btn onClick={save} color={C.pink} disabled={busy} className="w-full py-3">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save profile'}</Btn>
        <div className="rounded-2xl border-[3px] border-dashed border-black/40 p-3 space-y-2">
          <button onClick={testReminder} disabled={testing} className="w-full rounded-full border-[3px] border-black bg-white px-5 py-3 font-extrabold uppercase text-sm shadow-hard-sm hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition disabled:opacity-60 flex items-center justify-center gap-2">
            {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Bell className="w-4 h-4" /> Send me a test reminder now</>}
          </button>
          <p className="text-xs font-semibold text-black/50 text-center">Emails you a live preview of the reminder you get 24h before your nearest subscribed/added birthday.</p>
        </div>
      </div>
    </Panel>
  )
}

function ToggleRow({ title, desc, checked, onChange, disabled, color = C.pink }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border-[3px] border-black bg-white p-3">
      <div><p className="font-extrabold">{title}</p><p className="text-xs font-semibold text-black/60">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} style={{ background: checked ? color : undefined }} className="data-[state=checked]:!bg-transparent border-[3px] border-black" />
    </div>
  )
}

/* ============ Person Dialog ============ */
function PersonDialog({ person, onClose, followedIds, follow, unfollow, meId }) {
  if (!person) return null
  const c = COUNTRY_MAP[person.country_code]
  const following = followedIds.includes(person.id)
  const isMe = person.id === meId
  const age = person.birth_year && person.birth_year_public ? new Date().getFullYear() - person.birth_year : null
  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl border-[3px] border-black shadow-hard p-0 overflow-hidden">
        <div className="p-5" style={{ background: C.yellow }}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar name={person.display_name} color={C.pink} size="w-16 h-16" />
              <div className="text-left">
                <DialogTitle className="font-display text-2xl font-extrabold">{person.display_name}</DialogTitle>
                <DialogDescription className="font-semibold text-black/70">{c ? `${flagEmoji(person.country_code)} ${c.name}` : 'Earth'}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border-[3px] border-black bg-white px-3 py-1.5 font-extrabold shadow-hard-sm">🎂 {MONTHS[person.birth_month - 1]} {ordinal(person.birth_day)}{age ? ` • turning ${age + 1}` : ''}</div>
          <div className="flex flex-wrap gap-2">
            {person.x_handle && <a href={`https://x.com/${person.x_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-black bg-white px-3 py-1.5 text-sm font-bold shadow-hard-sm hover:-translate-y-0.5 transition"><Twitter className="w-4 h-4" /> {person.x_handle}</a>}
            {person.instagram_handle && <a href={`https://instagram.com/${person.instagram_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-black bg-white px-3 py-1.5 text-sm font-bold shadow-hard-sm hover:-translate-y-0.5 transition"><Instagram className="w-4 h-4" /> {person.instagram_handle}</a>}
          </div>
          {!person.x_handle && !person.instagram_handle && <p className="text-sm font-semibold text-black/50">No socials shared.</p>}
          {!isMe && (following
            ? <Btn color="#fff" text="#000" onClick={() => { unfollow(person.id); onClose() }} className="w-full"><UserMinus className="w-4 h-4" /> Unsubscribe</Btn>
            : <Btn color={C.pink} onClick={() => { follow(person.id); onClose() }} className="w-full"><Bell className="w-4 h-4" /> Subscribe to birthday</Btn>)}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ============ helpers ============ */
function buildGlobePoints(publicBirthdays, tM, tD) {
  const pts = []
  for (const b of publicBirthdays) {
    const c = COUNTRY_MAP[b.country_code]; if (!c) continue
    const isToday = b.birth_month === tM && b.birth_day === tD
    const dU = daysUntil(b.birth_month, b.birth_day)
    const soon = dU > 0 && dU <= 7
    const jLat = ((hashCode(b.id) % 100) / 100 - 0.5) * 4
    const jLng = ((hashCode(b.id + 'x') % 100) / 100 - 0.5) * 4
    pts.push({
      lat: c.lat + jLat, lng: c.lng + jLng,
      color: isToday ? '#FF3D81' : soon ? '#FFC93D' : '#7A3DFF',
      r: isToday ? 0.85 : soon ? 0.5 : 0.28,
      alt: isToday ? 0.1 : soon ? 0.05 : 0.01,
      label: `${flagEmoji(b.country_code)} ${b.display_name} · ${c.name}${isToday ? ' · 🎂 Today!' : soon ? ` · in ${dU}d` : ''}`,
      data: b,
    })
  }
  return pts
}
function hashCode(str) { let h = 0; const s = String(str || ''); for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 } return Math.abs(h) }
