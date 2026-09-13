'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { COUNTRIES, COUNTRY_MAP } from '@/lib/countries'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Globe2, Bell, LogOut, Calendar as CalIcon, Search, Users, UserPlus, UserMinus,
  Instagram, Twitter, MapPin, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Gift, CalendarClock,
  Heart, Sparkles, Cake, ArrowRight, Check, Shield,
} from 'lucide-react'

const GlobeView = dynamic(() => import('@/components/GlobeView'), { ssr: false })

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const T = { pink:'#FF5C93', orange:'#FFB020', violet:'#A78BFA', cyan:'#22D3EE', green:'#34C759', blue:'#5BA8FF' }
const GRAD = 'linear-gradient(135deg,#FF4D8D 0%,#A855F7 50%,#22D3EE 100%)'
const FIELD = 'w-full rounded-xl bg-white/70 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 border border-slate-900/10 focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 transition'

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

/* ===== primitives ===== */
function Card({ className = '', children, style }) {
  return <div style={style} className={`rounded-[28px] glass-card shadow-soft ${className}`}>{children}</div>
}
function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'
  const map = {
    primary: 'text-white px-5 py-2.5 glow-grad shadow-sm hover:brightness-105 hover:-translate-y-0.5',
    light: 'bg-slate-900 text-white px-5 py-2.5 shadow-sm hover:bg-slate-800 hover:-translate-y-0.5',
    soft: 'bg-white/90 text-slate-900 px-5 py-2.5 hover:bg-white border border-slate-900/12 shadow-sm hover:-translate-y-0.5',
    ghost: 'text-slate-700 px-3 py-2 hover:bg-slate-900/5',
  }
  const style = variant === 'primary' ? { backgroundImage: GRAD } : undefined
  return <button {...props} style={style} className={`${base} ${map[variant]} ${className}`}>{children}</button>
}
function IconButton({ className = '', children, ...props }) {
  return <button {...props} className={`w-10 h-10 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-900/5 transition-all duration-200 hover:-translate-y-0.5 ${className}`}>{children}</button>
}
function Avatar({ name, size = 'w-11 h-11', text = 'text-base' }) {
  return <div style={{ backgroundImage: GRAD }} className={`${size} shrink-0 rounded-full flex items-center justify-center font-semibold text-white ${text}`}>{(name || '?')[0]?.toUpperCase()}</div>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div style={{ backgroundImage: GRAD }} className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-soft"><Cake className="w-7 h-7 text-white" /></div>
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 stars opacity-35 pointer-events-none" />
      <div className="fixed inset-0 -z-10 grain-layer opacity-60 pointer-events-none" />
      <div className="fixed inset-0 -z-10 pixel-layer opacity-35 pointer-events-none" />
      {screen === 'landing' && <Landing publicBirthdays={publicBirthdays} onStart={() => setScreen('auth')} />}
      {screen === 'auth' && <Auth onBack={() => setScreen('landing')} onAuthed={async (sess) => {
        setSession(sess)
        const prof = await loadProfile(sess.user.id); setProfile(prof)
        await refreshUserData(sess.user.id)
        setScreen(prof && prof.onboarded ? 'app' : 'onboarding')
      }} />}
      {screen === 'onboarding' && user && (
        <Onboarding user={user} initial={profile} onDone={async (prof) => {
          setProfile(prof); await refreshUserData(user.id); setScreen('app'); toast.success('Welcome aboard!')
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

/* ===== Landing ===== */
function Landing({ publicBirthdays, onStart }) {
  const now = new Date(); const tM = now.getMonth() + 1; const tD = now.getDate()
  const points = useMemo(() => buildGlobePoints(publicBirthdays, tM, tD), [publicBirthdays, tM, tD])
  const todays = publicBirthdays.filter((b) => b.birth_month === tM && b.birth_day === tD)
  const upcoming = publicBirthdays.filter((b) => { const d = daysUntil(b.birth_month, b.birth_day); return d > 0 && d <= 7 }).length

  const Feature = ({ icon: Icon, tint, title, desc }) => (
    <Card className="p-6 flex flex-col justify-between">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: tint + '26', color: tint }}><Icon className="w-5 h-5" /></div>
      <div className="mt-6"><p className="font-semibold text-[17px]">{title}</p><p className="text-[14px] text-slate-600 mt-1 leading-snug">{desc}</p></div>
    </Card>
  )

  return (
    <div>
      <nav className="sticky top-0 z-30 glass border-b border-slate-900/10">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><span style={{ backgroundImage: GRAD }} className="w-7 h-7 rounded-full flex items-center justify-center"><Cake className="w-4 h-4 text-white" /></span> BddayBook</div>
          <div className="flex items-center gap-1"><Button variant="ghost" onClick={onStart}>Sign in</Button><Button variant="light" onClick={onStart}>Get started</Button></div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-5 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-slate-900/10 px-3 py-1 text-[13px] font-medium text-slate-700 mb-5"><Globe2 className="w-3.5 h-3.5" /> The world&apos;s birthday calendar</div>
        <h1 className="font-display text-5xl sm:text-[68px] font-bold leading-[1.03]">Never miss a birthday.<br /><span style={{ backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Anywhere on Earth.</span></h1>
        <p className="mt-5 text-[19px] text-slate-600 max-w-2xl mx-auto leading-relaxed">Pin your birthday to a live 3D globe, follow friends across the planet, and get a beautifully-timed email before every birthday you love.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="primary" onClick={onStart} className="px-6 py-3 text-[15px]">Add your birthday <ArrowRight className="w-4 h-4" /></Button>
          <Button variant="soft" onClick={onStart} className="px-6 py-3 text-[15px]">Explore the globe</Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:auto-rows-[188px]">
          <Card className="md:col-span-2 md:row-span-2 overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.58)' }}>
            <div className="absolute top-5 left-6 z-10"><p className="text-[13px] text-slate-600">Live now</p><p className="font-semibold text-lg">Celebrating today</p></div>
            <div className="absolute top-5 right-6 z-10 text-right"><p className="font-display text-4xl font-bold">{todays.length}</p><p className="text-[12px] text-slate-500">around the world</p></div>
            <div className="pt-8"><GlobeView points={points} /></div>
          </Card>
          <Feature icon={Bell} tint={T.pink} title="Smart reminders" desc="An email 3 days, 1 day, or the morning of — your choice." />
          <Feature icon={Heart} tint={T.violet} title="Follow anyone" desc="Subscribe to friends worldwide and never forget." />
          <Card className="p-6 flex items-center justify-between">
            <div><p className="font-display text-4xl font-bold">{upcoming}</p><p className="text-[14px] text-slate-600 mt-1">birthdays in the next 7 days</p></div>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: T.orange + '26', color: T.orange }}><CalendarClock className="w-5 h-5" /></div>
          </Card>
          <Feature icon={Sparkles} tint={T.cyan} title="Private mode" desc="Track family & friends privately — never shown publicly." />
        </div>
      </section>
    </div>
  )
}

/* ===== Auth ===== */
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-[400px] p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <span style={{ backgroundImage: GRAD }} className="w-12 h-12 rounded-2xl flex items-center justify-center"><Cake className="w-6 h-6 text-white" /></span>
          <h2 className="font-display text-[26px] font-bold mt-4">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="text-[15px] text-slate-600 mt-1">{mode === 'signup' ? 'Join the global birthday calendar' : 'Sign in to your BddayBook'}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className={FIELD} />}
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className={FIELD} />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required className={FIELD} />
          <Button type="submit" variant="primary" disabled={busy} className="w-full py-3 text-[15px]">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'signup' ? 'Sign up' : 'Sign in')}</Button>
        </form>
        <div className="mt-5 text-center text-[14px] text-slate-600">
          {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
          <button className="font-semibold text-slate-900" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create one'}</button>
        </div>
        <button className="mt-3 w-full text-center text-[13px] text-slate-400 hover:text-slate-700 inline-flex items-center justify-center gap-1" onClick={onBack}><ChevronLeft className="w-3.5 h-3.5" /> Back to home</button>
      </Card>
    </div>
  )
}

/* ===== Onboarding ===== */
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
      x_handle: x || null, instagram_handle: ig || null, is_public: isPublic, reminders_enabled: true, reminder_offsets: [1], onboarded: true, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().maybeSingle()
    setBusy(false)
    if (error) { toast.error(error.message); return }
    onDone(data)
  }
  const lbl = 'text-[13px] font-medium text-slate-600'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-[520px] p-8">
        <p className="text-[13px] font-semibold" style={{ color: T.pink }}>SET UP YOUR PROFILE</p>
        <h2 className="font-display text-[28px] font-bold mt-1">Add your birthday</h2>
        <p className="text-[15px] text-slate-600 mb-6">This creates your pin on the global calendar.</p>
        <div className="space-y-4">
          <div><Label className={lbl}>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={FIELD + ' mt-1.5'} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className={lbl}>Month</Label><Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className={FIELD + ' mt-1.5'}><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className={lbl}>Day</Label><Select value={day} onValueChange={setDay}><SelectTrigger className={FIELD + ' mt-1.5'}><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className={lbl}>Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Optional" className={FIELD + ' mt-1.5'} /></div>
          </div>
          <ToggleRow title="Show my birth year" desc="Off keeps your age private" checked={yearPublic} onChange={setYearPublic} disabled={!year} />
          <div><Label className={lbl}>Country</Label><Select value={country} onValueChange={setCountry}><SelectTrigger className={FIELD + ' mt-1.5'}><SelectValue placeholder="Where are you?" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className={lbl + ' flex items-center gap-1'}><Twitter className="w-3.5 h-3.5" /> X</Label><Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className={FIELD + ' mt-1.5'} /></div>
            <div><Label className={lbl + ' flex items-center gap-1'}><Instagram className="w-3.5 h-3.5" /> Instagram</Label><Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className={FIELD + ' mt-1.5'} /></div>
          </div>
          <ToggleRow title="Make my birthday public" desc="Appears on the globe so people can wish you" checked={isPublic} onChange={setIsPublic} />
          <Button onClick={save} variant="primary" disabled={busy} className="w-full py-3 text-[15px]">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add me to the globe'}</Button>
        </div>
      </Card>
    </div>
  )
}

/* ===== Dashboard ===== */
function Dashboard({ user, profile, setProfile, publicBirthdays, followedIds, personal, notifications, reload, onLogout }) {
  const [tab, setTab] = useState('globe')
  const [mode, setMode] = useState('global')
  const [selected, setSelected] = useState(null)
  const unread = notifications.filter((n) => !n.read_at).length
  const now = new Date(); const tM = now.getMonth() + 1; const tD = now.getDate()

  async function follow(id) {
    if (id === user.id) { toast.info('That is you'); return }
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, followed_id: id })
    if (error) { toast.error(error.message); return }
    toast.success('Subscribed — you will get a reminder'); reload()
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
    { v: 'profile', icon: Cake, label: 'Profile' },
  ]

  return (
    <div>
      <header className="sticky top-0 z-30 glass border-b border-slate-900/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><span style={{ backgroundImage: GRAD }} className="w-7 h-7 rounded-full flex items-center justify-center"><Cake className="w-4 h-4 text-white" /></span> <span className="hidden sm:inline">BddayBook</span></div>
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 border border-slate-900/10 p-1">
            {[{ v: 'global', label: 'Global', icon: Globe2 }, { v: 'personal', label: 'Personal', icon: Shield }].map((o) => (
              <button key={o.v} onClick={() => setMode(o.v)} className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition inline-flex items-center gap-1.5 ${mode === o.v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}><o.icon className="w-3.5 h-3.5" />{o.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild><IconButton className="relative"><Bell className="w-5 h-5" />{unread > 0 && <span style={{ background: T.pink }} className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white" />}</IconButton></PopoverTrigger>
              <PopoverContent className="w-80 rounded-2xl border border-slate-900/10 shadow-float p-3" align="end">
                <div className="flex items-center justify-between mb-2 px-1"><p className="font-semibold">Notifications</p>{unread > 0 && <button onClick={markAllRead} className="text-[13px] font-medium" style={{ color: T.cyan }}>Mark all read</button>}</div>
                <div className="space-y-1.5 max-h-80 overflow-auto">
                  {notifications.length === 0 && <p className="text-[14px] text-slate-500 py-8 text-center">No notifications yet</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className={`rounded-xl p-3 ${n.read_at ? '' : 'bg-slate-900/5'}`}>
                      <p className="font-medium text-[14px] flex items-center gap-1.5"><Gift className="w-4 h-4" style={{ color: T.pink }} /> {n.title}</p>
                      {n.body && <p className="text-[13px] text-slate-600 mt-0.5">{n.body}</p>}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <IconButton onClick={onLogout}><LogOut className="w-5 h-5" /></IconButton>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6 overflow-x-auto">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 border border-slate-900/10 p-1">
            {tabDef.map((t) => (
              <button key={t.v} onClick={() => setTab(t.v)} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition whitespace-nowrap ${tab === t.v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}><t.icon className="w-4 h-4" /> {t.label}</button>
            ))}
          </div>
        </div>

        {tab === 'globe' && <GlobeTab publicBirthdays={publicBirthdays} tM={tM} tD={tD} onSelect={setSelected} />}
        {tab === 'upcoming' && <UpcomingTab mode={mode} publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} profile={profile} onSelect={setSelected} />}
        {tab === 'calendar' && <CalendarTab mode={mode} publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} profile={profile} onSelect={setSelected} tM={tM} tD={tD} />}
        {tab === 'discover' && <DiscoverTab user={user} followedIds={followedIds} follow={follow} unfollow={unfollow} />}
        {tab === 'personal' && <PersonalTab user={user} personal={personal} reload={reload} followedIds={followedIds} publicBirthdays={publicBirthdays} unfollow={unfollow} onSelect={setSelected} />}
        {tab === 'profile' && <ProfileTab user={user} profile={profile} setProfile={setProfile} reload={reload} />}
      </div>

      <PersonDialog person={selected} onClose={() => setSelected(null)} followedIds={followedIds} follow={follow} unfollow={unfollow} meId={user.id} />
    </div>
  )
}

/* ===== Globe Tab ===== */
function GlobeTab({ publicBirthdays, tM, tD, onSelect }) {
  const points = useMemo(() => buildGlobePoints(publicBirthdays, tM, tD), [publicBirthdays, tM, tD])
  const todays = publicBirthdays.filter((b) => b.birth_month === tM && b.birth_day === tD)
  const week = publicBirthdays.filter((b) => { const d = daysUntil(b.birth_month, b.birth_day); return d > 0 && d <= 7 })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.58)' }}>
        <div className="absolute top-5 left-6 z-10"><p className="text-[13px] text-slate-600">Live birthday globe</p><p className="font-semibold">Pink pins celebrate today</p></div>
        <div className="pt-6"><GlobeView points={points} onPointClick={(p) => onSelect(p.data)} /></div>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5"><p className="font-display text-3xl font-bold" style={{ color: T.pink }}>{todays.length}</p><p className="text-[13px] text-slate-600 mt-1">celebrating today</p></Card>
          <Card className="p-5"><p className="font-display text-3xl font-bold" style={{ color: T.orange }}>{week.length}</p><p className="text-[13px] text-slate-600 mt-1">in the next 7 days</p></Card>
        </div>
        <Card className="p-5">
          <p className="font-semibold mb-3">Today · {MONTH_ABBR[tM - 1]} {tD}</p>
          <div className="space-y-1.5 max-h-[300px] overflow-auto">
            {todays.length === 0 && <p className="text-[14px] text-slate-500 py-6 text-center">No public birthdays today.</p>}
            {todays.map((b) => <PersonRow key={b.id} b={b} onClick={() => onSelect(b)} />)}
          </div>
        </Card>
      </div>
    </div>
  )
}

function PersonRow({ b, onClick }) {
  const c = COUNTRY_MAP[b.country_code]
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 rounded-2xl p-2 hover:bg-slate-900/5 transition">
      <Avatar name={b.display_name} size="w-10 h-10" text="text-sm" />
      <div className="min-w-0 flex-1"><p className="font-medium text-[15px] truncate">{b.display_name}</p><p className="text-[13px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c ? c.name : 'Global'}</p></div>
    </button>
  )
}

/* ===== entries ===== */
function buildEntries(mode, publicBirthdays, followedIds, personal, profile) {
  if (mode === 'global') return publicBirthdays.map((b) => ({ ...b, name: b.display_name, source: 'public' }))
  const list = []
  if (profile?.birth_month) list.push({ id: 'me', name: (profile.display_name || 'You') + ' (you)', birth_month: profile.birth_month, birth_day: profile.birth_day, source: 'self' })
  personal.forEach((p) => list.push({ id: p.id, name: p.person_name, birth_month: p.birth_month, birth_day: p.birth_day, relationship: p.relationship, source: 'personal' }))
  publicBirthdays.filter((b) => followedIds.includes(b.id)).forEach((b) => list.push({ ...b, name: b.display_name, source: 'subscribed' }))
  return list
}
const SRC_COLOR = { self: '#FF5C93', personal: '#FFB020', subscribed: '#A78BFA', public: '#A78BFA' }

/* ===== Upcoming Tab ===== */
function UpcomingTab({ mode, publicBirthdays, followedIds, personal, profile, onSelect }) {
  const entries = useMemo(() => buildEntries(mode, publicBirthdays, followedIds, personal, profile), [mode, publicBirthdays, followedIds, personal, profile])
  const upcoming = useMemo(() => entries.map((e) => ({ ...e, days: daysUntil(e.birth_month, e.birth_day) })).filter((e) => e.days <= 7).sort((a, b) => a.days - b.days), [entries])

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5"><h2 className="font-display text-[28px] font-bold">Next 7 days</h2><span className="text-[15px] text-slate-600">{upcoming.length} coming up</span></div>
      {upcoming.length === 0 && <Card className="p-12 text-center"><div className="w-12 h-12 rounded-2xl mx-auto mb-2 bg-slate-900/5 flex items-center justify-center"><Sparkles className="w-6 h-6 text-slate-500" /></div><p className="font-semibold text-lg">No birthdays in the next week</p><p className="text-slate-600 mt-1">{mode === 'global' ? 'Invite friends so the globe fills up.' : 'Follow people or add private birthdays.'}</p></Card>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {upcoming.map((e, i) => {
          const c = COUNTRY_MAP[e.country_code]; const clickable = e.source === 'public' || e.source === 'subscribed'; const col = SRC_COLOR[e.source]
          return (
            <Card key={i} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: col + '26', color: col }}>{untilLabel(e.days)}</span>
                <span className="text-[13px] font-medium text-slate-500">{MONTH_ABBR[e.birth_month - 1]} {e.birth_day}</span>
              </div>
              <button disabled={!clickable} onClick={() => clickable && onSelect(e)} className="w-full text-left flex items-center gap-3">
                <Avatar name={e.name} />
                <div className="min-w-0"><p className="font-medium text-[15px] truncate">{e.name}</p><p className="text-[13px] text-slate-500">{e.source === 'personal' ? (e.relationship || 'Private') : c ? c.name : (e.source === 'self' ? 'Your birthday' : 'Global')}</p></div>
              </button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ===== Calendar Tab ===== */
function CalendarTab({ mode, publicBirthdays, followedIds, personal, profile, onSelect, tM, tD }) {
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1)
  const entries = useMemo(() => buildEntries(mode, publicBirthdays, followedIds, personal, profile), [mode, publicBirthdays, followedIds, personal, profile])
  const byDay = useMemo(() => { const map = {}; entries.filter((e) => e.birth_month === viewMonth).forEach((e) => { (map[e.birth_day] = map[e.birth_day] || []).push(e) }); return map }, [entries, viewMonth])
  const firstDow = new Date(2025, viewMonth - 1, 1).getDay()
  const totalDays = daysInMonth(viewMonth, 2025)
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="font-display text-[24px] font-bold">{MONTHS[viewMonth - 1]}</h2><p className="text-[14px] text-slate-600">{mode === 'global' ? 'Public birthdays worldwide' : 'You, your people & subscriptions'}</p></div>
        <div className="flex gap-1"><IconButton onClick={() => setViewMonth((m) => (m === 1 ? 12 : m - 1))}><ChevronLeft className="w-5 h-5" /></IconButton><IconButton onClick={() => setViewMonth((m) => (m === 12 ? 1 : m + 1))}><ChevronRight className="w-5 h-5" /></IconButton></div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center text-[12px] font-medium text-slate-500">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const list = byDay[d] || []; const isToday = viewMonth === tM && d === tD
          return (
            <div key={i} className="min-h-[84px] rounded-2xl p-2 bg-slate-900/5" style={isToday ? { boxShadow: `inset 0 0 0 2px ${T.pink}` } : {}}>
              <div className="text-[12px] font-semibold" style={{ color: isToday ? T.pink : 'rgba(15,23,42,0.58)' }}>{d}</div>
              <div className="space-y-1 mt-1">
                {list.slice(0, 2).map((e, idx) => { const col = SRC_COLOR[e.source]; return (
                  <button key={idx} onClick={() => (e.source === 'public' || e.source === 'subscribed') && onSelect(e)} className="w-full truncate text-left text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: col + '2e', color: col }}>{e.name}</button>
                )})}
                {list.length > 2 && <div className="text-[10px] text-slate-500 px-1">+{list.length - 2} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ===== Discover Tab ===== */
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
    <div>
      <h2 className="font-display text-[28px] font-bold mb-4">Discover</h2>
      <div className="relative max-w-md mb-5">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(q)} placeholder="Search people by name" className={FIELD + ' pl-10'} />
      </div>
      {busy && <p className="text-[14px] text-slate-500">Searching…</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((b) => {
          const c = COUNTRY_MAP[b.country_code]; const following = followedIds.includes(b.id)
          return (
            <Card key={b.id} className="p-4 flex items-center gap-3">
              <Avatar name={b.display_name} />
              <div className="min-w-0 flex-1"><p className="font-medium text-[15px] truncate">{b.display_name}</p><p className="text-[13px] text-slate-500 truncate">{MONTH_ABBR[b.birth_month - 1]} {b.birth_day} · {c ? c.name : 'Global'}</p></div>
              {following ? <IconButton className="bg-slate-900/5" onClick={() => unfollow(b.id)}><UserMinus className="w-4 h-4" /></IconButton> : <Button variant="primary" onClick={() => follow(b.id)} className="px-3.5 py-2"><UserPlus className="w-4 h-4" /></Button>}
            </Card>
          )
        })}
      </div>
      {!busy && results.length === 0 && <p className="text-[14px] text-slate-500">No public profiles found.</p>}
    </div>
  )
}

/* ===== Personal Tab ===== */
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
    setName(''); setMonth(''); setDay(''); setYear(''); setRel(''); toast.success('Added to your private calendar'); reload()
  }
  async function remove(id) { await supabase.from('personal_birthdays').delete().eq('id', id); toast.success('Removed'); reload() }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-6">
        <h3 className="font-semibold text-lg flex items-center gap-2"><Plus className="w-5 h-5" style={{ color: T.pink }} /> Add a private birthday</h3>
        <p className="text-[14px] text-slate-600 mb-4">Only you can see these — for people not on BddayBook.</p>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person's name" className={FIELD} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className={FIELD}><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={day} onValueChange={setDay}><SelectTrigger className={FIELD}><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year?" className={FIELD} />
          </div>
          <Select value={rel} onValueChange={setRel}><SelectTrigger className={FIELD}><SelectValue placeholder="Relationship (optional)" /></SelectTrigger><SelectContent>{['Family','Friend','Partner','Colleague','Other'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          <Button onClick={add} variant="light" disabled={busy} className="w-full py-3">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add birthday'}</Button>
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Users className="w-5 h-5" style={{ color: T.orange }} /> Private birthdays ({personal.length})</h3>
          <div className="space-y-1 max-h-64 overflow-auto">
            {personal.length === 0 && <p className="text-[14px] text-slate-500 py-4 text-center">Nothing yet — add someone.</p>}
            {personal.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-slate-900/5">
                <Avatar name={p.person_name} size="w-10 h-10" text="text-sm" />
                <div className="flex-1 min-w-0"><p className="font-medium text-[15px] truncate">{p.person_name}</p><p className="text-[13px] text-slate-500">{MONTH_ABBR[p.birth_month - 1]} {p.birth_day}{p.relationship ? ` · ${p.relationship}` : ''}</p></div>
                <IconButton onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></IconButton>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Heart className="w-5 h-5" style={{ color: T.pink }} /> Subscriptions ({subscribed.length})</h3>
          <div className="space-y-1 max-h-64 overflow-auto">
            {subscribed.length === 0 && <p className="text-[14px] text-slate-500 py-4 text-center">Follow people from Discover.</p>}
            {subscribed.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-slate-900/5">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => onSelect(b)}><Avatar name={b.display_name} size="w-10 h-10" text="text-sm" /><div className="min-w-0"><p className="font-medium text-[15px] truncate">{b.display_name}</p><p className="text-[13px] text-slate-500">{MONTH_ABBR[b.birth_month - 1]} {b.birth_day}</p></div></button>
                <IconButton onClick={() => unfollow(b.id)}><UserMinus className="w-4 h-4" /></IconButton>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ===== Profile Tab ===== */
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
  const [offsets, setOffsets] = useState(Array.isArray(profile?.reminder_offsets) ? profile.reminder_offsets : [1])
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const dayCount = month ? daysInMonth(Number(month)) : 31
  const toggleOffset = (o) => setOffsets((prev) => prev.includes(o) ? prev.filter((v) => v !== o) : [...prev, o].sort((a, b) => b - a))
  const lbl = 'text-[13px] font-medium text-slate-600'

  async function save() {
    setBusy(true)
    const c = COUNTRY_MAP[country]
    const payload = { id: user.id, email: user.email, display_name: name, birth_month: month ? Number(month) : null, birth_day: day ? Number(day) : null,
      birth_year: year ? Number(year) : null, birth_year_public: yearPublic, country: c?.name || null, country_code: country || null,
      x_handle: x || null, instagram_handle: ig || null, is_public: isPublic, reminders_enabled: reminders, reminder_offsets: offsets.length ? offsets : [1], onboarded: true, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().maybeSingle()
    setBusy(false)
    if (error) { toast.error(error.message); return }
    setProfile(data); toast.success('Profile saved'); reload()
  }
  async function testReminder() {
    setTesting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/reminders/self-test', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: '{}' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to send')
      toast.success(`Test reminder sent to ${j.to}. Check your inbox!`)
    } catch (e) { toast.error(e.message || 'Could not send test') } finally { setTesting(false) }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5"><Avatar name={name || user.email} size="w-14 h-14" text="text-xl" /><div><h2 className="font-display text-[22px] font-bold">Your profile</h2><p className="text-[14px] text-slate-600">{user.email}</p></div></div>
        <div className="space-y-4">
          <div><Label className={lbl}>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={FIELD + ' mt-1.5'} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className={lbl}>Month</Label><Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className={FIELD + ' mt-1.5'}><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className={lbl}>Day</Label><Select value={day} onValueChange={setDay}><SelectTrigger className={FIELD + ' mt-1.5'}><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className={lbl}>Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Optional" className={FIELD + ' mt-1.5'} /></div>
          </div>
          <div><Label className={lbl}>Country</Label><Select value={country} onValueChange={setCountry}><SelectTrigger className={FIELD + ' mt-1.5'}><SelectValue placeholder="Country" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className={lbl + ' flex items-center gap-1'}><Twitter className="w-3.5 h-3.5" /> X</Label><Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className={FIELD + ' mt-1.5'} /></div>
            <div><Label className={lbl + ' flex items-center gap-1'}><Instagram className="w-3.5 h-3.5" /> Instagram</Label><Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className={FIELD + ' mt-1.5'} /></div>
          </div>
          <Button onClick={save} variant="primary" disabled={busy} className="w-full py-3">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save profile'}</Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold">Privacy</h3>
          <ToggleRow title="Public birthday" desc="Show on the global calendar & globe" checked={isPublic} onChange={setIsPublic} />
          <ToggleRow title="Show birth year" desc="Reveal your age publicly" checked={yearPublic} onChange={setYearPublic} disabled={!year} />
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Reminders</h3><Switch checked={reminders} onCheckedChange={setReminders} className="data-[state=checked]:bg-[#34C759]" /></div>
          <p className="text-[14px] text-slate-600 mt-1 mb-3">Choose when to get emailed before each birthday.</p>
          <div className="flex flex-wrap gap-2">
            {[{ o: 3, l: '3 days before' }, { o: 1, l: '1 day before' }, { o: 0, l: 'Morning of' }].map(({ o, l }) => {
              const on = offsets.includes(o)
              return <button key={o} type="button" disabled={!reminders} onClick={() => toggleOffset(o)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-40 ${on ? 'text-white' : 'bg-slate-900/5 text-slate-700 hover:bg-slate-900/10'}`} style={on ? { backgroundImage: GRAD } : {}}>{on && <Check className="w-3.5 h-3.5" />}{l}</button>
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-900/10">
            <Button onClick={testReminder} variant="soft" disabled={testing} className="w-full py-2.5">{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Bell className="w-4 h-4" /> Send me a test reminder now</>}</Button>
            <p className="text-[12px] text-slate-500 text-center mt-2">Emails you a live preview of your nearest upcoming reminder.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function ToggleRow({ title, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-900/5 border border-slate-900/10 px-4 py-3">
      <div><p className="font-medium text-[15px]">{title}</p><p className="text-[13px] text-slate-500">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="data-[state=checked]:bg-[#34C759]" />
    </div>
  )
}

/* ===== Person Dialog ===== */
function PersonDialog({ person, onClose, followedIds, follow, unfollow, meId }) {
  if (!person) return null
  const c = COUNTRY_MAP[person.country_code]
  const following = followedIds.includes(person.id)
  const isMe = person.id === meId
  const age = person.birth_year && person.birth_year_public ? new Date().getFullYear() - person.birth_year : null
  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-[28px] border border-slate-900/10 shadow-float p-0 overflow-hidden max-w-md">
        <div className="p-6 text-white" style={{ backgroundImage: GRAD }}>
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur flex items-center justify-center text-2xl font-bold">{(person.display_name || '?')[0]?.toUpperCase()}</div>
              <div className="text-left"><DialogTitle className="text-2xl font-bold">{person.display_name}</DialogTitle><DialogDescription className="text-white/80">{c ? c.name : 'Global'}</DialogDescription></div>
            </div>
          </DialogHeader>
        </div>
        <div className="p-6 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 border border-slate-900/10 px-3.5 py-2 text-[14px] font-medium"><Cake className="w-4 h-4" style={{ color: T.pink }} /> {MONTHS[person.birth_month - 1]} {ordinal(person.birth_day)}{age ? ` · turning ${age + 1}` : ''}</div>
          <div className="flex flex-wrap gap-2">
            {person.x_handle && <a href={`https://x.com/${person.x_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 border border-slate-900/10 px-3.5 py-2 text-[14px] font-medium hover:bg-slate-900/10 transition"><Twitter className="w-4 h-4" /> {person.x_handle}</a>}
            {person.instagram_handle && <a href={`https://instagram.com/${person.instagram_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 border border-slate-900/10 px-3.5 py-2 text-[14px] font-medium hover:bg-slate-900/10 transition"><Instagram className="w-4 h-4" /> {person.instagram_handle}</a>}
          </div>
          {!person.x_handle && !person.instagram_handle && <p className="text-[13px] text-slate-500">No socials shared.</p>}
          {!isMe && (following
            ? <Button variant="soft" onClick={() => { unfollow(person.id); onClose() }} className="w-full py-3"><UserMinus className="w-4 h-4" /> Unsubscribe</Button>
            : <Button variant="primary" onClick={() => { follow(person.id); onClose() }} className="w-full py-3"><Bell className="w-4 h-4" /> Subscribe to birthday</Button>)}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ===== helpers ===== */
function buildGlobePoints(publicBirthdays, tM, tD) {
  const pts = []
  for (const b of publicBirthdays) {
    const c = COUNTRY_MAP[b.country_code]; if (!c) continue
    const isToday = b.birth_month === tM && b.birth_day === tD
    const dU = daysUntil(b.birth_month, b.birth_day); const soon = dU > 0 && dU <= 7
    const jLat = ((hashCode(b.id) % 100) / 100 - 0.5) * 4
    const jLng = ((hashCode(b.id + 'x') % 100) / 100 - 0.5) * 4
    pts.push({ lat: c.lat + jLat, lng: c.lng + jLng, color: isToday ? '#FF5C93' : soon ? '#FFB020' : '#A78BFA', r: isToday ? 0.8 : soon ? 0.5 : 0.28, alt: isToday ? 0.1 : soon ? 0.05 : 0.01, label: `${b.display_name} · ${c.name}${isToday ? ' · Today!' : soon ? ` · in ${dU}d` : ''}`, data: b })
  }
  return pts
}
function hashCode(str) { let h = 0; const s = String(str || ''); for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 } return Math.abs(h) }
