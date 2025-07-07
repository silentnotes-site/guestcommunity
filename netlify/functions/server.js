const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const http = require('http')
const express = require('express')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
const PORT = process.env.PORT || 3000

const GNEWS_API_KEY = 'd5952ce4e39cd92ee61ea088973969a4'
const EVENTBRITE_API_KEY = 'SEGG3AN4HDFPIIB6WRQG'
const WEB3FORMS_ACCESS_KEY = '9a9e0334e37-b34d72c463f'
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const GNEWS_API_URL = 'https://gnews.io/api/v4/search'
const EVENTBRITE_API_URL = 'https://www.eventbriteapi.com/v3/events/search'

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
const usersFile = path.join(dataDir, 'users.json')
const messagesFile = path.join(dataDir, 'messages.json')

function readJ(f) {
  if (!fs.existsSync(f)) return []
  return JSON.parse(fs.readFileSync(f, 'utf8'))
}
function writeJ(f, d) {
  fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8')
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))
app.all('/api/*', async (req, res) => {
  const p = req.path.replace('/api', '')
  const q = req.query

  if (p === '/meteo' && req.method === 'GET') {
    if (!q.lat || !q.lon) return res.status(400).json({ error: 'Manca lat o lon' })
    const r = await fetch(`${OPEN_METEO_URL}?latitude=${q.lat}&longitude=${q.lon}&current_weather=true&temperature_unit=celsius&timezone=auto`)
    return res.json(await r.json())
  }

  if (p === '/notizie' && req.method === 'GET') {
    const r = await fetch(`${GNEWS_API_URL}?q=${encodeURIComponent(q.q || 'tecnologia')}&lang=it&max=8&token=${GNEWS_API_KEY}`)
    const d = await r.json()
    return res.json(Array.isArray(d.articles) ? d : { articles: [] })
  }

  if (p === '/eventi' && req.method === 'GET') {
    const r = await fetch(`${EVENTBRITE_API_URL}/?location.address=${encodeURIComponent(q.location || 'Italia')}&token=${EVENTBRITE_API_KEY}`)
    return res.json(await r.json())
  }

  if (p === '/contact' && req.method === 'POST') {
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Nuovo messaggio da Guest Community',
        from_name: 'Guest Community Website'
      }, req.body))
    })
    return res.json(await r.json())
  }

  if (p === '/login' && req.method === 'POST') {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username e password richiesti' })
    const users = readJ(usersFile)
    const u = users.find(u => u.username === username && u.password === password)
    if (!u) return res.status(401).json({ error: 'Credenziali errate' })
    const t = uuidv4()
    u.token = t
    writeJ(usersFile, users)
    return res.json({ token: t, username })
  }

  if (p === '/register' && req.method === 'POST') {
    const { email, name, username, password } = req.body
    if (!email || !name || !username || !password) return res.status(400).json({ error: 'Tutti i campi obbligatori' })
    const users = readJ(usersFile)
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username esistente' })
    if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email esistente' })
    const t = uuidv4()
    const ca = new Date().toISOString()
    users.push({ email, name, username, password, token: t, createdAt: ca, description: '', profileImage: '' })
    writeJ(usersFile, users)
    return res.json({ token: t, username })
  }

  if (p.startsWith('/profile/') && req.method === 'GET') {
    const uname = p.split('/')[2]
    const u = readJ(usersFile).find(u => u.username === uname)
    if (!u) return res.status(404).json({ error: 'Utente non trovato' })
    const { password, token, ...p2 } = u
    return res.json(p2)
  }

  if (p === '/update-profile' && req.method === 'POST') {
    const { token, username, name, email, description, profileImage } = req.body
    const users = readJ(usersFile)
    const i = users.findIndex(u => u.token === token)
    if (i === -1) return res.status(401).json({ error: 'Token non valido' })
    if (users.some((u, j) => j !== i && u.username === username)) return res.status(409).json({ error: 'Username in uso' })
    if (users.some((u, j) => j !== i && u.email === email)) return res.status(409).json({ error: 'Email in uso' })
    Object.assign(users[i], { username, name, email, description: description || '', profileImage: profileImage || '' })
    writeJ(usersFile, users)
    return res.json({ success: true })
  }

  return res.status(404).json({ error: 'API non trovata' })
})

let connectedUsers = {}
io.on('connection', socket => {
  socket.on('join', ({ token, username }) => {
    const users = readJ(usersFile)
    const u = users.find(u => u.token === token && u.username === username)
    if (!u) return socket.disconnect()
    connectedUsers[socket.id] = username
    socket.emit('chatHistory', readJ(messagesFile))
  })

  socket.on('message', msg => {
    const m = { username: msg.username, text: msg.text, ip: msg.ip || '0.0.0.0', date: new Date().toISOString() }
    const ms = readJ(messagesFile)
    ms.push(m)
    writeJ(messagesFile, ms)
    const mentions = [...m.text.matchAll(/@(\w+)/g)].map(x => x[1])
    mentions.forEach(u => {
      const sid = Object.keys(connectedUsers).find(id => connectedUsers[id] === u)
      if (sid) io.to(sid).emit('mentionNotification', m)
    })
    io.emit('message', m)
    if (mentions.includes('GuestCommunityAI')) {
      const prompt = m.text.replace(/@GuestCommunityAI/g, '').trim()
      if (prompt) {
        fetch('https://api.monke.dev/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        })
          .then(r => r.json())
          .then(rsp => {
            const ai = { username: 'GuestCommunityAI', text: rsp.response, ip: '0.0.0.0', date: new Date().toISOString() }
            const ms2 = readJ(messagesFile)
            ms2.push(ai)
            writeJ(messagesFile, ms2)
            io.emit('message', ai)
          })
      }
    }
  })

  socket.on('disconnect', () => delete connectedUsers[socket.id])
})

server.listen(PORT)
