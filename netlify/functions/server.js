const fetch = require('node-fetch')

const GNEWS_API_KEY = 'd5952ce4e39cd92ee61ea088973969a4'
const EVENTBRITE_API_KEY = 'SEGG3AN4HDFPIIB6WRQG'
const WEB3FORMS_ACCESS_KEY = '9a9e0334-0522-4e37-b34d-7f64d72c463f'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const GNEWS_API_URL = 'https://gnews.io/api/v4/search'
const EVENTBRITE_API_URL = 'https://www.eventbriteapi.com/v3/events/search'

exports.handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/server', '')
  const method = event.httpMethod
  const query = new URLSearchParams(event.queryStringParameters)

  try {
    if (path === '/api/meteo' && method === 'GET') {
      const lat = query.get('lat'), lon = query.get('lon')
      if (!lat || !lon) return response(400, { error: 'Manca lat o lon' })

      const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`
      const res = await fetch(url)
      const data = await res.json()
      return response(200, data)
    }

    if (path === '/api/notizie' && method === 'GET') {
      const q = query.get('q') || 'tecnologia'
      const url = `${GNEWS_API_URL}?q=${encodeURIComponent(q)}&lang=it&max=8&token=${GNEWS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()

      if (!data || !Array.isArray(data.articles)) {
        return response(200, { articles: [] })
      }

      return response(200, data)
    }

    if (path === '/api/eventi' && method === 'GET') {
      const location = query.get('location') || 'Italia'
      const url = `${EVENTBRITE_API_URL}/?location.address=${encodeURIComponent(location)}&token=${EVENTBRITE_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      return response(200, data)
    }

    if (path === '/api/contact' && method === 'POST') {
      try {
        const body = JSON.parse(event.body)
        if (!body.name || !body.email || !body.message) {
          return response(400, { success: false, message: 'Campi name, email e message sono obbligatori' })
        }
        const formData = {
          access_key: WEB3FORMS_ACCESS_KEY,
          ...body
        }
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        const data = await res.json()
        if (data.success) {
          return response(200, { success: true, message: 'Messaggio inviato con successo' })
        } else {
          return response(500, { success: false, message: data.message || 'Invio fallito' })
        }
      } catch (err) {
        return response(500, { success: false, message: 'Errore interno nel server', details: err.message })
      }
    }

    return response(404, { error: 'API non trovata' })
  } catch (e) {
    return response(500, { error: 'Errore interno', details: e.message })
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  }
}
