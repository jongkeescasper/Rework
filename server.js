require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// vPlan API configuratie
const VPLAN_BASE_URL = 'https://api.vplan.com/v1';
const VPLAN_API_TOKEN = process.env.VPLAN_API_TOKEN || process.env.VPLAN_API_KEY;
const VPLAN_ENV_ID = process.env.VPLAN_ENV_ID || process.env.VPLAN_API_ENV;

// Rework API configuratie
const REWORK_API_TOKEN = process.env.REWORK_API_TOKEN;
const REWORK_COMPANY_ID = process.env.REWORK_COMPANY_ID;

console.log('vPlan configuratie:');
console.log('- API Token:', VPLAN_API_TOKEN ? 'Aanwezig' : 'NIET INGESTELD');
console.log('- Environment ID:', VPLAN_ENV_ID ? 'Aanwezig' : 'NIET INGESTELD');
console.log('Rework configuratie:');
console.log('- API Token:', REWORK_API_TOKEN ? 'Aanwezig' : 'NIET INGESTELD');
console.log('- Company ID:', REWORK_COMPANY_ID ? REWORK_COMPANY_ID : 'NIET INGESTELD');
console.log('🔍 Debug - Environment variables:');
console.log('  - VPLAN_API_TOKEN:', process.env.VPLAN_API_TOKEN ? 'SET' : 'NOT SET');
console.log('  - VPLAN_API_KEY:', process.env.VPLAN_API_KEY ? 'SET' : 'NOT SET');
console.log('  - VPLAN_ENV_ID:', process.env.VPLAN_ENV_ID ? 'SET' : 'NOT SET');
console.log('  - VPLAN_API_ENV:', process.env.VPLAN_API_ENV ? 'SET' : 'NOT SET');
console.log('  - REWORK_API_TOKEN:', process.env.REWORK_API_TOKEN ? 'SET' : 'NOT SET');
console.log('  - REWORK_COMPANY_ID:', process.env.REWORK_COMPANY_ID ? 'SET' : 'NOT SET');

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Rework vPlan Webhook Integration',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Auto-fetch endpoint om goedgekeurde verlofaanvragen op te halen uit Rework API
app.get('/import/auto-fetch', async (req, res) => {
  try {
    console.log('🔍 Automatisch ophalen goedgekeurde verlofaanvragen uit Rework...');
    
    // Check Rework API credentials
    if (!REWORK_API_TOKEN || !REWORK_COMPANY_ID) {
      return res.status(500).json({
        error: 'Rework API niet geconfigureerd',
        message: 'REWORK_API_TOKEN en REWORK_COMPANY_ID environment variables zijn vereist',
        missing: {
          token: !REWORK_API_TOKEN,
          company_id: !REWORK_COMPANY_ID
        }
      });
    }
    
    // Query parameters voor filtering
    const fromDate = req.query.from_date; // bijv: 2025-01-01
    const toDate = req.query.to_date;     // bijv: 2025-12-31  
    const userId = req.query.user_id;     // specifieke gebruiker
    const perPage = Math.min(parseInt(req.query.per_page) || 50, 100); // max 100
    const page = parseInt(req.query.page) || 1;
    
    // Bouw Rework API URL
    const reworkUrl = `https://api.rework.nl/v2/${REWORK_COMPANY_ID}/leave/requests`;
    const params = new URLSearchParams({
      status: 'ok', // Alleen goedgekeurde requests
      per_page: perPage.toString(),
      page: page.toString()
    });
    
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (userId) params.append('user_id', userId);
    
    const fullUrl = `${reworkUrl}?${params.toString()}`;
    console.log(`📡 Rework API URL: ${fullUrl}`);
    
    // Haal data op uit Rework
    const reworkResponse = await axios.get(fullUrl, {
      headers: {
        'Authorization': `Bearer ${REWORK_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const requests = reworkResponse.data || [];
    console.log(`📋 Gevonden ${requests.length} goedgekeurde verlofaanvragen in Rework`);
    
    if (requests.length === 0) {
      return res.json({
        message: 'Geen goedgekeurde verlofaanvragen gevonden',
        filters: {
          from_date: fromDate,
          to_date: toDate,
          user_id: userId,
          page: page,
          per_page: perPage
        },
        total: 0,
        results: []
      });
    }
    
    // Process elke request
    const results = [];
    
    for (const request of requests) {
      try {
        console.log(`📋 Verwerk request ${request.id}: ${request.user?.name}`);
        
        // Check of al geïmporteerd
        const userName = request.user?.name || 'Onbekende gebruiker';
        const requestType = request.request_type?.name || 'Verlofverzoek';
        
        const alreadyImported = await checkIfAlreadyImported(request.id, userName);
        if (alreadyImported) {
          console.log(`⏭️ Skip request ${request.id} - al eerder geïmporteerd`);
          results.push({ 
            id: request.id, 
            success: false, 
            reason: 'Al eerder geïmporteerd',
            user: userName,
            type: requestType
          });
          continue;
        }
        
        // Importeer via bestaande Schedule Deviation logica
        await createScheduleDeviation(request, userName, requestType);
        
        results.push({ 
          id: request.id, 
          success: true, 
          user: userName,
          type: requestType,
          days: request.slots?.length || 0,
          dates: request.slots?.map(s => s.date.split('T')[0]) || []
        });
        
        console.log(`✅ Request ${request.id} succesvol geïmporteerd voor ${userName}`);
        
      } catch (importError) {
        console.error(`❌ Fout bij importeren request ${request.id}:`, importError.message);
        results.push({ 
          id: request.id, 
          success: false, 
          reason: importError.message,
          user: request.user?.name || 'Onbekend'
        });
      }
    }
    
    // Samenvatting
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => !r.success && r.reason === 'Al eerder geïmporteerd').length;
    
    console.log(`📊 Auto-fetch voltooid: ${successful} nieuw geïmporteerd, ${skipped} al aanwezig, ${failed - skipped} gefaald`);
    
    res.json({
      message: 'Auto-fetch voltooid',
      summary: {
        total_found: requests.length,
        imported: successful,
        skipped: skipped,
        failed: failed - skipped
      },
      filters_used: {
        from_date: fromDate,
        to_date: toDate,
        user_id: userId,
        page: page,
        per_page: perPage
      },
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Fout bij auto-fetch:', error);
    
    // Specifieke Rework API fouten
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: 'Rework API authenticatie gefaald', 
        message: 'Check je REWORK_API_TOKEN',
        status: error.response.status
      });
    }
    
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        error: 'Rework company niet gevonden', 
        message: 'Check je REWORK_COMPANY_ID',
        status: error.response.status
      });
    }
    
    res.status(500).json({ 
      error: 'Auto-fetch gefaald', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Import endpoint voor bestaande goedgekeurde verlofaanvragen
app.post('/import/approved-requests', async (req, res) => {
  try {
    console.log('📥 Import van bestaande goedgekeurde verlofaanvragen gestart...');
    
    // Simuleer Rework API call (je moet hier je eigen Rework API credentials gebruiken)
    // const reworkResponse = await axios.get('https://api.rework.com/requests?status=ok', {
    //   headers: { 'Authorization': `Bearer ${process.env.REWORK_API_TOKEN}` }
    // });
    
    // Voor nu: handmatige data of via request body
    const requestsToImport = req.body.requests || [];
    
    if (requestsToImport.length === 0) {
      return res.status(400).json({
        error: 'Geen requests gevonden om te importeren',
        message: 'Stuur een POST request met een "requests" array in de body'
      });
    }
    
    console.log(`🔍 Gevonden ${requestsToImport.length} request(s) om te importeren`);
    
    const results = [];
    
    // Verwerk elke request
    for (const request of requestsToImport) {
      try {
        console.log(`📋 Importeer request ${request.id}: ${request.user?.name}`);
        
        // Check of het goedgekeurd is
        if (request.status !== 'ok') {
          console.log(`⏭️ Skip request ${request.id} - status: ${request.status} (niet goedgekeurd)`);
          results.push({ 
            id: request.id, 
            success: false, 
            reason: `Status: ${request.status} (niet goedgekeurd)` 
          });
          continue;
        }
        
        // Check of al geïmporteerd (via external_ref)
        const userName = request.user?.name || 'Onbekende gebruiker';
        const requestType = request.request_type?.name || 'Verlofverzoek';
        
        const alreadyImported = await checkIfAlreadyImported(request.id, userName);
        if (alreadyImported) {
          console.log(`⏭️ Skip request ${request.id} - al eerder geïmporteerd`);
          results.push({ 
            id: request.id, 
            success: false, 
            reason: 'Al eerder geïmporteerd' 
          });
          continue;
        }
        
        // Importeer via bestaande Schedule Deviation logica
        await createScheduleDeviation(request, userName, requestType);
        
        results.push({ 
          id: request.id, 
          success: true, 
          user: userName,
          type: requestType,
          days: request.slots?.length || 0
        });
        
        console.log(`✅ Request ${request.id} succesvol geïmporteerd voor ${userName}`);
        
      } catch (importError) {
        console.error(`❌ Fout bij importeren request ${request.id}:`, importError.message);
        results.push({ 
          id: request.id, 
          success: false, 
          reason: importError.message 
        });
      }
    }
    
    // Samenvatting
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📊 Import voltooid: ${successful} succesvol, ${failed} gefaald`);
    
    res.json({
      message: 'Import voltooid',
      summary: {
        total: requestsToImport.length,
        successful: successful,
        failed: failed
      },
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Fout bij import:', error);
    res.status(500).json({ 
      error: 'Import gefaald', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook endpoint voor Rework events
app.post('/webhook/rework', async (req, res) => {
  try {
    const { event, ...reqData } = req.body;
    
    console.log(`📥 Rework webhook ontvangen: ${event}`);
    console.log('Data:', JSON.stringify(reqData, null, 2));

    if (event === 'request_created') {
      // Bij aanmaken alleen loggen, pas bij goedkeuring actie ondernemen
      console.log('📝 Verlofaanvraag aangemaakt, wacht op goedkeuring...');
      console.log(`👤 ${reqData.user?.name}: ${reqData.request_type?.name}`);
      console.log(`📅 ${reqData.first_date?.split('T')[0]} tot ${reqData.last_date?.split('T')[0]}`);
      console.log('⏳ Geen actie ondernomen - wacht op goedkeuring');
      
    } else if (event === 'request_updated') {
      // Check of de status is gewijzigd naar 'ok' (goedgekeurd)
      const statusChanged = reqData.changes?.status;
      const currentStatus = reqData.status;
      
      console.log('� Verlofaanvraag bijgewerkt');
      console.log(`� Status: ${currentStatus}`);
      
      if (statusChanged) {
        console.log(`📊 Status gewijzigd: ${statusChanged[0]} → ${statusChanged[1]}`);
      }
      
      if (currentStatus === 'ok' && statusChanged && statusChanged[1] === 'ok') {
        // Status is gewijzigd naar goedgekeurd - maak vPlan afwezigheid aan
        console.log('✅ Verlofaanvraag goedgekeurd - maak vPlan afwezigheid aan...');
        
        const userName = reqData.user?.name || 'Onbekende gebruiker';
        const requestType = reqData.request_type?.name || 'Verlofverzoek';
        
        await createScheduleDeviation(reqData, userName, requestType);
      } else {
        console.log('ℹ️ Geen actie ondernomen - nog niet goedgekeurd of andere wijziging');
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

// Helper functie om te checken of een Rework request al eerder geïmporteerd is
async function checkIfAlreadyImported(reworkRequestId, userName) {
  try {
    console.log(`🔍 Check of request ${reworkRequestId} al geïmporteerd is voor ${userName}...`);
    
    // Zoek de resource
    const matchingResource = await findResourceByName(userName);
    if (!matchingResource) {
      console.log(`❌ Resource niet gevonden voor ${userName}`);
      return false;
    }
    
    // Haal Schedule Deviations op voor deze resource
    const deviationsResponse = await axios.get(`${VPLAN_BASE_URL}/resource/${matchingResource.id}/schedule_deviation`, {
      headers: {
        'x-api-key': VPLAN_API_TOKEN,
        'x-api-env': VPLAN_ENV_ID,
        'Content-Type': 'application/json'
      }
    });
    
    const deviations = deviationsResponse.data?.data || [];
    
    // Check voor external_ref die deze Rework request ID bevat
    const existingDeviations = deviations.filter(deviation => 
      deviation.external_ref && deviation.external_ref.includes(`rework_${reworkRequestId}`)
    );
    
    if (existingDeviations.length > 0) {
      console.log(`✅ Request ${reworkRequestId} al geïmporteerd - gevonden ${existingDeviations.length} Schedule Deviation(s)`);
      return true;
    } else {
      console.log(`📋 Request ${reworkRequestId} nog niet geïmporteerd`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Fout bij checken import status voor request ${reworkRequestId}:`, error.response?.data || error.message);
    return false; // Bij twijfel niet importeren
  }
}

// Functie om Schedule Deviation (afwezigheid) aan te maken in vPlan
async function createScheduleDeviation(reqData, userName, requestType) {
  try {
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
        // Parse datum direct uit ISO string om tijdzone problemen te voorkomen
        const dayString = slot.date.split('T')[0]; // Krijg YYYY-MM-DD direct uit ISO string
        const hours = parseFloat(slot.hours) || 8; // Gebruik exacte uren uit slot
        
        try {
          console.log(`📅 Verwerk dag: ${dayString} (${hours} uur)`);
          console.log(`🔍 Debug - Slot data:`, {
            original_date: slot.date,
            parsed_day: dayString,
            hours: hours,
            all_day: slot.all_day
          });
          
          const payload = {
            description: `${requestType} - ${userName}`,
            type: 'leave', // of 'vacation', 'sick', 'other'
            start_date: dayString,
            end_date: dayString, // Zelfde dag voor start en eind
            time: Math.round(hours * 60), // Vermenigvuldig met 60 voor minuten
            external_ref: `rework_${reqData.id}_${dayString}`
          };
          
          console.log(`📤 Verstuur naar vPlan:`, payload);
          
          const deviationResponse = await axios.post(`${VPLAN_BASE_URL}/resource/${matchingResource.id}/schedule_deviation/`, payload, {
            headers: {
              'x-api-key': VPLAN_API_TOKEN,
              'x-api-env': VPLAN_ENV_ID,
              'Content-Type': 'application/json'
            }
          });
          
          deviations.push({ date: dayString, hours: hours, minutes: Math.round(hours * 60), success: true });
          console.log(`✅ Afwezigheid voor ${dayString} aangemaakt (${hours} uur = ${Math.round(hours * 60)} minuten)`);
          
        } catch (dayError) {
          console.error(`❌ Fout voor dag ${dayString}:`, dayError.response?.data || dayError.message);
          console.error(`🔍 Debug - API Error Details:`, {
            status: dayError.response?.status,
            statusText: dayError.response?.statusText,
            headers: dayError.response?.headers,
            config_url: dayError.config?.url,
            config_data: dayError.config?.data
          });
          deviations.push({ date: dayString, hours: hours, minutes: Math.round(hours * 60), success: false, error: dayError.message });
        }
      }
      
      // Samenvatting
      const successfulDays = deviations.filter(d => d.success).length;
      const totalDays = deviations.length;
      const totalHours = deviations.filter(d => d.success).reduce((sum, d) => sum + d.hours, 0);
      const totalMinutes = deviations.filter(d => d.success).reduce((sum, d) => sum + d.minutes, 0);
      
      console.log(`✅ vPlan afwezigheid aangemaakt voor ${successfulDays}/${totalDays} dagen!`);
      console.log(`📅 Totaal: ${totalHours} uur (${totalMinutes} minuten) afwezigheid`);
      console.log(`👤 Voor: ${matchingResource.name}`);
      console.log(`🏷️  Type: ${requestType}`);
      console.log('🎉 Afwezigheid staat nu in de planning!');
      
    } else {
      console.log(`❌ Geen resource gevonden voor "${userName}"`);
      console.log('💡 Afwezigheid kan niet automatisch worden ingepland');
    }
  } catch (error) {
    console.error('❌ Fout bij aanmaken Schedule Deviation:', error.message);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Rework-vPlan webhook server gestart op poort ${port}`);
  console.log(`📡 Webhook URL: https://rework-kiaa.onrender.com/webhook/rework`);
});