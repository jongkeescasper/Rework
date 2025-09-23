const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const VPLAN_API_TOKEN = 'jouw-vplan-api-token';
const VPLAN_BASE_URL = 'https://api.vplan.com/v1';

app.post('/webhook/rework', async (req, res) => {
  try {
    const payload = req.body;
    const event = payload.event;  // bv. "request_created" of "request_updated"
    const reqData = payload;       // de “request” data

    // Definieer mapping
    const title = `Vrij - ${reqData.user.name}`;
    const description = `Van ${reqData.first_date} t/m ${reqData.last_date} - ${reqData.request_type.name}`;
    const start = reqData.first_date;
    const end = reqData.last_date;
    const assignedTo = [ reqData.user.reference ];  // of een interne mapping user → vPlan user-id

    if (event === 'request_created') {
      // nieuwe kaart in vPlan
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
    } else if (event === 'request_updated') {
      // update kaart: je moet eerst weten welke kaart hoort bij deze request
      // bijv. je slaat vPlan card-id op in jullie DB gekoppeld aan request.id van Rework
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        await axios.patch(`${VPLAN_BASE_URL}/cards/${cardId}`, {
          title,
          description,
          start,
          end,
          assignedTo
        }, {
          headers: { 'Authorization': `Bearer ${VPLAN_API_TOKEN}`, 'Content-Type': 'application/json' }
        });
      }
    } else if (event === 'request_destroyed') {
      const cardId = await findCardIdForRequest(reqData.id);
      if (cardId) {
        // Bijvoorbeeld verwijderen of markeren als “geannuleerd”
        await axios.delete(`${VPLAN_BASE_URL}/cards/${cardId}`, {
          headers: { 'Authorization': `Bearer ${VPLAN_API_TOKEN}` }
        });
      }
    }

    // Reageer succesvol op de webhook
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling Rework webhook:', err);
    res.status(500).send('Error');
  }
});

function findCardIdForRequest(reworkRequestId) {
  // hier moet je eigen logica/dataopslag maken: 
  // bv. een DB waarin je opslaat: reworkRequestId ↔ vPlanCardId
  return Promise.resolve(null); // placeholder
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook receiver is listening on port ${port}`);
});