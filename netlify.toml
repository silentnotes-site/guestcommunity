const fetch = require('node-fetch')

const GNEWS_API_KEY = 'd5952ce4e39cd92ee61ea088973969a4'
const EVENTBRITE_API_KEY = 'SEGG3AN4HDFPIIB6WRQG'
const WEB3FORMS_ACCESS_KEY = '9a9e0334-0522-4e37-b34d-7f64d72c463f'
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const GNEWS_API_URL = 'https://gnews.io/api/v4/search'
const EVENTBRITE_API_URL = 'https://www.eventbriteapi.com/v3/events/search'

exports.handler = async (event) => {
  const { path, httpMethod, queryStringParameters, body } = event

  if (path.includes('/api/meteo') && httpMethod === 'GET') {
    const lat = queryStringParameters.lat
    const lon = queryStringParameters.lon
    if (!lat || !lon) return json(400, { error: 'Manca lat o lon' })
    const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`
    try {
      const res = await fetch(url)
      const data = await res.json()
      return json(200, data)
    } catch {
      return json(500, { error: 'Errore meteo' })
    }
  }

  if (path.includes('/api/notizie') && httpMethod === 'GET') {
    const q = queryStringParameters.q || 'tecnologia'
    const url = `${GNEWS_API_URL}?q=${encodeURIComponent(q)}&lang=it&max=8&token=${GNEWS_API_KEY}`
    try {
      const res = await fetch(url)
      const data = await res.json()
      return json(200, data)
    } catch {
      return json(500, { error: 'Errore notizie' })
    }
  }

  if (path.includes('/api/eventi') && httpMethod === 'GET') {
    const location = queryStringParameters.location || 'Italia'
    const url = `${EVENTBRITE_API_URL}?location.address=${encodeURIComponent(location)}&token=${EVENTBRITE_API_KEY}`
    try {
      const res = await fetch(url)
      const data = await res.json()
      return json(200, data)
    } catch {
      return json(500, { error: 'Errore eventi' })
    }
  }

  if (path.includes('/api/contact') && httpMethod === 'POST') {
    try {
      const parsed = JSON.parse(body)
      const formData = { access_key: WEB3FORMS_ACCESS_KEY, ...parsed }
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      return json(200, data)
    } catch {
      return json(500, { error: 'Errore invio messaggio' })
    }
  }

  return json(404, { error: 'Percorso non trovato' })
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  }
}
