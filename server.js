const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const VPLAN_API_TOKEN = process.env.VPLAN_API_TOKEN || '6esaJiXSXzYsbP3bu9syuyU34pwyJtVlFnxoqF45HsrxHMozxEiXpMn6AcMmpWNb';
const VPLAN_ENV_ID = process.env.VPLAN_ENV_ID || 'a27baf4e67847b0ac7b48bc3ed099a5203e535a5';
const VPLAN_BASE_URL = `https://api.vplan.com/v1/environments/${VPLAN_ENV_ID}`;

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
      
      // Test eerst wat de vPlan API endpoints zijn
      try {
        console.log('Test vPlan API endpoints...');
        const testResponse = await axios.get(`${VPLAN_BASE_URL}`, {
          headers: {
            'X-API-Key': VPLAN_API_TOKEN,
            'Content-Type': 'application/json'
          }
        });
        console.log('vPlan base endpoint response:', testResponse.data);
      } catch (testError) {
        console.log('vPlan base endpoint test failed:', testError.message);
      }
      
      // Probeer verschillende endpoints
      const possibleEndpoints = ['/cards', '/items', '/tasks', '/events', '/appointments'];
      
      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Testing GET ${VPLAN_BASE_URL}${endpoint}`);
          const response = await axios.get(`${VPLAN_BASE_URL}${endpoint}`, {
            headers: {
              'X-API-Key': VPLAN_API_TOKEN,
              'Content-Type': 'application/json'
            }
          });
          console.log(`✅ ${endpoint} works:`, response.status);
          console.log(`${endpoint} data sample:`, JSON.stringify(response.data).substring(0, 200));
        } catch (error) {
          console.log(`❌ ${endpoint} failed:`, error.response?.status, error.message);
        }
      }
    } else if (event === 'request_updated') {
      // Request werd gewijzigd - check status voor goedkeuring/afwijzing
      const status = reqData.status; // "ok", "pending", "rejected", etc.
      
      console.log('Request status:', status);
      console.log('Changes:', payload.changes);
      
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        let updatedTitle = title;
        let updatedDescription = description;
        
        // Check status voor emoji/labels
        if (status === 'ok') {
          updatedTitle = `✅ ${title}`;
          updatedDescription = `${description} - GOEDGEKEURD`;
          console.log('Status gewijzigd naar goedgekeurd');
        } else if (status === 'rejected') {
          updatedTitle = `❌ ${title}`;
          updatedDescription = `${description} - AFGEWEZEN`;
          console.log('Status gewijzigd naar afgewezen');
        } else if (status === 'canceled') {
          updatedTitle = `🚫 ${title}`;
          updatedDescription = `${description} - GEANNULEERD`;
          console.log('Status gewijzigd naar geannuleerd');
        } else if (status === 'pending') {
          updatedTitle = `⏳ ${title}`;
          updatedDescription = `${description} - IN BEHANDELING`;
          console.log('Status gewijzigd naar in behandeling');
        }
        
        console.log('Update vPlan kaart:', cardId);
        await axios.patch(`${VPLAN_BASE_URL}/cards/${cardId}`, {
          title: updatedTitle,
          description: updatedDescription,
          start,
          end,
          assignedTo
        }, {
          headers: { 'X-API-Key': VPLAN_API_TOKEN, 'Content-Type': 'application/json' }
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
          headers: { 'X-API-Key': VPLAN_API_TOKEN }
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