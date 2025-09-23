const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const VPLAN_API_TOKEN = process.env.VPLAN_API_TOKEN || '6esaJiXSXzYsbP3bu9syuyU34pwyJtVlFnxoqF45HsrxHMozxEiXpMn6AcMmpWNb';
const VPLAN_ENV_ID = process.env.VPLAN_ENV_ID || 'a27baf4e67847b0ac7b48bc3ed099a5203e535a5';
const VPLAN_BASE_URL = `https://api.vplan.com/v1/environments/${VPLAN_ENV_ID}`;

// Helper function om card ID te vinden voor een Rework request
// In een echte implementatie zou je dit in een database opslaan
async function findCardIdForRequest(requestId) {
  try {
    // Voor nu: zoek in alle collections naar een titel die de request bevat
    console.log(`Zoek collection voor Rework request ${requestId}`);
    
    const collectionsResponse = await axios.get(`${VPLAN_BASE_URL}/collections`, {
      headers: {
        'X-API-Key': VPLAN_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    // Zoek collection die overeenkomt met dit request
    // (dit is een simplified zoekfunctie - in praktijk zou je dit beter doen)
    for (const collection of collectionsResponse.data || []) {
      if (collection.description && collection.description.includes(`Rework ID: ${requestId}`)) {
        console.log(`Gevonden collection ${collection.id} voor request ${requestId}`);
        return collection.id;
      }
    }
    
    console.log(`Geen collection gevonden voor request ${requestId}`);
    return null;
    
  } catch (error) {
    console.log('Error finding collection:', error.message);
    return null;
  }
}

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
    const description = `Van ${reqData.first_date} t/m ${reqData.last_date} - ${reqData.request_type?.name || 'Verlofverzoek'} (Rework ID: ${reqData.id})`;
    const start = reqData.first_date;
    const end = reqData.last_date;
    const assignedTo = [ reqData.user.reference ];  // of een interne mapping user → vPlan user-id

    console.log('Verwerk event:', event);
    console.log('vPlan data:', { title, description, start, end, assignedTo });

    if (event === 'request_created') {
      console.log('🔍 Onderzoek vPlan API endpoints...');
      
      try {
        // Eerst kijken wat er beschikbaar is
        console.log('📋 Beschikbare collections:');
        const collectionsResponse = await axios.get(`${VPLAN_BASE_URL}/collections`, {
          headers: {
            'X-API-Key': VPLAN_API_TOKEN,
            'Content-Type': 'application/json'
          }
        });
        console.log('Collections:', JSON.stringify(collectionsResponse.data, null, 2));
        
        // Kijk naar boards
        console.log('📋 Beschikbare boards:');
        try {
          const boardsResponse = await axios.get(`${VPLAN_BASE_URL}/boards`, {
            headers: {
              'X-API-Key': VPLAN_API_TOKEN,
              'Content-Type': 'application/json'
            }
          });
          console.log('Boards:', JSON.stringify(boardsResponse.data, null, 2));
        } catch (boardError) {
          console.log('❌ Boards endpoint niet beschikbaar:', boardError.response?.status);
        }
        
        // Kijk naar cards binnen collections
        if (collectionsResponse.data && collectionsResponse.data.length > 0) {
          const firstCollection = collectionsResponse.data[0];
          console.log(`📋 Cards in collection ${firstCollection.id}:`);
          try {
            const cardsResponse = await axios.get(`${VPLAN_BASE_URL}/collections/${firstCollection.id}/cards`, {
              headers: {
                'X-API-Key': VPLAN_API_TOKEN,
                'Content-Type': 'application/json'
              }
            });
            console.log('Cards in collection:', JSON.stringify(cardsResponse.data, null, 2));
            
            // Test of we cards kunnen aanmaken binnen een collection
            console.log('🧪 Test card creation binnen collection...');
            try {
              const newCardResponse = await axios.post(`${VPLAN_BASE_URL}/collections/${firstCollection.id}/cards`, {
                title: title,
                description: description,
                start_date: start,
                end_date: end
              }, {
                headers: {
                  'X-API-Key': VPLAN_API_TOKEN,
                  'Content-Type': 'application/json'
                }
              });
              console.log('✅ Card succesvol aangemaakt in collection!', newCardResponse.data);
            } catch (cardError) {
              console.log('❌ Card creation in collection failed:', cardError.response?.status, cardError.response?.data);
            }
            
          } catch (cardsError) {
            console.log('❌ Cards endpoint niet beschikbaar:', cardsError.response?.status);
          }
        }
        
        // Test andere mogelijke endpoints
        const testEndpoints = ['/users', '/projects', '/tasks', '/events', '/calendar'];
        for (const endpoint of testEndpoints) {
          try {
            console.log(`🧪 Test ${endpoint}:`);
            const response = await axios.get(`${VPLAN_BASE_URL}${endpoint}`, {
              headers: {
                'X-API-Key': VPLAN_API_TOKEN,
                'Content-Type': 'application/json'
              }
            });
            console.log(`✅ ${endpoint} beschikbaar:`, response.data ? 'Has data' : 'Empty');
          } catch (error) {
            console.log(`❌ ${endpoint}:`, error.response?.status);
          }
        }
        
      } catch (error) {
        console.log('❌ API exploration failed:', error.response?.status, error.response?.data);
      }
      
      console.log('⚠️  vPlan API lijkt read-only te zijn - geen POST endpoints gevonden');
      console.log('💡 Mogelijke oplossingen:');
      console.log('   1. Gebruik vPlan webhooks om data naar Rework te sturen (omgekeerd)');
      console.log('   2. Gebruik vPlan CSV import functionaliteit'); 
      console.log('   3. Vraag vPlan support om write-toegang via API');
      console.log('   4. Gebruik vPlan iCalendar integration voor agenda sync');
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
        
        console.log('Update vPlan collection:', cardId);
        await axios.patch(`${VPLAN_BASE_URL}/collections/${cardId}`, {
          title: updatedTitle,
          description: updatedDescription,
          start_date: start,
          end_date: end
        }, {
          headers: { 'X-API-Key': VPLAN_API_TOKEN, 'Content-Type': 'application/json' }
        });
        console.log('vPlan collection bijgewerkt');
      } else {
        console.log('Geen collection ID gevonden voor request:', reqData.id);
      }
    } else if (event === 'request_destroyed') {
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        console.log('Verwijder vPlan collection:', cardId);
        // Bijvoorbeeld verwijderen of markeren als "geannuleerd"
        await axios.delete(`${VPLAN_BASE_URL}/collections/${cardId}`, {
          headers: { 'X-API-Key': VPLAN_API_TOKEN }
        });
        console.log('vPlan collection verwijderd');
      } else {
        console.log('Geen collection ID gevonden voor request:', reqData.id);
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