require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// vPlan API configuratie
const VPLAN_BASE_URL = 'https://api.vplan.com/v1';
const VPLAN_API_TOKEN = process.env.VPLAN_API_TOKEN || process.env.VPLAN_API_KEY;
const VPLAN_ENV_ID = process.env.VPLAN_ENV_ID || process.env.VPLAN_API_ENV;

console.log('vPlan configuratie:');
console.log('- API Token:', VPLAN_API_TOKEN ? 'Aanwezig' : 'NIET INGESTELD');
console.log('- Environment ID:', VPLAN_ENV_ID ? 'Aanwezig' : 'NIET INGESTELD');
console.log('🔍 Debug - Environment variables:');
console.log('  - VPLAN_API_TOKEN:', process.env.VPLAN_API_TOKEN ? 'SET' : 'NOT SET');
console.log('  - VPLAN_API_KEY:', process.env.VPLAN_API_KEY ? 'SET' : 'NOT SET');
console.log('  - VPLAN_ENV_ID:', process.env.VPLAN_ENV_ID ? 'SET' : 'NOT SET');
console.log('  - VPLAN_API_ENV:', process.env.VPLAN_API_ENV ? 'SET' : 'NOT SET');

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Rework vPlan Webhook Integration',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint voor Rework events
app.post('/webhook/rework', async (req, res) => {
  try {
    const { event, ...reqData } = req.body;
    
    console.log(`📥 Rework webhook ontvangen: ${event}`);
    console.log('Data:', JSON.stringify(reqData, null, 2));

    if (event === 'request_created') {
      // Maak een collection in vPlan aan
      console.log('📝 Maak vPlan collection aan...');
      
      const userName = reqData.user?.name || 'Onbekende gebruiker';
      const startDate = reqData.first_date;
      const endDate = reqData.last_date;
      const requestType = reqData.request_type?.name || 'Verlofverzoek';
      
      const collectionResponse = await axios.post(`${VPLAN_BASE_URL}/collection`, {
        name: `${requestType} - ${userName}`,
        description: `Van ${startDate} t/m ${endDate} - ${requestType} (Rework ID: ${reqData.id})`,
        due_date: endDate,
        external_ref: `rework_${reqData.id}`,
        start: startDate,
        end: endDate
      }, {
        headers: {
          'x-api-key': VPLAN_API_TOKEN,
          'x-api-env': VPLAN_ENV_ID,
          'Content-Type': 'application/json'
        }
      });

      const collectionId = collectionResponse.data.id;
      console.log('✅ vPlan collection aangemaakt:', collectionId);
      
      // Probeer automatisch te plannen
      await planCollectionToBoard(collectionId, userName, startDate, endDate);
      
    } else if (event === 'request_destroyed') {
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        console.log('🗑️ Verwijder vPlan collection:', cardId);
        await axios.delete(`${VPLAN_BASE_URL}/collection/${cardId}`, {
          headers: { 
            'x-api-key': VPLAN_API_TOKEN,
            'x-api-env': VPLAN_ENV_ID
          }
        });
        console.log('✅ vPlan collection verwijderd');
      } else {
        console.log('❌ Geen collection ID gevonden voor request:', reqData.id);
      }
    } else {
      console.log('Onbekend event:', event);
    }

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

// Functie om een collection automatisch naar een board te verplaatsen (volgens vPlan API documentatie)
async function planCollectionToBoard(collectionId, userName, startDate, endDate) {
  try {
    console.log(`🎯 Probeer collection ${collectionId} te plannen voor ${userName} van ${startDate} tot ${endDate}`);
    
    // Stap 1: Haal alle beschikbare boards op
    console.log('📋 Haal beschikbare boards op...');
    const boardsResponse = await axios.get(`${VPLAN_BASE_URL}/board`, {
      headers: {
        'x-api-key': VPLAN_API_TOKEN,
        'x-api-env': VPLAN_ENV_ID,
        'Content-Type': 'application/json'
      }
    });
    
    const boards = boardsResponse.data?.data || [];
    console.log(`✅ Gevonden ${boards.length} boards:`, boards.map(b => ({ id: b.id, name: b.name })));
    
    if (boards.length === 0) {
      console.log('❌ Geen boards gevonden. Collection blijft in backlog');
      return;
    }
    
    // Stap 2: Haal alle beschikbare resources op
    console.log('👥 Haal beschikbare resources op...');
    const resourcesResponse = await axios.get(`${VPLAN_BASE_URL}/resource`, {
      headers: {
        'x-api-key': VPLAN_API_TOKEN,
        'x-api-env': VPLAN_ENV_ID,
        'Content-Type': 'application/json'
      }
    });
    
    const resources = resourcesResponse.data?.data || [];
    console.log(`✅ Gevonden ${resources.length} resources:`, resources.map(r => ({ id: r.id, name: r.name })));
    
    // Stap 3: Zoek de juiste resource op basis van naam
    const matchingResource = resources.find(resource => {
      const resourceName = resource.name?.toLowerCase() || '';
      const searchName = userName.toLowerCase();
      return resourceName.includes(searchName) || searchName.includes(resourceName);
    });
    
    if (!matchingResource) {
      console.log(`❌ Geen resource gevonden voor "${userName}". Beschikbare resources:`, resources.map(r => r.name));
      console.log('💡 Collection blijft in backlog staan');
      return;
    }
    
    console.log(`✅ Resource gevonden: ${matchingResource.name} (${matchingResource.id})`);
    
    // Stap 4: Gebruik het eerste board (kan later configureerbaar gemaakt worden)
    const targetBoard = boards[0];
    console.log(`🎯 Gebruik board: ${targetBoard.name} (${targetBoard.id})`);
    
    // Stap 5: Verplaats collection naar board (volgens vPlan API documentatie)
    console.log('📅 Plan collection naar board...');
    const planResponse = await axios.post(`${VPLAN_BASE_URL}/collection/${collectionId}/board/${targetBoard.id}`, {
      start: startDate,
      end: endDate,
      resources: [matchingResource.id]
    }, {
      headers: {
        'x-api-key': VPLAN_API_TOKEN,
        'x-api-env': VPLAN_ENV_ID,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Collection succesvol gepland!');
    console.log(`📋 Status: ${planResponse.data.status}`);
    console.log(`👤 Toegewezen aan: ${matchingResource.name}`);
    console.log(`📅 Periode: ${startDate} tot ${endDate}`);
    console.log('⏳ Cards worden asynchroon aangemaakt door vPlan...');
    
    // Wacht op asynchrone card creation (volgens vPlan API documentatie)
    setTimeout(async () => {
      await checkAsyncCardCreation(collectionId, targetBoard, matchingResource);
    }, 15000); // Wacht 15 seconden op asynchrone processing
    
  } catch (error) {
    console.log('❌ Automatische planning gefaald:', error.response?.status, error.response?.statusText);
    console.log('Error details:', error.response?.data);
    console.log('💡 Collection blijft in backlog staan en kan handmatig gepland worden');
  }
}

// Helper functie om te checken of cards asynchroon zijn aangemaakt
async function checkAsyncCardCreation(collectionId, targetBoard, matchingResource) {
  try {
    console.log('🔍 Check voor asynchroon aangemaakte cards...');
    
    // Check collection status
    const collectionResponse = await axios.get(`${VPLAN_BASE_URL}/collection/${collectionId}`, {
      headers: {
        'x-api-key': VPLAN_API_TOKEN,
        'x-api-env': VPLAN_ENV_ID,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Collection status:', collectionResponse.data.status);
    console.log('📋 Collection board_id:', collectionResponse.data.board_id);
    
    // Check voor cards van deze collection
    const cardsResponse = await axios.get(`${VPLAN_BASE_URL}/card?collection_id=${collectionId}`, {
      headers: {
        'x-api-key': VPLAN_API_TOKEN,
        'x-api-env': VPLAN_ENV_ID,
        'Content-Type': 'application/json'
      }
    });
    
    const collectionCards = cardsResponse.data?.data || [];
    console.log(`🃏 Cards voor collection ${collectionId}:`, collectionCards.length);
    
    if (collectionCards.length > 0) {
      console.log('✅ Cards succesvol aangemaakt door vPlan!');
      collectionCards.forEach(card => {
        console.log(`🃏 Card: ${card.name || card.title} (${card.id})`);
        console.log(`📅 Start: ${card.start || card.start_date || 'geen datum'}`);
        console.log(`📅 End: ${card.end || card.end_date || 'geen datum'}`);
        console.log(`👥 Resources: ${card.resources?.map(r => r.name).join(', ') || 'none'}`);
        console.log(`🏷️  Stage: ${card.stage?.name || 'geen stage'}`);
      });
      
      // Check specifiek Marcel's planning
      const marcelCards = collectionCards.filter(card => 
        card.resources?.some(resource => resource.id === matchingResource.id)
      );
      
      if (marcelCards.length > 0) {
        console.log(`🎯 ${matchingResource.name} heeft ${marcelCards.length} nieuwe card(s) in zijn planning!`);
      }
    } else {
      console.log('⚠️  Nog geen cards zichtbaar na 15 seconden');
      console.log('💡 vPlan kan meer tijd nodig hebben voor asynchrone processing');
      console.log('🔍 Check handmatig in vPlan interface');
    }
    
  } catch (debugError) {
    console.log('🔍 Card check gefaald:', debugError.response?.status, debugError.response?.statusText);
    console.log('💡 Cards worden mogelijk later asynchroon zichtbaar');
  }
}

function findCardIdForRequest(reworkRequestId) {
  // hier moet je eigen logica/dataopslag maken: 
  // bv. een DB waarin je opslaat: reworkRequestId ↔ vPlanCardId
  console.log('Zoek card ID voor request:', reworkRequestId);
  return Promise.resolve(null); // placeholder
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Rework-vPlan webhook server gestart op poort ${port}`);
  console.log(`📡 Webhook URL: https://rework-kiaa.onrender.com/webhook/rework`);
});