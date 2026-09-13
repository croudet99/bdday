import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM
const CRON_SECRET = process.env.CRON_SECRET

let _admin = null
function admin() {
  if (!_admin) {
    _admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _admin
}

const resend = resendApiKey ? new Resend(resendApiKey) : null

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[c]))
}

function emailShell(inner) {
  return `<div style=\"font-family:Arial,Helvetica,sans-serif;background:#0f0f1a;padding:32px;color:#e5e7eb\">
    <div style=\"max-width:520px;margin:0 auto;background:linear-gradient(135deg,#1e1b4b,#3b0764);border-radius:16px;padding:32px;text-align:center\">
      <div style=\"font-size:44px\">\uD83C\uDF82</div>
      <h1 style=\"color:#f9a8d4;font-size:22px;margin:12px 0\">Birthday Globe</h1>
      ${inner}
      <p style=\"margin-top:28px;font-size:12px;color:#a1a1aa\">You are receiving this because you use Birthday Globe.</p>
    </div>
  </div>`
}

async function sendEmail({ to, subject, html, text, key }) {
  if (!resend) throw new Error('Resend not configured (missing RESEND_API_KEY)')
  const opts = key ? { idempotencyKey: key } : undefined
  const result = await resend.emails.send({ from: RESEND_FROM, to, subject, html, text }, opts)
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error))
  return result.data
}

function buildMessage(task) {
  if (task.type === 'self_birthday') {
    return {
      subject: '\uD83C\uDF89 Your birthday is tomorrow!',
      title: 'Your birthday is tomorrow!',
      body: 'The world is getting ready to celebrate you. Have an amazing day!',
      html: emailShell(`<p style=\"font-size:16px\">Hi ${esc(task.recipientName)},</p><p style=\"font-size:16px\">Your birthday is <strong>tomorrow</strong>! \uD83C\uDF88 The world is ready to celebrate you.</p>`),
      text: `Hi ${task.recipientName}, your birthday is tomorrow!`,
    }
  }
  return {
    subject: `\uD83C\uDF82 ${task.subjectName}'s birthday is tomorrow`,
    title: `${task.subjectName}'s birthday is tomorrow`,
    body: 'Do not forget to send your wishes!',
    html: emailShell(`<p style=\"font-size:16px\">Hi ${esc(task.recipientName)},</p><p style=\"font-size:16px\"><strong>${esc(task.subjectName)}</strong>'s birthday is <strong>tomorrow</strong>! \uD83C\uDF89 Do not forget to send your wishes.</p>`),
    text: `Hi ${task.recipientName}, ${task.subjectName}'s birthday is tomorrow!`,
  }
}

function serverDaysUntil(month, day) {
  const now = new Date()
  const y = now.getUTCFullYear()
  const today = Date.UTC(y, now.getUTCMonth(), now.getUTCDate())
  let next = Date.UTC(y, month - 1, day)
  if (next < today) next = Date.UTC(y + 1, month - 1, day)
  return Math.round((next - today) / 86400000)
}

async function runReminders(opts = {}) {
  const db = admin()
  const daysAhead = opts.daysAhead == null ? 1 : Number(opts.daysAhead)
  let base = new Date()
  if (opts.dateOverride) base = new Date(opts.dateOverride + 'T00:00:00Z')
  const target = new Date(base.getTime() + daysAhead * 24 * 3600 * 1000)
  const tMonth = target.getUTCMonth() + 1
  const tDay = target.getUTCDate()
  const dateKey = `${target.getUTCFullYear()}-${String(tMonth).padStart(2, '0')}-${String(tDay).padStart(2, '0')}`
  const dryRun = !!opts.dryRun

  const [{ data: profiles }, { data: follows }, { data: personal }] = await Promise.all([
    db.from('profiles').select('id,email,display_name,birth_month,birth_day,reminders_enabled'),
    db.from('follows').select('follower_id,followed_id'),
    db.from('personal_birthdays').select('owner_id,person_name,birth_month,birth_day'),
  ])
  const pmap = {}
  ;(profiles || []).forEach((p) => { pmap[p.id] = p })

  const tasks = []
  for (const p of profiles || []) {
    if (p.birth_month === tMonth && p.birth_day === tDay) {
      if (p.reminders_enabled !== false && p.email) {
        tasks.push({ type: 'self_birthday', recipientId: p.id, email: p.email, recipientName: p.display_name || 'there', subjectName: p.display_name, subjectPart: 'self' })
      }
      for (const f of follows || []) {
        if (f.followed_id === p.id) {
          const rec = pmap[f.follower_id]
          if (rec && rec.email && rec.reminders_enabled !== false) {
            tasks.push({ type: 'followed_birthday', recipientId: rec.id, email: rec.email, recipientName: rec.display_name || 'there', subjectName: p.display_name, subjectPart: p.id })
          }
        }
      }
    }
  }
  for (const pb of personal || []) {
    if (pb.birth_month === tMonth && pb.birth_day === tDay) {
      const rec = pmap[pb.owner_id]
      if (rec && rec.email && rec.reminders_enabled !== false) {
        tasks.push({ type: 'personal_birthday', recipientId: rec.id, email: rec.email, recipientName: rec.display_name || 'there', subjectName: pb.person_name, subjectPart: 'pb:' + pb.person_name })
      }
    }
  }

  let sent = 0, skipped = 0, failed = 0
  const details = []
  for (const t of tasks) {
    const key = `${t.type}:${t.recipientId}:${t.subjectPart}:${dateKey}`
    if (!dryRun) {
      const ins = await db.from('email_log').insert({ key })
      if (ins.error) { skipped++; continue }
    }
    const msg = buildMessage(t)
    try {
      if (!dryRun) {
        await sendEmail({ to: t.email, subject: msg.subject, html: msg.html, text: msg.text, key })
        await db.from('notifications').insert({ recipient_id: t.recipientId, type: t.type, title: msg.title, body: msg.body, payload: { subject: t.subjectName } })
      }
      sent++
      details.push({ to: t.email, subject: msg.subject })
    } catch (e) {
      failed++
      if (!dryRun) { await db.from('email_log').delete().eq('key', key) }
      details.push({ to: t.email, error: e.message })
    }
  }
  return { ok: true, date: dateKey, tasksFound: tasks.length, sent, skipped, failed, dryRun, details }
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    if ((route === '/' || route === '/health') && method === 'GET') {
      return cors(NextResponse.json({ status: 'ok', service: 'Birthday Globe API', supabase: !!serviceKey, resend: !!resendApiKey, from: RESEND_FROM || null }))
    }

    if (route === '/test-email' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      if (!body.to) return cors(NextResponse.json({ error: 'to is required' }, { status: 400 }))
      const data = await sendEmail({
        to: body.to,
        subject: '\uD83C\uDF82 Birthday Globe test email',
        html: emailShell('<p style=\"font-size:16px\">Your Resend integration is working perfectly! \uD83C\uDF89</p>'),
        text: 'Your Resend integration is working!',
      })
      return cors(NextResponse.json({ ok: true, id: data && data.id }))
    }

    if (route === '/reminders/run' && method === 'POST') {
      const auth = request.headers.get('authorization') || ''
      if (auth !== `Bearer ${CRON_SECRET}`) {
        return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      }
      const body = await request.json().catch(() => ({}))
      const result = await runReminders(body)
      return cors(NextResponse.json(result))
    }

    if (route === '/reminders/self-test' && method === 'POST') {
      const authz = request.headers.get('authorization') || ''
      const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
      if (!token) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const db = admin()
      const { data: userData, error: uErr } = await db.auth.getUser(token)
      const user = userData && userData.user
      if (uErr || !user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const { data: me } = await db.from('profiles').select('email,display_name').eq('id', user.id).maybeSingle()
      const toEmail = (me && me.email) || user.email
      const recipientName = (me && me.display_name) || 'there'
      if (!toEmail) return cors(NextResponse.json({ error: 'No email on file' }, { status: 400 }))

      const { data: fol } = await db.from('follows').select('followed_id').eq('follower_id', user.id)
      const followedIds = (fol || []).map((f) => f.followed_id)
      let candidates = []
      if (followedIds.length) {
        const { data: followed } = await db.from('profiles').select('display_name,birth_month,birth_day').in('id', followedIds)
        ;(followed || []).forEach((p) => { if (p.birth_month) candidates.push({ name: p.display_name, m: p.birth_month, d: p.birth_day }) })
      }
      const { data: personal } = await db.from('personal_birthdays').select('person_name,birth_month,birth_day').eq('owner_id', user.id)
      ;(personal || []).forEach((p) => candidates.push({ name: p.person_name, m: p.birth_month, d: p.birth_day }))
      candidates = candidates.map((c) => ({ ...c, days: serverDaysUntil(c.m, c.d) })).sort((a, b) => a.days - b.days)
      const pick = candidates[0]
      const subjectName = pick ? pick.name : recipientName

      const msg = buildMessage({ type: 'followed_birthday', recipientName, subjectName })
      const data = await sendEmail({ to: toEmail, subject: '[TEST] ' + msg.subject, html: msg.html, text: msg.text })
      await db.from('notifications').insert({ recipient_id: user.id, type: 'test_reminder', title: 'Test reminder sent', body: 'Preview of the email you get 24h before ' + subjectName + "'s birthday.", payload: {} })
      return cors(NextResponse.json({ ok: true, to: toEmail, subjectName, daysUntil: pick ? pick.days : null, hadUpcoming: !!pick, id: data && data.id }))
    }

    return cors(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return cors(NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
