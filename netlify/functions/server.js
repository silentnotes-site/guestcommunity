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
const WEB3FORMS_ACCESS_KEY = '9a9e0334-0522-4e37-b34d-7f64d72c463f'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const GNEWS_API_URL = 'https://gnews.io/api/v4/search'
const EVENTBRITE_API_URL = 'https://www.eventbriteapi.com/v3/events/search'

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
const usersFile = path.join(dataDir, 'users.json')
const messagesFile = path.join(dataDir, 'messages.json')

function readJsonFileSync(file) {
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function writeJsonFileSync(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))

app.all('/api/*', async (req, res) => {
  try {
    const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
    const pathname = url.pathname.replace('/api', '')
    const method = req.method

    if (pathname === '/meteo' && method === 'GET') {
      const lat = url.searchParams.get('lat')
      const lon = url.searchParams.get('lon')
      if (!lat || !lon) return res.status(400).json({ error: 'Manca lat o lon' })
      const r = await fetch(`${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`)
      return res.json(await r.json())
    }

    if (pathname === '/notizie' && method === 'GET') {
      const q = url.searchParams.get('q') || 'tecnologia'
      const r = await fetch(`${GNEWS_API_URL}?q=${encodeURIComponent(q)}&lang=it&max=8&token=${GNEWS_API_KEY}`)
      const d = await r.json()
      return res.json(Array.isArray(d.articles) ? d : { articles: [] })
    }

    if (pathname === '/eventi' && method === 'GET') {
      const loc = url.searchParams.get('location') || 'Italia'
      const r = await fetch(`${EVENTBRITE_API_URL}/?location.address=${encodeURIComponent(loc)}&token=${EVENTBRITE_API_KEY}`)
      return res.json(await r.json())
    }

    if (pathname === '/contact' && method === 'POST') {
      const b = req.body
      const formData = { access_key: WEB3FORMS_ACCESS_KEY, subject: 'Nuovo messaggio da Guest Community', from_name: 'Guest Community Website', ...b }
      const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      return res.json(await r.json())
    }

    if (pathname === '/login' && method === 'POST') {
      const { username, password } = req.body
      if (!username || !password) return res.status(400).json({ error: 'Username e password richiesti' })
      const users = readJsonFileSync(usersFile)
      const u = users.find(u => u.username === username && u.password === password)
      if (!u) return res.status(401).json({ error: 'Credenziali errate' })
      const token = uuidv4()
      u.token = token
      writeJsonFileSync(usersFile, users)
      return res.json({ token, username })
    }

    if (pathname === '/register' && method === 'POST') {
      const { email, name, username, password } = req.body
      if (!email || !name || !username || !password) return res.status(400).json({ error: 'Tutti i campi obbligatori' })
      const users = readJsonFileSync(usersFile)
      if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username esistente' })
      if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email esistente' })
      const token = uuidv4()
      const createdAt = new Date().toISOString()
      users.push({ email, name, username, password, token, createdAt, description: '', profileImage: '' })
      writeJsonFileSync(usersFile, users)
      return res.json({ token, username })
    }

    if (pathname.startsWith('/profile/') && method === 'GET') {
      const uname = pathname.split('/')[2]
      const users = readJsonFileSync(usersFile)
      const u = users.find(u => u.username === uname)
      if (!u) return res.status(404).json({ error: 'Utente non trovato' })
      const { password, token, ...p } = u
      return res.json(p)
    }

    if (pathname === '/update-profile' && method === 'POST') {
      const { token, username, name, email, description, profileImage } = req.body
      const users = readJsonFileSync(usersFile)
      const i = users.findIndex(u => u.token === token)
      if (i === -1) return res.status(401).json({ error: 'Token non valido' })
      if (users.some((u,j) => j!==i && u.username===username)) return res.status(409).json({ error: 'Username in uso' })
      if (users.some((u,j) => j!==i && u.email===email)) return res.status(409).json({ error: 'Email in uso' })
      users[i].username = username
      users[i].name = name
      users[i].email = email
      users[i].description = description || ''
      users[i].profileImage = profileImage || ''
      writeJsonFileSync(usersFile, users)
      return res.json({ success: true })
    }

    return res.status(404).json({ error: 'API non trovata' })
  } catch (e) {
    return res.status(500).json({ error: 'Errore interno', details: e.message })
  }
})

let connectedUsers = {}
io.on('connection', socket => {
  socket.on('join', ({ token, username }) => {
    const users = readJsonFileSync(usersFile)
    const u = users.find(u => u.token === token && u.username === username)
    if (!u) { socket.disconnect(); return }
    connectedUsers[socket.id] = username
    socket.emit('chatHistory', readJsonFileSync(messagesFile))
  })
  socket.on('message', msg => {
    const m = { username: msg.username, text: msg.text, ip: msg.ip||'0.0.0.0', date: new Date().toISOString() }
    const ms = readJsonFileSync(messagesFile)
    ms.push(m); writeJsonFileSync(messagesFile, ms)
    const mentions = [...m.text.matchAll(/@(\w+)/g)].map(x=>x[1])
    mentions.forEach(u => {
      const sid = Object.keys(connectedUsers).find(id=>connectedUsers[id]===u)
      if (sid) io.to(sid).emit('mentionNotification', m)
    })
    io.emit('message', m)
    if (mentions.includes('GuestCommunityAI')) {
      const prompt = m.text.replace(/@GuestCommunityAI/g, '').trim()
      if (prompt) {
        fetch('https://api.monke.dev/api/chat', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ prompt })
        })
        .then(r=>r.json())
        .then(rsp=>{
          const ai = { username:'GuestCommunityAI', text:rsp.response, ip:'0.0.0.0', date:new Date().toISOString() }
          const ms2 = readJsonFileSync(messagesFile); ms2.push(ai); writeJsonFileSync(messagesFile, ms2)
          io.emit('message', ai)
        })
      }
    }
  })
  socket.on('disconnect', ()=>delete connectedUsers[socket.id])
})

server.listen(PORT)
