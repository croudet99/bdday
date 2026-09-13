'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { COUNTRIES, COUNTRY_MAP, flagEmoji } from '@/lib/countries'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Globe2, Cake, Bell, LogOut, Calendar as CalIcon, Search, Users, UserPlus, UserMinus,
  Instagram, Twitter, MapPin, ChevronLeft, ChevronRight, Sparkles, Heart, PartyPopper, Loader2, Plus, Trash2, Gift,
} from 'lucide-react'

const GlobeView = dynamic(() => import('@/components/GlobeView'), { ssr: false })

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function daysInMonth(month, year = 2024) { return new Date(year, month, 0).getDate() }
function ordinal(d) { const s = ['th', 'st', 'nd', 'rd'], v = d % 100; return d + (s[(v - 20) % 10] || s[v] || s[0]) }

export default function App() {
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('landing') // landing | auth | onboarding | app
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  const user = session?.user || null

  // data
  const [publicBirthdays, setPublicBirthdays] = useState([])
  const [followedIds, setFollowedIds] = useState([])
  const [personal, setPersonal] = useState([])
  const [notifications, setNotifications] = useState([])

  const loadProfile = useCallback(async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    return data
  }, [])

  const loadPublic = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id,display_name,country,country_code,x_handle,instagram_handle,birth_month,birth_day,birth_year,birth_year_public,is_public')
      .eq('is_public', true)
      .not('birth_month', 'is', null)
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

  // bootstrap
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
      } else {
        setScreen('landing')
      }
      setLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess)
      if (event === 'SIGNED_OUT' || !sess?.user) {
        setProfile(null)
        setScreen('landing')
        return
      }
    })
    return () => { mounted = false; sub?.subscription?.unsubscribe() }
  }, [loadPublic, loadProfile, refreshUserData])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-fuchsia-950">
        <div className="flex flex-col items-center gap-3 text-purple-200">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading Birthday Globe…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-fuchsia-950 text-purple-50">
      {screen === 'landing' && <Landing publicBirthdays={publicBirthdays} onStart={() => setScreen('auth')} />}
      {screen === 'auth' && <Auth onBack={() => setScreen('landing')} onAuthed={async (sess) => {
        setSession(sess)
        const prof = await loadProfile(sess.user.id)
        setProfile(prof)
        await refreshUserData(sess.user.id)
        setScreen(prof && prof.onboarded ? 'app' : 'onboarding')
      }} />}
      {screen === 'onboarding' && user && (
        <Onboarding user={user} initial={profile} onDone={async (prof) => {
          setProfile(prof)
          await refreshUserData(user.id)
          setScreen('app')
          toast.success('Welcome aboard! 🎉')
        }} />
      )}
      {screen === 'app' && user && (
        <Dashboard
          user={user}
          profile={profile}
          setProfile={setProfile}
          publicBirthdays={publicBirthdays}
          followedIds={followedIds}
          personal={personal}
          notifications={notifications}
          reload={() => refreshUserData(user.id)}
          onLogout={async () => { await supabase.auth.signOut(); setScreen('landing') }}
        />
      )}
    </div>
  )
}

/* ---------------- Landing ---------------- */
function Landing({ publicBirthdays, onStart }) {
  const now = new Date()
  const tM = now.getMonth() + 1
  const tD = now.getDate()
  const points = useMemo(() => buildGlobePoints(publicBirthdays, tM, tD), [publicBirthdays, tM, tD])
  const todays = publicBirthdays.filter((b) => b.birth_month === tM && b.birth_day === tD)

  return (
    <div>
      <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Globe2 className="w-6 h-6 text-fuchsia-400" /> Birthday Globe
        </div>
        <Button onClick={onStart} className="bg-fuchsia-600 hover:bg-fuchsia-500">Get started</Button>
      </nav>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8 items-center pt-6 pb-16">
        <div>
          <Badge className="bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30 mb-4">🌍 The world&apos;s birthday calendar</Badge>
          <h1 className="text-5xl font-extrabold leading-tight mb-4">
            Never miss a birthday, <span className="bg-gradient-to-r from-fuchsia-400 to-pink-300 bg-clip-text text-transparent">anywhere on Earth</span>
          </h1>
          <p className="text-lg text-purple-200 mb-6">
            Add your birthday to the global calendar, watch celebrations light up a live 3D globe, follow friends,
            and get an email the day before every birthday you care about.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={onStart} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-base">
              <Cake className="w-5 h-5 mr-2" /> Add your birthday
            </Button>
          </div>
          <div className="flex gap-6 mt-8 text-sm text-purple-300">
            <div className="flex items-center gap-2"><Globe2 className="w-4 h-4" /> Live 3D globe</div>
            <div className="flex items-center gap-2"><Bell className="w-4 h-4" /> Email reminders</div>
            <div className="flex items-center gap-2"><Heart className="w-4 h-4" /> Follow friends</div>
          </div>
        </div>

        <Card className="bg-black/30 border-purple-800/50 backdrop-blur overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle className="text-purple-100 flex items-center gap-2 text-base">
              <PartyPopper className="w-4 h-4 text-fuchsia-400" /> Birthdays around the world today
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <GlobeView points={points} />
            <div className="px-4 pb-4 text-sm text-purple-300 text-center">
              {todays.length > 0 ? `${todays.length} ${todays.length === 1 ? 'person is' : 'people are'} celebrating today 🎉` : 'Sign up and be the first pin on the globe!'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ---------------- Auth ---------------- */
function Auth({ onBack, onAuthed }) {
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name } },
        })
        if (error) throw error
        if (!data.session) {
          // try immediate sign-in (works when email confirmation is disabled)
          const { data: si, error: se } = await supabase.auth.signInWithPassword({ email, password })
          if (se) { toast.info('Account created. Please check your email to confirm, then sign in.'); setMode('login'); setBusy(false); return }
          onAuthed(si.session); return
        }
        onAuthed(data.session)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuthed(data.session)
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-black/40 border-purple-800/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><Globe2 className="w-9 h-9 text-fuchsia-400" /></div>
          <CardTitle className="text-2xl">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</CardTitle>
          <CardDescription className="text-purple-300">
            {mode === 'signup' ? 'Join the global birthday calendar' : 'Sign in to your Birthday Globe'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className="bg-white/5 border-purple-700/50" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="bg-white/5 border-purple-700/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required className="bg-white/5 border-purple-700/50" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'signup' ? 'Sign up' : 'Sign in')}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-purple-300">
            {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
            <button className="text-fuchsia-400 hover:underline" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
              {mode === 'signup' ? 'Sign in' : 'Create one'}
            </button>
          </div>
          <button className="mt-3 text-center w-full text-xs text-purple-400 hover:underline" onClick={onBack}>← Back to home</button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------- Onboarding ---------------- */
function Onboarding({ user, initial, onDone }) {
  const [name, setName] = useState(initial?.display_name || user.user_metadata?.display_name || '')
  const [month, setMonth] = useState(initial?.birth_month ? String(initial.birth_month) : '')
  const [day, setDay] = useState(initial?.birth_day ? String(initial.birth_day) : '')
  const [year, setYear] = useState(initial?.birth_year ? String(initial.birth_year) : '')
  const [yearPublic, setYearPublic] = useState(initial?.birth_year_public ?? false)
  const [country, setCountry] = useState(initial?.country_code || '')
  const [x, setX] = useState(initial?.x_handle || '')
  const [ig, setIg] = useState(initial?.instagram_handle || '')
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true)
  const [busy, setBusy] = useState(false)

  const dayCount = month ? daysInMonth(Number(month)) : 31

  async function save() {
    if (!name || !month || !day || !country) { toast.error('Please fill name, birthday and country'); return }
    setBusy(true)
    const c = COUNTRY_MAP[country]
    const payload = {
      id: user.id,
      email: user.email,
      display_name: name,
      birth_month: Number(month),
      birth_day: Number(day),
      birth_year: year ? Number(year) : null,
      birth_year_public: yearPublic,
      country: c?.name || null,
      country_code: country,
      x_handle: x || null,
      instagram_handle: ig || null,
      is_public: isPublic,
      reminders_enabled: true,
      onboarded: true,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().maybeSingle()
    setBusy(false)
    if (error) { toast.error(error.message); return }
    onDone(data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg bg-black/40 border-purple-800/50 backdrop-blur">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-fuchsia-400" /><CardTitle>Let&apos;s set up your birthday</CardTitle></div>
          <CardDescription className="text-purple-300">This creates your profile on the global birthday calendar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-purple-700/50" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}>
                <SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Day" /></SelectTrigger>
                <SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Optional" className="bg-white/5 border-purple-700/50" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-purple-800/50 p-3">
            <div><p className="text-sm font-medium">Show my birth year publicly</p><p className="text-xs text-purple-400">Off = your age stays private</p></div>
            <Switch checked={yearPublic} onCheckedChange={setYearPublic} disabled={!year} />
          </div>

          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Where are you?" /></SelectTrigger>
              <SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Twitter className="w-3.5 h-3.5" /> X / Twitter</Label>
              <Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className="bg-white/5 border-purple-700/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
              <Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className="bg-white/5 border-purple-700/50" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-purple-800/50 p-3">
            <div><p className="text-sm font-medium">Make my birthday public 🌍</p><p className="text-xs text-purple-400">Appears on the global calendar &amp; globe so people can wish you</p></div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <Button onClick={save} disabled={busy} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add me to the globe 🎂'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ user, profile, setProfile, publicBirthdays, followedIds, personal, notifications, reload, onLogout }) {
  const [tab, setTab] = useState('globe')
  const [mode, setMode] = useState('global')
  const [selected, setSelected] = useState(null) // person dialog
  const unread = notifications.filter((n) => !n.read_at).length

  const now = new Date()
  const tM = now.getMonth() + 1
  const tD = now.getDate()

  async function follow(id) {
    if (id === user.id) { toast.info('That is you 🙂'); return }
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, followed_id: id })
    if (error) { toast.error(error.message); return }
    toast.success('Subscribed! You will get a reminder 🎉')
    reload()
  }
  async function unfollow(id) {
    const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Unsubscribed')
    reload()
  }
  async function markAllRead() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', user.id).is('read_at', null)
    reload()
  }

  return (
    <div>
      <header className="border-b border-purple-800/40 bg-black/20 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold"><Globe2 className="w-5 h-5 text-fuchsia-400" /> Birthday Globe</div>

          <div className="flex items-center gap-1 bg-black/30 rounded-full p-1 border border-purple-800/40">
            <button onClick={() => setMode('global')} className={`px-3 py-1 rounded-full text-xs font-medium transition ${mode === 'global' ? 'bg-fuchsia-600 text-white' : 'text-purple-300'}`}>🌍 Global</button>
            <button onClick={() => setMode('personal')} className={`px-3 py-1 rounded-full text-xs font-medium transition ${mode === 'personal' ? 'bg-fuchsia-600 text-white' : 'text-purple-300'}`}>🔒 Personal</button>
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-purple-200 hover:text-white hover:bg-white/10">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-fuchsia-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{unread}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-purple-950 border-purple-800 text-purple-50" align="end">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">Notifications</p>
                  {unread > 0 && <button onClick={markAllRead} className="text-xs text-fuchsia-400 hover:underline">Mark all read</button>}
                </div>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {notifications.length === 0 && <p className="text-sm text-purple-400 py-6 text-center">No notifications yet</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className={`rounded-lg p-2.5 text-sm ${n.read_at ? 'bg-white/5' : 'bg-fuchsia-500/10 border border-fuchsia-500/30'}`}>
                      <p className="font-medium flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 text-fuchsia-400" /> {n.title}</p>
                      {n.body && <p className="text-xs text-purple-300 mt-0.5">{n.body}</p>}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-purple-200 hover:text-white hover:bg-white/10"><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-black/30 border border-purple-800/40">
            <TabsTrigger value="globe"><Globe2 className="w-4 h-4 mr-1.5" /> Globe</TabsTrigger>
            <TabsTrigger value="calendar"><CalIcon className="w-4 h-4 mr-1.5" /> Calendar</TabsTrigger>
            <TabsTrigger value="discover"><Search className="w-4 h-4 mr-1.5" /> Discover</TabsTrigger>
            <TabsTrigger value="personal"><Users className="w-4 h-4 mr-1.5" /> My people</TabsTrigger>
            <TabsTrigger value="profile"><Cake className="w-4 h-4 mr-1.5" /> Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="globe" className="mt-6">
            <GlobeTab publicBirthdays={publicBirthdays} tM={tM} tD={tD} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="calendar" className="mt-6">
            <CalendarTab mode={mode} publicBirthdays={publicBirthdays} followedIds={followedIds} personal={personal} profile={profile} onSelect={setSelected} tM={tM} tD={tD} />
          </TabsContent>
          <TabsContent value="discover" className="mt-6">
            <DiscoverTab user={user} followedIds={followedIds} follow={follow} unfollow={unfollow} />
          </TabsContent>
          <TabsContent value="personal" className="mt-6">
            <PersonalTab user={user} personal={personal} reload={reload} followedIds={followedIds} publicBirthdays={publicBirthdays} unfollow={unfollow} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="profile" className="mt-6">
            <ProfileTab user={user} profile={profile} setProfile={setProfile} reload={reload} />
          </TabsContent>
        </Tabs>
      </div>

      <PersonDialog person={selected} onClose={() => setSelected(null)} followedIds={followedIds} follow={follow} unfollow={unfollow} meId={user.id} />
    </div>
  )
}

/* ---------------- Globe Tab ---------------- */
function GlobeTab({ publicBirthdays, tM, tD, onSelect }) {
  const points = useMemo(() => buildGlobePoints(publicBirthdays, tM, tD), [publicBirthdays, tM, tD])
  const todays = publicBirthdays.filter((b) => b.birth_month === tM && b.birth_day === tD)

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-black/30 border-purple-800/50">
        <CardHeader className="pb-0"><CardTitle className="text-base flex items-center gap-2"><Globe2 className="w-4 h-4 text-fuchsia-400" /> Live birthday globe</CardTitle>
          <CardDescription>Pink pins are celebrating today. Click a pin to view &amp; wish them.</CardDescription></CardHeader>
        <CardContent className="p-0"><GlobeView points={points} onPointClick={(p) => onSelect(p.data)} /></CardContent>
      </Card>
      <Card className="bg-black/30 border-purple-800/50">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><PartyPopper className="w-4 h-4 text-fuchsia-400" /> Today ({MONTH_ABBR[tM - 1]} {tD})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[440px] overflow-auto">
          {todays.length === 0 && <p className="text-sm text-purple-400 py-8 text-center">No public birthdays today.</p>}
          {todays.map((b) => <PersonRow key={b.id} b={b} onClick={() => onSelect(b)} />)}
        </CardContent>
      </Card>
    </div>
  )
}

function PersonRow({ b, onClick }) {
  const c = COUNTRY_MAP[b.country_code]
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 rounded-lg p-2.5 bg-white/5 hover:bg-white/10 transition">
      <div className="w-9 h-9 rounded-full bg-fuchsia-600/30 flex items-center justify-center font-semibold">{(b.display_name || '?')[0]?.toUpperCase()}</div>
      <div className="min-w-0">
        <p className="font-medium truncate">{b.display_name}</p>
        <p className="text-xs text-purple-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c ? `${flagEmoji(b.country_code)} ${c.name}` : 'Earth'}</p>
      </div>
    </button>
  )
}

/* ---------------- Calendar Tab ---------------- */
function CalendarTab({ mode, publicBirthdays, followedIds, personal, profile, onSelect, tM, tD }) {
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1)

  const entries = useMemo(() => {
    if (mode === 'global') {
      return publicBirthdays.map((b) => ({ ...b, name: b.display_name, source: 'public' }))
    }
    // personal mode: my birthday + personal list + subscribed public users
    const list = []
    if (profile?.birth_month) list.push({ id: 'me', name: profile.display_name + ' (you)', birth_month: profile.birth_month, birth_day: profile.birth_day, source: 'self' })
    personal.forEach((p) => list.push({ id: p.id, name: p.person_name, birth_month: p.birth_month, birth_day: p.birth_day, source: 'personal', relationship: p.relationship }))
    publicBirthdays.filter((b) => followedIds.includes(b.id)).forEach((b) => list.push({ ...b, name: b.display_name, source: 'subscribed' }))
    return list
  }, [mode, publicBirthdays, followedIds, personal, profile])

  const byDay = useMemo(() => {
    const map = {}
    entries.filter((e) => e.birth_month === viewMonth).forEach((e) => {
      (map[e.birth_day] = map[e.birth_day] || []).push(e)
    })
    return map
  }, [entries, viewMonth])

  const firstDow = new Date(2025, viewMonth - 1, 1).getDay()
  const totalDays = daysInMonth(viewMonth, 2025)
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  return (
    <Card className="bg-black/30 border-purple-800/50">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{MONTHS[viewMonth - 1]}</CardTitle>
          <CardDescription>{mode === 'global' ? 'Public birthdays worldwide 🌍' : 'You, your people & your subscriptions 🔒'}</CardDescription>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="border-purple-700 bg-white/5" onClick={() => setViewMonth((m) => (m === 1 ? 12 : m - 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" className="border-purple-700 bg-white/5" onClick={() => setViewMonth((m) => (m === 12 ? 1 : m + 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-purple-400">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const list = byDay[d] || []
            const isToday = viewMonth === tM && d === tD
            return (
              <div key={i} className={`min-h-[76px] rounded-lg border p-1.5 ${isToday ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-purple-800/40 bg-white/5'}`}>
                <div className="text-xs text-purple-400">{d}</div>
                <div className="space-y-0.5 mt-0.5">
                  {list.slice(0, 2).map((e, idx) => (
                    <button key={idx} onClick={() => e.source === 'public' || e.source === 'subscribed' ? onSelect(e) : null}
                      className={`w-full truncate text-left text-[10px] px-1 py-0.5 rounded ${e.source === 'self' ? 'bg-pink-500/30' : e.source === 'personal' ? 'bg-amber-500/30' : 'bg-fuchsia-600/40 hover:bg-fuchsia-600/60'}`}>
                      🎂 {e.name}
                    </button>
                  ))}
                  {list.length > 2 && <div className="text-[10px] text-purple-400 px-1">+{list.length - 2} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------- Discover Tab ---------------- */
function DiscoverTab({ user, followedIds, follow, unfollow }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)

  const search = useCallback(async (term) => {
    setBusy(true)
    let query = supabase.from('profiles').select('id,display_name,country,country_code,x_handle,instagram_handle,birth_month,birth_day,birth_year,birth_year_public,is_public').eq('is_public', true).not('birth_month', 'is', null).limit(40)
    if (term) query = query.ilike('display_name', `%${term}%`)
    const { data } = await query
    setResults((data || []).filter((r) => r.id !== user.id))
    setBusy(false)
  }, [user.id])

  useEffect(() => { search('') }, [search])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 max-w-md">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(q)} placeholder="Search people by name…" className="bg-white/5 border-purple-700/50" />
        <Button onClick={() => search(q)} className="bg-fuchsia-600 hover:bg-fuchsia-500"><Search className="w-4 h-4" /></Button>
      </div>
      {busy && <p className="text-sm text-purple-400">Searching…</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {results.map((b) => {
          const c = COUNTRY_MAP[b.country_code]
          const following = followedIds.includes(b.id)
          return (
            <Card key={b.id} className="bg-black/30 border-purple-800/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-fuchsia-600/30 flex items-center justify-center font-semibold text-lg">{(b.display_name || '?')[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{b.display_name}</p>
                  <p className="text-xs text-purple-400">🎂 {MONTH_ABBR[b.birth_month - 1]} {b.birth_day} · {c ? `${flagEmoji(b.country_code)} ${c.name}` : 'Earth'}</p>
                </div>
                {following ? (
                  <Button size="sm" variant="outline" className="border-purple-700 bg-white/5" onClick={() => unfollow(b.id)}><UserMinus className="w-4 h-4" /></Button>
                ) : (
                  <Button size="sm" className="bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => follow(b.id)}><UserPlus className="w-4 h-4" /></Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      {!busy && results.length === 0 && <p className="text-sm text-purple-400">No public profiles found.</p>}
    </div>
  )
}

/* ---------------- Personal Tab ---------------- */
function PersonalTab({ user, personal, reload, followedIds, publicBirthdays, unfollow, onSelect }) {
  const [name, setName] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [rel, setRel] = useState('')
  const [busy, setBusy] = useState(false)
  const subscribed = publicBirthdays.filter((b) => followedIds.includes(b.id))
  const dayCount = month ? daysInMonth(Number(month)) : 31

  async function add() {
    if (!name || !month || !day) { toast.error('Name, month and day are required'); return }
    setBusy(true)
    const { error } = await supabase.from('personal_birthdays').insert({
      owner_id: user.id, person_name: name, birth_month: Number(month), birth_day: Number(day), birth_year: year ? Number(year) : null, relationship: rel || null,
    })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    setName(''); setMonth(''); setDay(''); setYear(''); setRel('')
    toast.success('Added to your private calendar 🔒')
    reload()
  }
  async function remove(id) {
    await supabase.from('personal_birthdays').delete().eq('id', id)
    toast.success('Removed')
    reload()
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="bg-black/30 border-purple-800/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4 text-fuchsia-400" /> Add a private birthday</CardTitle>
          <CardDescription>Only you can see these. Perfect for friends &amp; family not on Birthday Globe.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Person&apos;s name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-purple-700/50" /></div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={day} onValueChange={setDay}><SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year?" className="bg-white/5 border-purple-700/50" />
          </div>
          <Select value={rel} onValueChange={setRel}><SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Relationship (optional)" /></SelectTrigger><SelectContent>{['Family', 'Friend', 'Partner', 'Colleague', 'Other'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          <Button onClick={add} disabled={busy} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add birthday'}</Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="bg-black/30 border-purple-800/50">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" /> Private birthdays ({personal.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-auto">
            {personal.length === 0 && <p className="text-sm text-purple-400 py-4 text-center">Nothing yet — add someone!</p>}
            {personal.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg p-2.5 bg-white/5">
                <div className="w-9 h-9 rounded-full bg-amber-500/30 flex items-center justify-center font-semibold">{p.person_name[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{p.person_name}</p><p className="text-xs text-purple-400">🎂 {MONTH_ABBR[p.birth_month - 1]} {p.birth_day}{p.relationship ? ` · ${p.relationship}` : ''}</p></div>
                <Button size="icon" variant="ghost" className="text-purple-300 hover:text-red-400" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-black/30 border-purple-800/50">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Heart className="w-4 h-4 text-fuchsia-400" /> Subscriptions ({subscribed.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-auto">
            {subscribed.length === 0 && <p className="text-sm text-purple-400 py-4 text-center">Follow people from the Discover tab.</p>}
            {subscribed.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg p-2.5 bg-white/5">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => onSelect(b)}>
                  <div className="w-9 h-9 rounded-full bg-fuchsia-600/30 flex items-center justify-center font-semibold">{(b.display_name || '?')[0]?.toUpperCase()}</div>
                  <div className="min-w-0"><p className="font-medium truncate">{b.display_name}</p><p className="text-xs text-purple-400">🎂 {MONTH_ABBR[b.birth_month - 1]} {b.birth_day}</p></div>
                </button>
                <Button size="icon" variant="ghost" className="text-purple-300 hover:text-red-400" onClick={() => unfollow(b.id)}><UserMinus className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ---------------- Profile Tab ---------------- */
function ProfileTab({ user, profile, setProfile, reload }) {
  const [name, setName] = useState(profile?.display_name || '')
  const [month, setMonth] = useState(profile?.birth_month ? String(profile.birth_month) : '')
  const [day, setDay] = useState(profile?.birth_day ? String(profile.birth_day) : '')
  const [year, setYear] = useState(profile?.birth_year ? String(profile.birth_year) : '')
  const [yearPublic, setYearPublic] = useState(profile?.birth_year_public ?? false)
  const [country, setCountry] = useState(profile?.country_code || '')
  const [x, setX] = useState(profile?.x_handle || '')
  const [ig, setIg] = useState(profile?.instagram_handle || '')
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true)
  const [reminders, setReminders] = useState(profile?.reminders_enabled ?? true)
  const [busy, setBusy] = useState(false)
  const dayCount = month ? daysInMonth(Number(month)) : 31

  async function save() {
    setBusy(true)
    const c = COUNTRY_MAP[country]
    const payload = {
      id: user.id, email: user.email, display_name: name,
      birth_month: month ? Number(month) : null, birth_day: day ? Number(day) : null, birth_year: year ? Number(year) : null,
      birth_year_public: yearPublic, country: c?.name || null, country_code: country || null,
      x_handle: x || null, instagram_handle: ig || null, is_public: isPublic, reminders_enabled: reminders, onboarded: true,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().maybeSingle()
    setBusy(false)
    if (error) { toast.error(error.message); return }
    setProfile(data)
    toast.success('Profile saved ✨')
    reload()
  }

  return (
    <Card className="bg-black/30 border-purple-800/50 max-w-2xl">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cake className="w-4 h-4 text-fuchsia-400" /> Your profile</CardTitle>
        <CardDescription>{user.email}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-purple-700/50" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Month</Label><Select value={month} onValueChange={(v) => { setMonth(v); setDay('') }}><SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Day</Label><Select value={day} onValueChange={setDay}><SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Day" /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Optional" className="bg-white/5 border-purple-700/50" /></div>
        </div>
        <div className="space-y-1.5"><Label>Country</Label><Select value={country} onValueChange={setCountry}><SelectTrigger className="bg-white/5 border-purple-700/50"><SelectValue placeholder="Country" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="flex items-center gap-1"><Twitter className="w-3.5 h-3.5" /> X / Twitter</Label><Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@handle" className="bg-white/5 border-purple-700/50" /></div>
          <div className="space-y-1.5"><Label className="flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</Label><Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" className="bg-white/5 border-purple-700/50" /></div>
        </div>
        <Separator className="bg-purple-800/40" />
        <ToggleRow title="Public birthday 🌍" desc="Show on the global calendar & globe" checked={isPublic} onChange={setIsPublic} />
        <ToggleRow title="Show birth year" desc="Reveal your age publicly" checked={yearPublic} onChange={setYearPublic} disabled={!year} />
        <ToggleRow title="Email reminders" desc="Get emailed 24h before birthdays you follow" checked={reminders} onChange={setReminders} />
        <Button onClick={save} disabled={busy} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save profile'}</Button>
      </CardContent>
    </Card>
  )
}

function ToggleRow({ title, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-purple-800/50 p-3">
      <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-purple-400">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

/* ---------------- Person Dialog ---------------- */
function PersonDialog({ person, onClose, followedIds, follow, unfollow, meId }) {
  if (!person) return null
  const c = COUNTRY_MAP[person.country_code]
  const following = followedIds.includes(person.id)
  const isMe = person.id === meId
  const age = person.birth_year && person.birth_year_public ? new Date().getFullYear() - person.birth_year : null
  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-purple-950 border-purple-800 text-purple-50">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-fuchsia-600/30 flex items-center justify-center font-bold text-2xl">{(person.display_name || '?')[0]?.toUpperCase()}</div>
            <div>
              <DialogTitle className="text-xl">{person.display_name}</DialogTitle>
              <DialogDescription className="text-purple-300">{c ? `${flagEmoji(person.country_code)} ${c.name}` : 'Earth'}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm"><Cake className="w-4 h-4 text-fuchsia-400" /> {MONTHS[person.birth_month - 1]} {ordinal(person.birth_day)}{age ? ` · turning ${age + 1}` : ''}</div>
          <div className="flex gap-2">
            {person.x_handle && <a href={`https://x.com/${person.x_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5"><Twitter className="w-4 h-4" /> {person.x_handle}</a>}
            {person.instagram_handle && <a href={`https://instagram.com/${person.instagram_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5"><Instagram className="w-4 h-4" /> {person.instagram_handle}</a>}
          </div>
          {!person.x_handle && !person.instagram_handle && <p className="text-xs text-purple-400">No socials shared.</p>}
          {!isMe && (following ? (
            <Button variant="outline" className="w-full border-purple-700 bg-white/5" onClick={() => { unfollow(person.id); onClose() }}><UserMinus className="w-4 h-4 mr-2" /> Unsubscribe</Button>
          ) : (
            <Button className="w-full bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => { follow(person.id); onClose() }}><Bell className="w-4 h-4 mr-2" /> Subscribe to birthday</Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- helpers ---------------- */
function buildGlobePoints(publicBirthdays, tM, tD) {
  const pts = []
  for (const b of publicBirthdays) {
    const c = COUNTRY_MAP[b.country_code]
    if (!c) continue
    const isToday = b.birth_month === tM && b.birth_day === tD
    const jLat = ((hashCode(b.id) % 100) / 100 - 0.5) * 4
    const jLng = ((hashCode(b.id + 'x') % 100) / 100 - 0.5) * 4
    pts.push({
      lat: c.lat + jLat,
      lng: c.lng + jLng,
      color: isToday ? '#f472b6' : '#8b5cf6',
      r: isToday ? 0.75 : 0.28,
      alt: isToday ? 0.09 : 0.01,
      label: `${flagEmoji(b.country_code)} ${b.display_name} · ${c.name}${isToday ? ' · 🎂 Today!' : ''}`,
      data: b,
    })
  }
  return pts
}

function hashCode(str) {
  let h = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}
