// ─── Call Center Hub — Backend Server ────────────────────────────────────────
// Email via Resend | Reminders via cron
// Run:  node server.cjs
// Open: http://localhost:3001/app.html

const express      = require('express')
const cron         = require('node-cron')
const cors         = require('cors')
const path         = require('path')
const nodemailer   = require('nodemailer')

const app    = express()
const PORT   = process.env.PORT || 3001
const GMAIL_USER = 'update.wiom@gmail.com'
const GMAIL_PASS = 'hzuzvjgykkcwisfg'
const FROM   = 'Call Center Hub <update.wiom@gmail.com>'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
})

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}
function isOverdue(t) { return t.due_date && t.status !== 'closed' && new Date(t.due_date) < new Date() }

// ─── Fetch users+teams from Supabase ──────────────────────────────────────────
const SUPABASE_URL      = 'https://lfcjxqhmqcqhocrhetiq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmY2p4cWhtcWNxaG9jcmhldGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzMxMDAsImV4cCI6MjA5MDEwOTEwMH0.9mWqY9ZZgcerxU6TFUs3ped4ZJs9eDxcRUUdOOFmS-s'

async function getConfigFromSupabase(key) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cch_config?key=eq.${key}&select=value`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
    })
    const data = await res.json()
    return data[0]?.value || []
  } catch(e) { return [] }
}

async function getTicketsFromSupabase() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cch_tickets?select=*`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
    })
    return await res.json()
  } catch(e) { return [] }
}

async function updateTicketInSupabase(id, updates) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/cch_tickets?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })
  } catch(e) {}
}

// ─── Build HTML email ──────────────────────────────────────────────────────────
function buildEmailHTML(task, type, teams) {
  const isReminder = type === 'reminder'
  const teamName   = teams.find(t => t.id === task.assigned_team_id)?.name || '—'
  const overdueTxt = isOverdue(task) ? ' ⚠️ OVERDUE' : ''
  const priority   = (task.priority || 'normal').toUpperCase()
  const status     = (task.status || 'open').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const intro = isReminder
    ? `This is a reminder that the following ticket is still open and requires attention.`
    : `A new ticket has been raised and assigned to the <strong>${teamName}</strong> team. Please review and take action.`

  const ticketUrl = `${process.env.APP_URL || 'http://localhost:3001'}/app.html#${task.id}`

  const descPart = task.description
    ? `<p style="margin:24px 0 6px 0;font-size:15px;font-weight:600;color:#222">Message / Description</p>
       <hr style="border:none;border-top:1px solid #e0e0e0;margin:0 0 16px 0">
       <div style="font-size:14px;color:#333;line-height:1.7">${task.description}</div>`
    : ''

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;font-size:14px;color:#333">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:28px 12px">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ddd;border-radius:4px">
<tr><td style="padding:28px 32px 24px">

  <p style="margin:0 0 4px 0;font-size:13px;color:#888">${isReminder ? '⏰ Ticket Reminder' : '🎫 New Ticket Notification'} — Call Center Hub</p>
  <p style="margin:0 0 20px 0;font-size:20px;font-weight:700;color:#111">${task.title}</p>

  <p style="margin:0 0 16px 0;font-size:14px;color:#444;line-height:1.6">${intro}</p>

  <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#333;margin-bottom:20px">
    <tr><td style="padding:4px 16px 4px 0;color:#888;white-space:nowrap">Ticket ID</td><td style="padding:4px 0"><strong>${task.id}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#888">Status</td><td style="padding:4px 0">${status}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#888">Priority</td><td style="padding:4px 0"><strong>${priority}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#888">Category</td><td style="padding:4px 0">${task.category || '—'}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#888">Assigned To</td><td style="padding:4px 0">${teamName}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#888">Due Date</td><td style="padding:4px 0;${isOverdue(task) ? 'color:#c0392b;font-weight:700' : ''}">${fmtDate(task.due_date)}${overdueTxt}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#888">Raised By</td><td style="padding:4px 0">${task.created_by_name || '—'}</td></tr>
  </table>

  <p style="margin:0 0 20px 0">
    <a href="${ticketUrl}" style="display:inline-block;padding:10px 22px;background:#0052CC;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:600">View Ticket →</a>
    &nbsp;<span style="font-size:12px;color:#aaa">${ticketUrl}</span>
  </p>

  ${descPart}

  <p style="margin:28px 0 0 0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px">This is an automated notification from Call Center Hub.</p>

</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

// ─── Send email via Gmail ──────────────────────────────────────────────────────
async function sendToTeam(task, type) {
  const [users, teams] = await Promise.all([
    getConfigFromSupabase('users'),
    getConfigFromSupabase('teams')
  ])

  const fakeEndings = ['@cc1.com','@cc2.com','@internal.com','@hub.com']
  // Notify members of BOTH the assigned team AND the team that raised the ticket
  const relevantTeamIds = [...new Set([task.assigned_team_id, task.created_by_team_id].filter(Boolean))]
  const members = users.filter(u => relevantTeamIds.includes(u.teamId))
  const toList  = [...new Set(members
    .map(u => u.email)
    .filter(e => e && e.includes('@') && !fakeEndings.some(f => e.endsWith(f))))]

  if (!toList.length) {
    console.log('[Email] No real emails for team:', task.assigned_team_id, '— add real emails in Admin > Users')
    return { sent: 0 }
  }

  const subject = type === 'reminder'
    ? `⏰ Reminder: "${task.title}" — Due ${fmtDate(task.due_date)}`
    : `🎫 New Ticket: "${task.title}" [${(task.priority||'').toUpperCase()}] — ${teams.find(t=>t.id===task.assigned_team_id)?.name||''}`

  try {
    await transporter.sendMail({
      from: FROM,
      to: toList.join(', '),
      subject,
      html: buildEmailHTML(task, type, teams)
    })
    console.log(`[Email] Sent to ${toList.join(', ')}`)
    return { sent: toList.length }
  } catch(e) {
    console.error('[Email] Failed:', e.message)
    return { sent: 0, error: e.message }
  }
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get('/api/ping', (req, res) => res.json({ ok: true }))

app.post('/api/notify/new-ticket', async (req, res) => {
  const result = await sendToTeam(req.body.task, req.body.type || 'new')
  res.json(result)
})

app.post('/api/email-test', async (req, res) => {
  const { to } = req.body
  try {
    await transporter.sendMail({
      from: FROM,
      to: to || GMAIL_USER,
      subject: '✅ Test Email — Call Center Hub',
      html: '<div style="font-family:sans-serif;padding:24px"><h2 style="color:#0052CC">✅ Email is working!</h2><p>Your Call Center Hub email notifications are configured correctly via Gmail.</p></div>'
    })
    res.json({ ok: true })
  } catch(e) {
    res.json({ ok: false, error: e.message })
  }
})

// ─── Reminder Scheduler (every minute) ───────────────────────────────────────
cron.schedule('* * * * *', async () => {
  const tickets = await getTicketsFromSupabase()
  const now = new Date()
  for (const t of tickets) {
    if (!t.reminder_at || t.reminder_sent || t.status === 'closed') continue
    if (now >= new Date(t.reminder_at)) {
      console.log(`[Reminder] Firing: "${t.title}"`)
      await sendToTeam(t, 'reminder')
      await updateTicketInSupabase(t.id, { reminder_sent: true })
    }
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Call Center Hub server running!`)
  console.log(`   Open:    http://localhost:${PORT}/app.html`)
  console.log(`   Email:   Gmail (${GMAIL_USER})`)
  console.log(`   Reminders: auto every minute\n`)
})
