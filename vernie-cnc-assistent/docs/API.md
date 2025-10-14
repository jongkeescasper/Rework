# 📚 API Documentatie - Vernie CNC Assistent

## Inhoudsopgave
- [Authenticatie](#authenticatie)
- [Endpoints](#endpoints)
- [Webhook Events](#webhook-events)
- [Error Codes](#error-codes)
- [Voorbeelden](#voorbeelden)

## Authenticatie

Voor productie gebruik kan authenticatie worden toegevoegd via de `API_TOKEN` environment variable.

```bash
Authorization: Bearer your_api_token_here
```

## Endpoints

### Health Check

**Endpoint:** `GET /`

**Beschrijving:** Controleert of de server actief is

**Response:**
```json
{
  "message": "Vernie CNC Assistent",
  "status": "active",
  "timestamp": "2025-10-14T12:00:00Z",
  "version": "1.0.0"
}
```

---

### Alle Machines Ophalen

**Endpoint:** `GET /api/machines`

**Beschrijving:** Haalt een lijst van alle machines op

**Response:**
```json
{
  "success": true,
  "count": 3,
  "machines": [
    {
      "id": "cnc-001",
      "name": "CNC Machine 1",
      "status": "running",
      "currentJob": "Job-2025-001",
      "uptime": 8.5,
      "lastUpdate": "2025-10-14T12:00:00Z"
    }
  ]
}
```

**Machine Status waardes:**
- `running` - Machine is actief bezig met een job
- `idle` - Machine is inactief maar beschikbaar
- `maintenance` - Machine is in onderhoud
- `error` - Machine heeft een fout

---

### Specifieke Machine Ophalen

**Endpoint:** `GET /api/machines/:id`

**Parameters:**
- `id` (path) - Machine ID (bijv. `cnc-001`)

**Response:**
```json
{
  "success": true,
  "machine": {
    "id": "cnc-001",
    "name": "CNC Machine 1",
    "status": "running",
    "currentJob": "Job-2025-001",
    "uptime": 8.5,
    "lastUpdate": "2025-10-14T12:00:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Machine niet gevonden",
  "machineId": "cnc-999"
}
```

---

### Machine Toevoegen

**Endpoint:** `POST /api/machines`

**Body:**
```json
{
  "id": "cnc-004",
  "name": "CNC Machine 4",
  "status": "idle"
}
```

**Verplichte velden:**
- `id` - Unieke machine identifier
- `name` - Machine naam

**Optionele velden:**
- `status` - Initiële status (standaard: `idle`)

**Response (201):**
```json
{
  "success": true,
  "message": "Machine toegevoegd",
  "machine": {
    "id": "cnc-004",
    "name": "CNC Machine 4",
    "status": "idle",
    "currentJob": null,
    "uptime": 0,
    "lastUpdate": "2025-10-14T12:00:00Z"
  }
}
```

**Error Response (409):**
```json
{
  "success": false,
  "error": "Machine met dit ID bestaat al"
}
```

---

### Machine Bijwerken

**Endpoint:** `PUT /api/machines/:id`

**Parameters:**
- `id` (path) - Machine ID

**Body:**
```json
{
  "status": "maintenance",
  "currentJob": null,
  "uptime": 15.5
}
```

**Update velden:**
- `status` - Nieuwe status
- `currentJob` - Huidige job (of `null`)
- `uptime` - Uptime in uren

**Response:**
```json
{
  "success": true,
  "message": "Machine bijgewerkt",
  "machine": {
    "id": "cnc-001",
    "name": "CNC Machine 1",
    "status": "maintenance",
    "currentJob": null,
    "uptime": 15.5,
    "lastUpdate": "2025-10-14T12:05:00Z"
  }
}
```

---

### Statistieken Ophalen

**Endpoint:** `GET /api/stats`

**Beschrijving:** Haalt algemene statistieken van alle machines op

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalMachines": 3,
    "running": 1,
    "idle": 1,
    "maintenance": 1,
    "totalUptime": "20.8",
    "timestamp": "2025-10-14T12:00:00Z"
  }
}
```

---

### Webhook Endpoint

**Endpoint:** `POST /webhook/machine-event`

**Beschrijving:** Ontvangt machine events voor real-time processing

**Body:**
```json
{
  "type": "status_change",
  "machineId": "cnc-001",
  "data": {
    "status": "maintenance"
  }
}
```

**Event Types:**
- `status_change` - Machine status is veranderd
- `job_start` - Nieuwe job is gestart
- `job_complete` - Job is voltooid
- `alert` - Machine alert/waarschuwing

**Response:**
```json
{
  "success": true,
  "message": "Event ontvangen",
  "timestamp": "2025-10-14T12:00:00Z"
}
```

## Webhook Events

### Status Change Event
```json
{
  "type": "status_change",
  "machineId": "cnc-001",
  "data": {
    "status": "running"
  }
}
```

### Job Start Event
```json
{
  "type": "job_start",
  "machineId": "cnc-001",
  "data": {
    "jobId": "Job-2025-042",
    "estimatedDuration": 3.5
  }
}
```

### Job Complete Event
```json
{
  "type": "job_complete",
  "machineId": "cnc-001",
  "data": {
    "jobId": "Job-2025-042",
    "duration": 3.2,
    "success": true
  }
}
```

### Alert Event
```json
{
  "type": "alert",
  "machineId": "cnc-001",
  "data": {
    "level": "warning",
    "message": "Temperatuur boven limiet",
    "value": 85
  }
}
```

## Error Codes

| Status Code | Betekenis |
|-------------|-----------|
| 200 | OK - Succesvol |
| 201 | Created - Resource aangemaakt |
| 400 | Bad Request - Ongeldige input |
| 404 | Not Found - Resource niet gevonden |
| 409 | Conflict - Resource bestaat al |
| 500 | Internal Server Error - Server fout |

## Voorbeelden

### Machine Status Ophalen (cURL)
```bash
curl http://localhost:3001/api/machines/cnc-001
```

### Machine Toevoegen (cURL)
```bash
curl -X POST http://localhost:3001/api/machines \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cnc-004",
    "name": "CNC Machine 4",
    "status": "idle"
  }'
```

### Machine Bijwerken (cURL)
```bash
curl -X PUT http://localhost:3001/api/machines/cnc-001 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "maintenance"
  }'
```

### Webhook Event Versturen (cURL)
```bash
curl -X POST http://localhost:3001/webhook/machine-event \
  -H "Content-Type: application/json" \
  -d '{
    "type": "job_start",
    "machineId": "cnc-001",
    "data": {
      "jobId": "Job-2025-042"
    }
  }'
```

### JavaScript/Node.js Voorbeeld
```javascript
const axios = require('axios');

// Machine status ophalen
async function getMachineStatus(machineId) {
  const response = await axios.get(
    `http://localhost:3001/api/machines/${machineId}`
  );
  return response.data.machine;
}

// Machine status updaten
async function updateMachineStatus(machineId, status) {
  const response = await axios.put(
    `http://localhost:3001/api/machines/${machineId}`,
    { status }
  );
  return response.data.machine;
}

// Gebruik
getMachineStatus('cnc-001')
  .then(machine => console.log('Machine:', machine))
  .catch(err => console.error('Error:', err));
```
