'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { COUNTRIES, COUNTRY_MAP, flagEmoji } from '@/lib/countries'
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
  Heart, Sparkles, Cake, ArrowRight, Check, Zap, Mail, Lock, User, PartyPopper, Share2,
} from 'lucide-react'

const GlobeView = dynamic(() => import('@/components/GlobeView'), { ssr: false })

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const T = {
  coral: '#FF5C7A',
  coralLight: '#FF8FA3',
  amber: '#FFB020',
  amberLight: '#FFCC4D',
  teal: '#2DD4BF',
  tealLight: '#5EEAD4',
  emerald: '#10B981',
  orange: '#F97316',
  rose: '#F43F5E',
}
const GRAD = 'linear-gradient(135deg, #FF5C7A 0%, #FFB020 50%, #2DD4BF 100%)'
const GRAD_CORAL = 'linear-gradient(135deg, #FF5C7A 0%, #FF8FA3 100%)'
const GRAD_AMBER = 'linear-gradient(135deg, #FFB020 0%, #FFCC4D 100%)'
const GRAD_TEAL = 'linear-gradient(135deg, #2DD4BF 0%, #5EEAD4 100%)'
const FIELD = 'w-full rounded-xl bg-white/[0.05] px-4 py-3 text-[15px] text-white placeholder:text-white/30 border border-white/10 focus:border-white/25 focus:outline-none focus:ring-4 focus:ring-white/[0.06] transition-all duration-200 input-focus'

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

/* ===== Motion variants ===== */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
}
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
}

/* ===== primitives ===== */
function Card({ className = '', children, style, onClick, hover = false }) {
  return (
    <div
      style={style}
      onClick={onClick}
      className={`rounded-3xl glass-card shadow-soft ${hover ? 'card-lift cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none shimmer'
  const map = {
    primary: 'text-white px-5 py-2.5 shadow-glow-coral hover:brightness-110 hover:shadow-glow-coral',
    light: 'bg-white text-[#08080f] px-5 py-2.5 hover:bg-white/90 shadow-soft',
    soft: 'bg-white/10 text-white px-5 py-2.5 hover:bg-white/[0.16] border border-white/10',
    ghost: 'text-white/70 px-3 py-2 hover:bg-white/10 hover:text-white',
  }
  const style = variant === 'primary' ? { backgroundImage: GRAD_CORAL } : undefined
  return <button {...props} style={style} className={`${base} ${map[variant]} ${className}`}>{children}</button>
}
function IconButton({ className = '', children, ...props }) {
  return (
    <button {...props} className={`w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 active:scale-90 ${className}`}>
      {children}
    </button>
  )
}
function Avatar({ name, size = 'w-11 h-11', text = 'text-base' }) {
  return (
    <div
      style={{ backgroundImage: GRAD_CORAL }}
      className={`${size} shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-soft`}
    >
      {(name || '?')[0]?.toUpperCase()}
    </div>
  )
}
function Badge({ children, color, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${className}`}
      style={{ background: color + '20', color, border: `1px solid ${color}30` }}
    >
      {children}
    </span>
  )
}
function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/[0.06] border border-white/10">
            <Icon className="w-5 h-5 text-white/80" />
          </div>
        )}
        <div>
          <h2 className="font-display text-[26px] font-bold leading-tight">{title}</h2>
          {subtitle && <p className="text-[14px] text-white/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
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
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl animate-float" style={{ backgroundImage: GRAD_CORAL }}>
            <Cake className="w-8 h-8 text-white" />
          </div>
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF5C7A] animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-2 h-2 rounded-full bg-[#FFB020] animate-bounce" style={{ animationDelay: '0.15s' }} />
            <span className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 stars opacity-50 pointer-events-none" />
      <AnimatePresence mode="wait">
        {screen === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Landing publicBirthdays={publicBirthdays} onStart={() => setScreen('auth')} />
          </motion.div>
        )}
        {screen === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Auth onBack={() => setScreen('landing')} onAuthed={async (sess) => {
              setSession(sess)
              const prof = await loadProfile(sess.user.id); setProfile(prof)
              await refreshUserData(sess.user.id)
              setScreen(prof && prof.onboarded ? 'app' : 'onboarding')
            }} />
          </motion.div>
        )}
        {screen === 'onboarding' && user && (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Onboarding user={user} initial={profile} onDone={async (prof) => {
              setProfile(prof); await refreshUserData(user.id); setScreen('app'); toast.success('Welcome aboard!')
            }} />
          </motion.div>
        )}
        {screen === 'app' && user && (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Dashboard user={user} profile={profile} setProfile={setProfile}
              publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} notifications={notifications}
              reload={() => refreshUserData(user.id)}
              onLogout={async () => { await supabase.auth.signOut(); setScreen('landing') }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ===== Landing ===== */
function Landing({ publicBirthdays, onStart }) {
  const now = new Date(); const tM = now.getMonth() + 1; const tD = now.getDate()
  const points = useMemo(() => buildGlobePoints(publicBirthdays, tM, tD), [publicBirthdays, tM, tD])
  const todays = publicBirthdays.filter((b) => b.birth_month === tM && b.birth_day === tD)
  const upcoming = publicBirthdays.filter((b) => { const d = daysUntil(b.birth_month, b.birth_day); return d > 0 && d <= 7 }).length

  const features = [
    { icon: Bell, tint: T.coral, grad: GRAD_CORAL, title: 'Smart reminders', desc: 'Get an email 3 days, 1 day, or the morning of — your choice.' },
    { icon: Heart, tint: T.amber, grad: GRAD_AMBER, title: 'Follow anyone', desc: 'Subscribe to friends worldwide and never forget.' },
    { icon: Sparkles, tint: T.teal, grad: GRAD_TEAL, title: 'Private mode', desc: 'Track family & friends privately — never shown publicly.' },
  ]

  return (
    <div>
      <nav className="sticky top-0 z-30 glass border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 font-semibold"
          >
            <span style={{ backgroundImage: GRAD_CORAL }} className="w-8 h-8 rounded-xl flex items-center justify-center shadow-glow-coral">
              <Cake className="w-5 h-5 text-white" />
            </span>
            <span className="font-display text-[17px]">Birthday Globe</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Button variant="ghost" onClick={onStart}>Sign in</Button>
            <Button variant="light" onClick={onStart}>Get started</Button>
          </motion.div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-5 pt-20 pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/10 px-4 py-1.5 text-[13px] font-medium text-white/70 mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-[#10B981] pulse-dot" />
          The world's birthday calendar — live now
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="font-display text-5xl sm:text-[68px] font-bold leading-[1.03]"
        >
          Never miss a birthday.<br />
          <span className="text-gradient">Anywhere on Earth.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 text-[19px] text-white/55 max-w-2xl mx-auto leading-relaxed"
        >
          Pin your birthday to a live 3D globe, follow friends across the planet, and get a beautifully-timed email before every birthday you love.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-9 flex items-center justify-center gap-3 flex-wrap"
        >
          <Button variant="primary" onClick={onStart} className="px-7 py-3.5 text-[15px]">
            Add your birthday <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="soft" onClick={onStart} className="px-7 py-3.5 text-[15px]">
            <Globe2 className="w-4 h-4" /> Explore the globe
          </Button>
        </motion.div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:auto-rows-[200px]"
        >
          <motion.div variants={fadeUp}>
            <Card className="md:col-span-2 md:row-span-2 overflow-hidden relative confetti-bg" style={{ background: 'rgba(6,6,16,0.5)' }}>
              <div className="absolute top-5 left-6 z-10">
                <p className="text-[13px] text-white/50 font-medium">Live now</p>
                <p className="font-display font-bold text-xl mt-0.5">Celebrating today</p>
              </div>
              <div className="absolute top-5 right-6 z-10 text-right">
                <motion.p
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  className="font-display text-5xl font-bold text-gradient"
                >
                  {todays.length}
                </motion.p>
                <p className="text-[12px] text-white/40 mt-0.5">around the world</p>
              </div>
              <div className="pt-10"><GlobeView points={points} /></div>
            </Card>
          </motion.div>
          {features.map((f, i) => (
            <motion.div key={i} variants={fadeUp}>
              <Card className="p-6 flex flex-col justify-between h-full" hover>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: f.tint + '18', border: `1px solid ${f.tint}25` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.tint }} />
                </div>
                <div className="mt-auto pt-6">
                  <p className="font-semibold text-[17px]">{f.title}</p>
                  <p className="text-[14px] text-white/50 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </Card>
            </motion.div>
          ))}
          <motion.div variants={fadeUp}>
            <Card className="p-6 flex items-center justify-between h-full" hover>
              <div>
                <motion.p
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="font-display text-4xl font-bold"
                  style={{ color: T.amber }}
                >
                  {upcoming}
                </motion.p>
                <p className="text-[14px] text-white/50 mt-1">birthdays in the next 7 days</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: T.amber + '18', border: `1px solid ${T.amber}25` }}>
                <CalendarClock className="w-5 h-5" style={{ color: T.amber }} />
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 pb-10 text-center">
        <p className="text-[13px] text-white/30">Birthday Globe — celebrating every birthday, everywhere.</p>
      </footer>
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
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[420px]"
      >
        <Card className="p-8">
          <div className="flex flex-col items-center text-center mb-7">
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              style={{ backgroundImage: GRAD_CORAL }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-glow-coral"
            >
              <Cake className="w-7 h-7 text-white" />
            </motion.span>
            <h2 className="font-display text-[28px] font-bold mt-5">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
            <p className="text-[15px] text-white/50 mt-1.5">{mode === 'signup' ? 'Join the global birthday calendar' : 'Sign in to your Birthday Globe'}</p>
          </div>
          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className={FIELD + ' pl-10'} />
              </div>
            )}
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className={FIELD + ' pl-10'} />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required className={FIELD + ' pl-10'} />
            </div>
            <Button type="submit" variant="primary" disabled={busy} className="w-full py-3.5 text-[15px] mt-1">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'signup' ? 'Sign up' : 'Sign in')}
            </Button>
          </form>
          <div className="mt-6 text-center text-[14px] text-white/50">
            {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
            <button className="font-semibold text-white hover:text-[#FF5C7A] transition-colors" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
              {mode === 'signup' ? 'Sign in' : 'Create one'}
            </button>
          </div>
          <button className="mt-4 w-full text-center text-[13px] text-white/35 hover:text-white/60 transition-colors" onClick={onBack}>← Back to home</button>
        </Card>
      </motion.div>
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
  const lbl = 'text-[13px] font-medium text-white/50'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[540px]"
      >
        <Card className="p-8">
          <div className="flex items-center gap-2 mb-1">
            <PartyPopper className="w-4 h-4" style={{ color: T.coral }} />
            <p className="text-[13px] font-semibold" style={{ color: T.coral }}>SET UP YOUR PROFILE</p>
          </div>
          <h2 className="font-display text-[30px] font-bold mt-1">Add your birthday</h2>
          <p className="text-[15px] text-white/50 mb-7">This creates your pin on the global calendar.</p>
          <div className="space-y-4">
            <div>
              <Label className={lbl}>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className={FIELD + ' mt-2'} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className={lbl}>Month</Label>
                <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}>
                  <SelectTrigger className={FIELD + ' mt-2'}><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={lbl}>Day</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger className={FIELD + ' mt-2'}><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={lbl}>Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Optional" className={FIELD + ' mt-2'} />
              </div>
            </div>
            <ToggleRow title="Show my birth year" desc="Off keeps your age private" checked={yearPublic} onChange={setYearPublic} disabled={!year} />
            <div>
              <Label className={lbl}>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className={FIELD + ' mt-2'}><SelectValue placeholder="Where are you?" /></SelectTrigger>
                <SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={lbl + ' flex items-center gap-1'}><Twitter className="w-3.5 h-3.5" /> X</Label>
                <Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className={FIELD + ' mt-2'} />
              </div>
              <div>
                <Label className={lbl + ' flex items-center gap-1'}><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
                <Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className={FIELD + ' mt-2'} />
              </div>
            </div>
            <ToggleRow title="Make my birthday public" desc="Appears on the globe so people can wish you" checked={isPublic} onChange={setIsPublic} />
            <Button onClick={save} variant="primary" disabled={busy} className="w-full py-3.5 text-[15px]">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Add me to the globe <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

/* ===== Dashboard ===== */
function Dashboard({ user, profile, setProfile, publicBirthdays, followedIds, personal, notifications, reload, onLogout }) {
  const [tab, setTab] = useState('globe')
  const [mode, setMode] = useState('global')
  const [selected, setSelected] = useState(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const unread = notifications.filter((n) => !n.read_at).length
  const now = new Date(); const tM = now.getMonth() + 1; const tD = now.getDate()
  const tabRef = useRef(null)

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
      <header className="sticky top-0 z-30 glass border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 font-semibold"
          >
            <span style={{ backgroundImage: GRAD_CORAL }} className="w-8 h-8 rounded-xl flex items-center justify-center shadow-glow-coral">
              <Cake className="w-5 h-5 text-white" />
            </span>
            <span className="hidden sm:inline font-display text-[17px]">Birthday Globe</span>
          </motion.div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 p-1">
            {[{ v: 'global', label: 'Global', icon: Globe2 }, { v: 'personal', label: 'Personal', icon: Lock }].map((o) => (
              <button
                key={o.v}
                onClick={() => setMode(o.v)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${mode === o.v ? 'bg-white text-[#08080f]' : 'text-white/55 hover:text-white'}`}
              >
                <o.icon className="w-3.5 h-3.5" /> {o.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <IconButton className="relative">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span
                      style={{ background: T.coral }}
                      className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-[#08080f]"
                    >
                      {unread}
                    </span>
                  )}
                </IconButton>
              </PopoverTrigger>
              <PopoverContent className="w-80 rounded-2xl glass-elevated border border-white/10 shadow-float p-3" align="end">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="font-semibold text-[15px]">Notifications</p>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-[13px] font-medium hover:underline" style={{ color: T.teal }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-80 overflow-auto">
                  {notifications.length === 0 && (
                    <div className="py-10 text-center">
                      <Bell className="w-8 h-8 mx-auto text-white/20 mb-2" />
                      <p className="text-[14px] text-white/40">No notifications yet</p>
                    </div>
                  )}
                  {notifications.map((n) => (
                    <div key={n.id} className={`rounded-xl p-3 transition-colors ${n.read_at ? '' : 'bg-white/[0.05]'}`}>
                      <p className="font-medium text-[14px] flex items-center gap-1.5">
                        <Gift className="w-4 h-4" style={{ color: T.coral }} /> {n.title}
                      </p>
                      {n.body && <p className="text-[13px] text-white/50 mt-0.5">{n.body}</p>}
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
        <div className="mb-6 overflow-x-auto scrollbar-none">
          <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 p-1">
            {tabDef.map((t) => (
              <button
                key={t.v}
                onClick={() => setTab(t.v)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 whitespace-nowrap ${tab === t.v ? 'text-[#08080f]' : 'text-white/55 hover:text-white'}`}
              >
                {tab === t.v && (
                  <motion.div
                    layoutId="tabPill"
                    className="absolute inset-0 rounded-full bg-white"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <t.icon className="w-4 h-4" /> {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab + mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'globe' && <GlobeTab publicBirthdays={publicBirthdays} tM={tM} tD={tD} onSelect={setSelected} />}
            {tab === 'upcoming' && <UpcomingTab mode={mode} publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} profile={profile} onSelect={setSelected} />}
            {tab === 'calendar' && <CalendarTab mode={mode} publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} profile={profile} onSelect={setSelected} tM={tM} tD={tD} />}
            {tab === 'discover' && <DiscoverTab user={user} followedIds={followedIds} follow={follow} unfollow={unfollow} />}
            {tab === 'personal' && <PersonalTab user={user} personal={personal} reload={reload} followedIds={followedIds} publicBirthdays={publicBirthdays} unfollow={unfollow} onSelect={setSelected} />}
            {tab === 'profile' && <ProfileTab user={user} profile={profile} setProfile={setProfile} reload={reload} />}
          </motion.div>
        </AnimatePresence>
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
      <Card className="lg:col-span-2 overflow-hidden relative confetti-bg" style={{ background: 'rgba(6,6,16,0.5)' }}>
        <div className="absolute top-5 left-6 z-10">
          <p className="text-[13px] text-white/50 font-medium">Live birthday globe</p>
          <p className="font-semibold mt-0.5">Coral pins celebrate today</p>
        </div>
        <div className="pt-10"><GlobeView points={points} onPointClick={(p) => onSelect(p.data)} /></div>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <Card className="p-5" hover>
              <p className="font-display text-3xl font-bold" style={{ color: T.coral }}>{todays.length}</p>
              <p className="text-[13px] text-white/50 mt-1">celebrating today</p>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
            <Card className="p-5" hover>
              <p className="font-display text-3xl font-bold" style={{ color: T.amber }}>{week.length}</p>
              <p className="text-[13px] text-white/50 mt-1">in the next 7 days</p>
            </Card>
          </motion.div>
        </div>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#FF5C7A] pulse-dot" />
            <p className="font-semibold text-[15px]">Today · {MONTH_ABBR[tM - 1]} {tD}</p>
          </div>
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {todays.length === 0 && (
              <div className="py-8 text-center">
                <Cake className="w-8 h-8 mx-auto text-white/15 mb-2" />
                <p className="text-[14px] text-white/40">No public birthdays today.</p>
              </div>
            )}
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
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 rounded-2xl p-2.5 hover:bg-white/[0.05] transition-all duration-200 group">
      <Avatar name={b.display_name} size="w-10 h-10" text="text-sm" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[15px] truncate group-hover:text-[#FF8FA3] transition-colors">{b.display_name}</p>
        <p className="text-[13px] text-white/45 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {c ? `${flagEmoji(b.country_code)} ${c.name}` : 'Earth'}
        </p>
      </div>
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
const SRC_COLOR = { self: '#FF5C7A', personal: '#FFB020', subscribed: '#2DD4BF', public: '#2DD4BF' }
const SRC_LABEL = { self: 'You', personal: 'Private', subscribed: 'Following', public: 'Public' }

/* ===== Upcoming Tab ===== */
function UpcomingTab({ mode, publicBirthdays, followedIds, personal, profile, onSelect }) {
  const entries = useMemo(() => buildEntries(mode, publicBirthdays, followedIds, personal, profile), [mode, publicBirthdays, followedIds, personal, profile])
  const upcoming = useMemo(() => entries.map((e) => ({ ...e, days: daysUntil(e.birth_month, e.birth_day) })).filter((e) => e.days <= 7).sort((a, b) => a.days - b.days), [entries])

  return (
    <div>
      <SectionTitle icon={CalendarClock} title="Next 7 days" subtitle={`${upcoming.length} coming up`} />
      {upcoming.length === 0 && (
        <Card className="p-16 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-5xl mb-3"
          >
            🎈
          </motion.div>
          <p className="font-semibold text-lg">No birthdays in the next week</p>
          <p className="text-white/45 mt-1.5 text-[14px]">{mode === 'global' ? 'Invite friends so the globe fills up.' : 'Follow people or add private birthdays.'}</p>
        </Card>
      )}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {upcoming.map((e, i) => {
          const c = COUNTRY_MAP[e.country_code]; const clickable = e.source === 'public' || e.source === 'subscribed'; const col = SRC_COLOR[e.source]
          return (
            <motion.div key={i} variants={fadeUp}>
              <Card className="p-5" hover>
                <div className="flex items-center justify-between mb-4">
                  <Badge color={e.days === 0 ? T.coral : e.days <= 2 ? T.amber : T.teal}>
                    {e.days === 0 && <PartyPopper className="w-3 h-3" />}
                    {untilLabel(e.days)}
                  </Badge>
                  <span className="text-[13px] font-medium text-white/45">{MONTH_ABBR[e.birth_month - 1]} {e.birth_day}</span>
                </div>
                <button disabled={!clickable} onClick={() => clickable && onSelect(e)} className="w-full text-left flex items-center gap-3">
                  <Avatar name={e.name} />
                  <div className="min-w-0">
                    <p className="font-medium text-[15px] truncate">{e.name}</p>
                    <p className="text-[13px] text-white/45 mt-0.5">
                      {e.source === 'personal' ? (e.relationship || 'Private') : c ? `${flagEmoji(e.country_code)} ${c.name}` : (e.source === 'self' ? 'Your birthday' : 'Earth')}
                    </p>
                  </div>
                </button>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-[26px] font-bold">{MONTHS[viewMonth - 1]}</h2>
          <p className="text-[14px] text-white/45 mt-0.5">{mode === 'global' ? 'Public birthdays worldwide' : 'You, your people & subscriptions'}</p>
        </div>
        <div className="flex gap-1">
          <IconButton onClick={() => setViewMonth((m) => (m === 1 ? 12 : m - 1))}><ChevronLeft className="w-5 h-5" /></IconButton>
          <IconButton onClick={() => setViewMonth((m) => (m === 12 ? 1 : m + 1))}><ChevronRight className="w-5 h-5" /></IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-[12px] font-medium text-white/35">
        {DOW.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMonth}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-7 gap-1.5 col-span-7"
          >
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[84px]" />
              const list = byDay[d] || []; const isToday = viewMonth === tM && d === tD
              return (
                <div
                  key={i}
                  className="min-h-[84px] rounded-2xl p-2 bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06] transition-colors"
                  style={isToday ? { boxShadow: `inset 0 0 0 2px ${T.coral}`, background: `${T.coral}10` } : {}}
                >
                  <div className="text-[12px] font-semibold" style={{ color: isToday ? T.coral : 'rgba(255,255,255,0.45)' }}>{d}</div>
                  <div className="space-y-1 mt-1">
                    {list.slice(0, 2).map((e, idx) => {
                      const col = SRC_COLOR[e.source]
                      return (
                        <button
                          key={idx}
                          onClick={() => (e.source === 'public' || e.source === 'subscribed') && onSelect(e)}
                          className="w-full truncate text-left text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-transform hover:scale-[1.02]"
                          style={{ background: col + '25', color: col }}
                        >
                          {e.name}
                        </button>
                      )
                    })}
                    {list.length > 2 && <div className="text-[10px] text-white/35 px-1">+{list.length - 2} more</div>}
                  </div>
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
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
      <SectionTitle icon={Search} title="Discover" subtitle="Find people to follow on the globe" />
      <div className="relative max-w-md mb-6">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(q)}
          placeholder="Search people by name…"
          className={FIELD + ' pl-11'}
        />
      </div>
      {busy && (
        <div className="flex items-center gap-2 text-[14px] text-white/40">
          <Loader2 className="w-4 h-4 animate-spin" /> Searching…
        </div>
      )}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {results.map((b) => {
          const c = COUNTRY_MAP[b.country_code]; const following = followedIds.includes(b.id)
          return (
            <motion.div key={b.id} variants={fadeUp}>
              <Card className="p-4 flex items-center gap-3" hover>
                <Avatar name={b.display_name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[15px] truncate">{b.display_name}</p>
                  <p className="text-[13px] text-white/45 truncate mt-0.5">
                    {MONTH_ABBR[b.birth_month - 1]} {b.birth_day} · {c ? `${flagEmoji(b.country_code)} ${c.name}` : 'Earth'}
                  </p>
                </div>
                {following ? (
                  <IconButton className="bg-white/10" onClick={() => unfollow(b.id)}>
                    <UserMinus className="w-4 h-4" />
                  </IconButton>
                ) : (
                  <Button variant="primary" onClick={() => follow(b.id)} className="px-3.5 py-2">
                    <UserPlus className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            </motion.div>
          )
        })}
      </motion.div>
      {!busy && results.length === 0 && (
        <Card className="p-12 text-center">
          <Search className="w-8 h-8 mx-auto text-white/15 mb-2" />
          <p className="text-[14px] text-white/40">No public profiles found.</p>
        </Card>
      )}
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
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: T.coral + '18', border: `1px solid ${T.coral}25` }}>
            <Plus className="w-5 h-5" style={{ color: T.coral }} />
          </div>
          <h3 className="font-semibold text-lg">Add a private birthday</h3>
        </div>
        <p className="text-[14px] text-white/45 mb-5 ml-[46px]">Only you can see these — for people not on Birthday Globe.</p>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person's name" className={FIELD} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}>
              <SelectTrigger className={FIELD}><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className={FIELD}><SelectValue placeholder="Day" /></SelectTrigger>
              <SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year?" className={FIELD} />
          </div>
          <Select value={rel} onValueChange={setRel}>
            <SelectTrigger className={FIELD}><SelectValue placeholder="Relationship (optional)" /></SelectTrigger>
            <SelectContent>{['Family','Friend','Partner','Colleague','Other'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={add} variant="light" disabled={busy} className="w-full py-3">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Add birthday <Plus className="w-4 h-4" /></>}
          </Button>
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: T.amber + '18', border: `1px solid ${T.amber}25` }}>
              <Users className="w-5 h-5" style={{ color: T.amber }} />
            </div>
            <h3 className="font-semibold">Private birthdays ({personal.length})</h3>
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {personal.length === 0 && (
              <div className="py-8 text-center">
                <Users className="w-8 h-8 mx-auto text-white/15 mb-2" />
                <p className="text-[14px] text-white/40">Nothing yet — add someone.</p>
              </div>
            )}
            {personal.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-white/[0.05] transition-all duration-200 group">
                <Avatar name={p.person_name} size="w-10 h-10" text="text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[15px] truncate">{p.person_name}</p>
                  <p className="text-[13px] text-white/45 mt-0.5">{MONTH_ABBR[p.birth_month - 1]} {p.birth_day}{p.relationship ? ` · ${p.relationship}` : ''}</p>
                </div>
                <IconButton onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: T.coral + '18', border: `1px solid ${T.coral}25` }}>
              <Heart className="w-5 h-5" style={{ color: T.coral }} />
            </div>
            <h3 className="font-semibold">Subscriptions ({subscribed.length})</h3>
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {subscribed.length === 0 && (
              <div className="py-8 text-center">
                <Heart className="w-8 h-8 mx-auto text-white/15 mb-2" />
                <p className="text-[14px] text-white/40">Follow people from Discover.</p>
              </div>
            )}
            {subscribed.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-white/[0.05] transition-all duration-200 group">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => onSelect(b)}>
                  <Avatar name={b.display_name} size="w-10 h-10" text="text-sm" />
                  <div className="min-w-0">
                    <p className="font-medium text-[15px] truncate">{b.display_name}</p>
                    <p className="text-[13px] text-white/45 mt-0.5">{MONTH_ABBR[b.birth_month - 1]} {b.birth_day}</p>
                  </div>
                </button>
                <IconButton onClick={() => unfollow(b.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <UserMinus className="w-4 h-4" />
                </IconButton>
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
  const lbl = 'text-[13px] font-medium text-white/50'

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
        <div className="flex items-center gap-3.5 mb-6">
          <Avatar name={name || user.email} size="w-14 h-14" text="text-xl" />
          <div>
            <h2 className="font-display text-[22px] font-bold">Your profile</h2>
            <p className="text-[14px] text-white/45 mt-0.5">{user.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div><Label className={lbl}>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={FIELD + ' mt-2'} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className={lbl}>Month</Label>
              <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}>
                <SelectTrigger className={FIELD + ' mt-2'}><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className={lbl}>Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger className={FIELD + ' mt-2'}><SelectValue placeholder="Day" /></SelectTrigger>
                <SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className={lbl}>Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Optional" className={FIELD + ' mt-2'} /></div>
          </div>
          <div>
            <Label className={lbl}>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className={FIELD + ' mt-2'}><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={lbl + ' flex items-center gap-1'}><Twitter className="w-3.5 h-3.5" /> X</Label>
              <Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className={FIELD + ' mt-2'} />
            </div>
            <div>
              <Label className={lbl + ' flex items-center gap-1'}><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
              <Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className={FIELD + ' mt-2'} />
            </div>
          </div>
          <Button onClick={save} variant="primary" disabled={busy} className="w-full py-3.5">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save profile <Check className="w-4 h-4" /></>}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-white/60" /> Privacy
          </h3>
          <ToggleRow title="Public birthday" desc="Show on the global calendar & globe" checked={isPublic} onChange={setIsPublic} />
          <ToggleRow title="Show birth year" desc="Reveal your age publicly" checked={yearPublic} onChange={setYearPublic} disabled={!year} />
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-white/60" /> Reminders
            </h3>
            <Switch checked={reminders} onCheckedChange={setReminders} className="data-[state=checked]:bg-[#10B981]" />
          </div>
          <p className="text-[14px] text-white/45 mt-1.5 mb-4">Choose when to get emailed before each birthday.</p>
          <div className="flex flex-wrap gap-2">
            {[{ o: 3, l: '3 days before' }, { o: 1, l: '1 day before' }, { o: 0, l: 'Morning of' }].map(({ o, l }) => {
              const on = offsets.includes(o)
              return (
                <button
                  key={o}
                  type="button"
                  disabled={!reminders}
                  onClick={() => toggleOffset(o)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 disabled:opacity-40 ${on ? 'text-white shadow-glow-coral' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12] border border-white/10'}`}
                  style={on ? { backgroundImage: GRAD_CORAL } : {}}
                >
                  {on && <Check className="w-3.5 h-3.5" />}{l}
                </button>
              )
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <Button onClick={testReminder} variant="soft" disabled={testing} className="w-full py-2.5">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Send me a test reminder</>}
            </Button>
            <p className="text-[12px] text-white/35 text-center mt-2.5">Emails you a live preview of your nearest upcoming reminder.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function ToggleRow({ title, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3.5">
      <div>
        <p className="font-medium text-[15px]">{title}</p>
        <p className="text-[13px] text-white/40 mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="data-[state=checked]:bg-[#10B981]" />
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
      <DialogContent className="rounded-3xl glass-elevated border border-white/10 shadow-float p-0 overflow-hidden max-w-md">
        <div className="relative p-6 text-white" style={{ backgroundImage: GRAD_CORAL }}>
          <div className="absolute inset-0 confetti-bg opacity-30" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur flex items-center justify-center text-2xl font-bold shadow-soft">
                {(person.display_name || '?')[0]?.toUpperCase()}
              </div>
              <div className="text-left">
                <DialogTitle className="text-2xl font-bold font-display">{person.display_name}</DialogTitle>
                <DialogDescription className="text-white/80 mt-0.5">{c ? `${flagEmoji(person.country_code)} ${c.name}` : 'Earth'}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className="p-6 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/10 px-4 py-2 text-[14px] font-medium">
            <Cake className="w-4 h-4" style={{ color: T.coral }} />
            {MONTHS[person.birth_month - 1]} {ordinal(person.birth_day)}{age ? ` · turning ${age + 1}` : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {person.x_handle && (
              <a href={`https://x.com/${person.x_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-4 py-2 text-[14px] font-medium hover:bg-white/[0.12] transition-all duration-200">
                <Twitter className="w-4 h-4" /> {person.x_handle}
              </a>
            )}
            {person.instagram_handle && (
              <a href={`https://instagram.com/${person.instagram_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-4 py-2 text-[14px] font-medium hover:bg-white/[0.12] transition-all duration-200">
                <Instagram className="w-4 h-4" /> {person.instagram_handle}
              </a>
            )}
          </div>
          {!person.x_handle && !person.instagram_handle && <p className="text-[13px] text-white/35">No socials shared.</p>}
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
    pts.push({
      lat: c.lat + jLat, lng: c.lng + jLng,
      color: isToday ? '#FF5C7A' : soon ? '#FFB020' : '#2DD4BF',
      r: isToday ? 0.8 : soon ? 0.5 : 0.28,
      alt: isToday ? 0.1 : soon ? 0.05 : 0.01,
      label: `${flagEmoji(b.country_code)} ${b.display_name} · ${c.name}${isToday ? ' · Today!' : soon ? ` · in ${dU}d` : ''}`,
      data: b,
    })
  }
  return pts
}
function hashCode(str) { let h = 0; const s = String(str || ''); for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 } return Math.abs(h) }
