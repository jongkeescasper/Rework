const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const VPLAN_API_TOKEN = 'jouw-vplan-api-token';
const VPLAN_BASE_URL = 'https://api.vplan.com/v1';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running!', 
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: '/webhook/rework (POST only)'
    }
  });
});

// Test endpoint to verify webhook URL works
app.get('/webhook/rework', (req, res) => {
  res.json({ 
    message: 'Webhook endpoint is active! Use POST method for actual webhooks.',
    method: 'GET not supported for webhooks',
    expected: 'POST request with JSON payload'
  });
});

app.post('/webhook/rework', async (req, res) => {
  try {
    const payload = req.body;
    
    // Log de ontvangen payload voor debugging
    console.log('Webhook ontvangen:', JSON.stringify(payload, null, 2));
    
    // Check of dit een testbericht is
    if (payload.test === true) {
      console.log('Test webhook ontvangen - stuur OK response');
      return res.status(200).json({ 
        message: 'Test webhook succesvol ontvangen', 
        received: payload,
        timestamp: new Date().toISOString()
      });
    }
    
    const event = payload.event;  // bv. "request_created" of "request_updated"
    const reqData = payload;       // de "request" data

    // Valideer of de vereiste velden aanwezig zijn
    if (!reqData.user || !reqData.user.name) {
      console.log('Ontbrekende user data in payload');
      return res.status(400).json({ error: 'Ontbrekende user data' });
    }
    
    if (!reqData.first_date || !reqData.last_date) {
      console.log('Ontbrekende datum data in payload');
      return res.status(400).json({ error: 'Ontbrekende datum data' });
    }

    // Definieer mapping
    const title = `Vrij - ${reqData.user.name}`;
    const description = `Van ${reqData.first_date} t/m ${reqData.last_date} - ${reqData.request_type?.name || 'Verlofverzoek'}`;
    const start = reqData.first_date;
    const end = reqData.last_date;
    const assignedTo = [ reqData.user.reference ];  // of een interne mapping user → vPlan user-id

    console.log('Verwerk event:', event);
    console.log('vPlan data:', { title, description, start, end, assignedTo });

    if (event === 'request_created') {
      // nieuwe kaart in vPlan
      console.log('Maak nieuwe vPlan kaart aan...');
      const response = await axios.post(`${VPLAN_BASE_URL}/cards`, {
        title,
        description,
        start,
        end,
        assignedTo
      }, {
        headers: {
          'Authorization': `Bearer ${VPLAN_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('vPlan kaart aangemaakt:', response.data);
    } else if (event === 'request_approved') {
      // Verlofverzoek goedgekeurd - update kaart status
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        console.log('Update vPlan kaart status naar goedgekeurd:', cardId);
        await axios.patch(`${VPLAN_BASE_URL}/cards/${cardId}`, {
          title: `✅ ${title}`,
          description: `${description} - GOEDGEKEURD`,
          start,
          end,
          assignedTo
        }, {
          headers: { 'Authorization': `Bearer ${VPLAN_API_TOKEN}`, 'Content-Type': 'application/json' }
        });
        console.log('vPlan kaart status bijgewerkt naar goedgekeurd');
      } else {
        console.log('Geen card ID gevonden voor request:', reqData.id);
      }
    } else if (event === 'request_rejected') {
      // Verlofverzoek afgewezen - update kaart of verwijder
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        console.log('Update vPlan kaart status naar afgewezen:', cardId);
        await axios.patch(`${VPLAN_BASE_URL}/cards/${cardId}`, {
          title: `❌ ${title}`,
          description: `${description} - AFGEWEZEN`,
          start,
          end,
          assignedTo
        }, {
          headers: { 'Authorization': `Bearer ${VPLAN_API_TOKEN}`, 'Content-Type': 'application/json' }
        });
        console.log('vPlan kaart status bijgewerkt naar afgewezen');
      } else {
        console.log('Geen card ID gevonden voor request:', reqData.id);
      }
    } else if (event === 'request_updated') {
      // update kaart: je moet eerst weten welke kaart hoort bij deze request
      // bijv. je slaat vPlan card-id op in jullie DB gekoppeld aan request.id van Rework
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        console.log('Update vPlan kaart:', cardId);
        await axios.patch(`${VPLAN_BASE_URL}/cards/${cardId}`, {
          title,
          description,
          start,
          end,
          assignedTo
        }, {
          headers: { 'Authorization': `Bearer ${VPLAN_API_TOKEN}`, 'Content-Type': 'application/json' }
        });
        console.log('vPlan kaart bijgewerkt');
      } else {
        console.log('Geen card ID gevonden voor request:', reqData.id);
      }
    } else if (event === 'request_destroyed') {
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        console.log('Verwijder vPlan kaart:', cardId);
        // Bijvoorbeeld verwijderen of markeren als "geannuleerd"
        await axios.delete(`${VPLAN_BASE_URL}/cards/${cardId}`, {
          headers: { 'Authorization': `Bearer ${VPLAN_API_TOKEN}` }
        });
        console.log('vPlan kaart verwijderd');
      } else {
        console.log('Geen card ID gevonden voor request:', reqData.id);
      }
    } else {
      console.log('Onbekend event:', event);
    }

    // Reageer succesvol op de webhook
    res.status(200).json({ 
      message: 'Webhook succesvol verwerkt',
      event: event,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error handling Rework webhook:', err);
    console.error('Error details:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

function findCardIdForRequest(reworkRequestId) {
  // hier moet je eigen logica/dataopslag maken: 
  // bv. een DB waarin je opslaat: reworkRequestId ↔ vPlanCardId
  console.log('Zoek card ID voor request:', reworkRequestId);
  return Promise.resolve(null); // placeholder
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook receiver is listening on port ${port}`);
});