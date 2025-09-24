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
      // Maak een afwezigheid (Schedule Deviation) in vPlan aan
      console.log('� Maak vPlan afwezigheid aan...');
      
      const userName = reqData.user?.name || 'Onbekende gebruiker';
      const startDate = reqData.first_date;
      const endDate = reqData.last_date;
      const requestType = reqData.request_type?.name || 'Verlofverzoek';
      
      // Vind de juiste resource (gebruiker)
      const matchingResource = await findResourceByName(userName);
      
      if (matchingResource) {
        console.log(`✅ Resource gevonden: ${matchingResource.name} (${matchingResource.id})`);
        
        // Gebruik slots data voor precieze dagen en uren
        const slots = reqData.slots || [];
        const deviations = [];
        
        console.log(`📅 Maak afwezigheid aan voor ${slots.length} slot(s)...`);
        
        // Loop door elke slot (dag) uit Rework
        for (const slot of slots) {
          const slotDate = new Date(slot.date);
          const dayString = slotDate.toISOString().split('T')[0]; // YYYY-MM-DD format
          const hours = parseFloat(slot.hours) || 8; // Gebruik exacte uren uit slot
          
          try {
            console.log(`📅 Verwerk dag: ${dayString} (${hours} uur)`);
            
            const deviationResponse = await axios.post(`${VPLAN_BASE_URL}/resource/${matchingResource.id}/schedule_deviation/`, {
              description: `${requestType} - ${userName}`,
              type: 'leave', // of 'vacation', 'sick', 'other'
              start_date: dayString,
              end_date: dayString, // Zelfde dag voor start en eind
              time: hours, // Exacte uren uit Rework slot
              external_ref: `rework_${reqData.id}_${dayString}`
            }, {
              headers: {
                'x-api-key': VPLAN_API_TOKEN,
                'x-api-env': VPLAN_ENV_ID,
                'Content-Type': 'application/json'
              }
            });
            
            deviations.push({ date: dayString, hours: hours, success: true });
            console.log(`✅ Afwezigheid voor ${dayString} aangemaakt (${hours} uur)`);
            
          } catch (dayError) {
            console.error(`❌ Fout voor dag ${dayString}:`, dayError.response?.data || dayError.message);
            deviations.push({ date: dayString, hours: hours, success: false, error: dayError.message });
          }
        }
        
        // Samenvatting
        const successfulDays = deviations.filter(d => d.success).length;
        const totalDays = deviations.length;
        const totalHours = deviations.filter(d => d.success).reduce((sum, d) => sum + d.hours, 0);
        
        console.log(`✅ vPlan afwezigheid aangemaakt voor ${successfulDays}/${totalDays} dagen!`);
        console.log(`📅 Totaal: ${totalHours} uur afwezigheid`);
        console.log(`👤 Voor: ${matchingResource.name}`);
        console.log(`🏷️  Type: ${requestType}`);
        console.log('🎉 Volledige afwezigheid staat nu in Marcel\'s planning!');
        
      } else {
        console.log(`❌ Geen resource gevonden voor "${userName}"`);
        console.log('💡 Afwezigheid kan niet automatisch worden ingepland');
      }
      
    } else if (event === 'request_destroyed') {
      // Verwijder Schedule Deviations voor deze aanvraag
      console.log('🗑️ Verwijder vPlan afwezigheid...');
      
      const userName = reqData.user?.name || 'Onbekende gebruiker';
      const startDate = reqData.first_date;
      const endDate = reqData.last_date;
      
      // Vind de juiste resource (gebruiker)
      const matchingResource = await findResourceByName(userName);
      
      if (matchingResource) {
        console.log(`✅ Resource gevonden: ${matchingResource.name} (${matchingResource.id})`);
        
        // Haal alle Schedule Deviations op voor deze resource
        console.log('📋 Zoek Schedule Deviations met external_ref...');
        
        try {
          const deviationsResponse = await axios.get(`${VPLAN_BASE_URL}/resource/${matchingResource.id}/schedule_deviation`, {
            headers: {
              'x-api-key': VPLAN_API_TOKEN,
              'x-api-env': VPLAN_ENV_ID,
              'Content-Type': 'application/json'
            }
          });
          
          const deviations = deviationsResponse.data?.data || [];
          console.log(`📋 Gevonden ${deviations.length} Schedule Deviations voor ${matchingResource.name}`);
          
          // Zoek deviations die bij deze Rework request horen (met external_ref)
          const reworkDeviations = deviations.filter(deviation => 
            deviation.external_ref && deviation.external_ref.includes(`rework_${reqData.id}`)
          );
          
          console.log(`🎯 Gevonden ${reworkDeviations.length} Schedule Deviations voor request ${reqData.id}`);
          
          if (reworkDeviations.length > 0) {
            // Verwijder alle gevonden deviations
            for (const deviation of reworkDeviations) {
              try {
                console.log(`🗑️ Verwijder Schedule Deviation: ${deviation.id} (${deviation.start_date})`);
                await axios.delete(`${VPLAN_BASE_URL}/resource/${matchingResource.id}/schedule_deviation/${deviation.id}`, {
                  headers: {
                    'x-api-key': VPLAN_API_TOKEN,
                    'x-api-env': VPLAN_ENV_ID
                  }
                });
                console.log(`✅ Schedule Deviation ${deviation.id} verwijderd`);
              } catch (deleteError) {
                console.error(`❌ Fout bij verwijderen Schedule Deviation ${deviation.id}:`, deleteError.response?.data || deleteError.message);
              }
            }
            
            console.log(`✅ Afwezigheid verwijderd uit ${matchingResource.name}'s planning!`);
            console.log(`🗑️ ${reworkDeviations.length} Schedule Deviation(s) verwijderd`);
            
          } else {
            console.log(`❌ Geen Schedule Deviations gevonden voor request ${reqData.id}`);
            console.log('💡 Mogelijk al eerder verwijderd of niet automatisch aangemaakt');
          }
          
        } catch (listError) {
          console.error('❌ Fout bij ophalen Schedule Deviations:', listError.response?.data || listError.message);
        }
        
      } else {
        console.log(`❌ Geen resource gevonden voor "${userName}"`);
        console.log('💡 Kan Schedule Deviations niet verwijderen');
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

// Helper functie om een resource te vinden op basis van naam
async function findResourceByName(userName) {
  try {
    console.log(`🔍 Zoek resource voor: ${userName}`);
    
    const resourcesResponse = await axios.get(`${VPLAN_BASE_URL}/resource`, {
      headers: {
        'x-api-key': VPLAN_API_TOKEN,
        'x-api-env': VPLAN_ENV_ID,
        'Content-Type': 'application/json'
      }
    });
    
    const resources = resourcesResponse.data?.data || [];
    console.log(`📋 Gevonden ${resources.length} resources`);
    
    // Zoek matching resource
    const matchingResource = resources.find(resource => {
      const resourceName = resource.name?.toLowerCase() || '';
      const searchName = userName.toLowerCase();
      return resourceName.includes(searchName) || searchName.includes(resourceName);
    });
    
    if (!matchingResource) {
      console.log('📋 Beschikbare resources:', resources.map(r => r.name));
    }
    
    return matchingResource;
  } catch (error) {
    console.error('❌ Fout bij zoeken resource:', error.response?.data || error.message);
    return null;
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Rework-vPlan webhook server gestart op poort ${port}`);
  console.log(`📡 Webhook URL: https://rework-kiaa.onrender.com/webhook/rework`);
});