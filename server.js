const express = require('express')
const fetch = require('node-fetch')
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

const GNEWS_API_KEY = 'LA_TUA_GNEWS_API_KEY'
const EVENTBRITE_API_KEY = 'LA_TUA_EVENTBRITE_API_KEY'
const WEB3FORMS_ACCESS_KEY = 'LA_TUA_WEB3FORMS_ACCESS_KEY'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const GNEWS_API_URL = 'https://gnews.io/api/v4/search'
const EVENTBRITE_API_URL = 'https://www.eventbriteapi.com/v3/events/search'

app.get('/api/meteo', async (req, res) => {
  const { lat, lon } = req.query
  if (!lat || !lon) return res.status(400).json({ error: 'Manca lat o lon' })

  const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`
  try {
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Errore meteo' })
  }
})

app.get('/api/notizie', async (req, res) => {
  const q = req.query.q || 'tecnologia'
  const url = `${GNEWS_API_URL}?q=${encodeURIComponent(q)}&lang=it&max=8&token=${GNEWS_API_KEY}`
  try {
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Errore notizie' })
  }
})

app.get('/api/eventi', async (req, res) => {
  const location = req.query.location || 'Italia'
  const url = `${EVENTBRITE_API_URL}/?location.address=${encodeURIComponent(location)}&token=${EVENTBRITE_API_KEY}`
  try {
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Errore eventi' })
  }
})

app.post('/api/contact', async (req, res) => {
  try {
    const formData = {
      access_key: WEB3FORMS_ACCESS_KEY,
      ...req.body
    }
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    const data = await response.json()
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Errore invio messaggio' })
  }
})

app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`)
})
