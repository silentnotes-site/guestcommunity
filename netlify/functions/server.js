const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const http = require('http')
const express = require('express')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' }
})

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
  try {
    if (!fs.existsSync(file)) return []
    const data = fs.readFileSync(file, 'utf8')
    return JSON.parse(data)
  } catch {
    return []
  }
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
      const meteoUrl = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`
      const r = await fetch(meteoUrl)
      const d = await r.json()
      return res.json(d)
    }

    if (pathname === '/notizie' && method === 'GET') {
      const q = url.searchParams.get('q') || 'tecnologia'
      const newsUrl = `${GNEWS_API_URL}?q=${encodeURIComponent(q)}&lang=it&max=8&token=${GNEWS_API_KEY}`
      const r = await fetch(newsUrl)
      const d = await r.json()
      if (!d || !Array.isArray(d.articles)) return res.json({ articles: [] })
      return res.json(d)
    }

    if (pathname === '/eventi' && method === 'GET') {
      const location = url.searchParams.get('location') || 'Italia'
      const eventsUrl = `${EVENTBRITE_API_URL}/?location.address=${encodeURIComponent(location)}&token=${EVENTBRITE_API_KEY}`
      const r = await fetch(eventsUrl)
      const d = await r.json()
      return res.json(d)
    }

    if (pathname === '/contact' && method === 'POST') {
      const body = req.body
      const formData = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Nuovo messaggio da Guest Community',
        from_name: 'Guest Community Website',
        ...body
      }
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const d = await r.json()
      return res.json(d)
    }

    if (pathname === '/login' && method === 'POST') {
      const { username, password } = req.body
      if (!username || !password) return res.status(400).json({ error: 'Username e password richiesti' })
      const users = readJsonFileSync(usersFile)
      const user = users.find(u => u.username === username && u.password === password)
      if (!user) return res.status(401).json({ error: 'Credenziali errate' })
      const token = uuidv4()
      user.token = token
      writeJsonFileSync(usersFile, users)
      return res.json({ success: true, token, username: user.username })
    }

    if (pathname === '/register' && method === 'POST') {
      const { email, name, username, password } = req.body
      if (!email || !name || !username || !password) return res.status(400).json({ error: 'Tutti i campi sono obbligatori' })
      const users = readJsonFileSync(usersFile)
      if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username già usato' })
      if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email già usata' })
      const token = uuidv4()
      const createdAt = new Date().toISOString()
      const newUser = { email, name, username, password, token, createdAt, description: '', profileImage: '' }
      users.push(newUser)
      writeJsonFileSync(usersFile, users)
      return res.json({ success: true, token, username })
    }

    if (pathname.startsWith('/profile/') && method === 'GET') {
      const requestedUsername = pathname.split('/')[2]
      const users = readJsonFileSync(usersFile)
      const user = users.find(u => u.username === requestedUsername)
      if (!user) return res.status(404).json({ error: 'Utente non trovato' })
      const { password, token, ...profile } = user
      return res.json(profile)
    }

    if (pathname === '/update-profile' && method === 'POST') {
      const { token, username, name, email, description, profileImage } = req.body
      if (!token) return res.status(401).json({ error: 'Token mancante' })
      const users = readJsonFileSync(usersFile)
      const userIndex = users.findIndex(u => u.token === token)
      if (userIndex === -1) return res.status(401).json({ error: 'Token non valido' })
      if (users.some((u, i) => i !== userIndex && u.username === username)) return res.status(409).json({ error: 'Username già in uso' })
      if (users.some((u, i) => i !== userIndex && u.email === email)) return res.status(409).json({ error: 'Email già in uso' })
      users[userIndex].username = username
      users[userIndex].name = name
      users[userIndex].email = email
      users[userIndex].description = description || ''
      users[userIndex].profileImage = profileImage || ''
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
    const user = users.find(u => u.token === token && u.username === username)
    if (!user) {
      socket.emit('error', 'Utente non autenticato')
      socket.disconnect()
      return
    }
    connectedUsers[socket.id] = user.username
    socket.emit('connected', { username: user.username })

    const messages = readJsonFileSync(messagesFile)
    socket.emit('chatHistory', messages)

    socket.broadcast.emit('userJoined', user.username)
  })

  socket.on('message', msg => {
    const { username, text, ip } = msg
    if (!username || !text) return
    const messages = readJsonFileSync(messagesFile)
    const newMsg = { username, text, ip: ip || '0.0.0.0', date: new Date().toISOString() }
    messages.push(newMsg)
    writeJsonFileSync(messagesFile, messages)

    const mentions = [...newMsg.text.matchAll(/@(\w+)/g)].map(m => m[1])
    mentions.forEach(u => {
      const socketId = Object.keys(connectedUsers).find(id => connectedUsers[id] === u)
      if (socketId) io.to(socketId).emit('mentionNotification', { from: username, message: newMsg.text })
    })

    io.emit('message', newMsg)

    if (mentions.includes('GuestCommunityAI')) {
      const prompt = newMsg.text.replace(/@GuestCommunityAI/g, '').trim()
      if (prompt.length > 0) {
        fetch('https://api.monke.dev/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        }).then(r => r.json())
          .then(aiResp => {
            if (aiResp && aiResp.response) {
              const aiMsg = {
                username: 'GuestCommunityAI',
                text: aiResp.response,
                ip: '0.0.0.0',
                date: new Date().toISOString()
              }
              const msgs = readJsonFileSync(messagesFile)
              msgs.push(aiMsg)
              writeJsonFileSync(messagesFile, msgs)
              io.emit('message', aiMsg)
            }
          })
          .catch(() => { })
      }
    }
  })

  socket.on('disconnect', () => {
    delete connectedUsers[socket.id]
  })
})

server.listen(PORT, () => {
  console.log(`Server in ascolto su porta ${PORT}`)
})
