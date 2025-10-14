# 🔗 Rework ↔ vPlan Integration

Een geavanceerde Node.js webhook server die **Rework verlofaanvragen** automatisch synchroniseert met **vPlan planning**. Wanneer verlof wordt goedgekeurd in Rework, verschijnt het direct als afwezigheid in de juiste persoon's vPlan planning.

---

## 📦 Repository Projecten

Deze repository bevat twee applicaties:

### 1. **Rework ↔ vPlan Integration** (hoofddirectory)
Webhook server voor automatische synchronisatie van verlofaanvragen tussen Rework en vPlan.

### 2. **Vernie CNC Assistent** ([`/vernie-cnc-assistent`](vernie-cnc-assistent/))
Een intelligente assistent voor CNC machineoperaties en productieondersteuning. Zie [Vernie CNC Assistent README](vernie-cnc-assistent/README.md) voor meer informatie.

---

## 🎯 Wat doet deze integratie?

Deze server luistert naar Rework webhook events en voert automatisch acties uit in vPlan:

### ✅ **Bij Goedkeuring (`request_updated` met status `"ok"`)**
- Maakt **Schedule Deviations** (afwezigheden) aan in vPlan
- Voor **elke dag** een aparte afwezigheid met juiste aantal uren
- Koppelt automatisch aan de **juiste resource** (gebruiker)
- Gebruikt **exacte uren** uit Rework slots (8.25 uur → 495 minuten)

### 🗑️ **Bij Verwijdering (`request_destroyed`)**  
- Zoekt alle gerelateerde Schedule Deviations via `external_ref`
- Verwijdert automatisch alle afwezigheden voor die aanvraag
- Werkt met meerdaagse periodes

### 📝 **Bij Aanmaken (`request_created`)**
- Logt de aanvraag voor transparantie
- **Geen vPlan actie** - wacht op goedkeuring

## 🚀 Live Server

**Productie URL:** https://rework-kiaa.onrender.com

**Health Check:** https://rework-kiaa.onrender.com/
```json
{
  "message": "Rework vPlan Webhook Integration", 
  "status": "active",
  "timestamp": "2025-09-24T10:55:00Z"
}
```

## 📋 API Endpoints

### 1. **Webhook Endpoint** 
```
POST /webhook/rework
```
- **Doel:** Ontvangt Rework webhook events
- **Configureer in Rework:** `https://rework-kiaa.onrender.com/webhook/rework`
- **Events:** `request_created`, `request_updated`, `request_destroyed`

### 2. **Handmatige Import**
```
POST /import/approved-requests
```
- **Doel:** Import via JSON body met array van requests
- **Gebruik:** Voor eenmalige bulk import
- **Validatie:** Checkt duplicaten via `external_ref`

### 3. **Automatisch Ophalen** ⭐
```
GET /import/auto-fetch[?parameters]
```
**Haalt goedgekeurde verlofaanvragen op uit Rework API en importeert ze direct naar vPlan.**

#### Query Parameters:
| Parameter | Voorbeeld | Beschrijving |
|-----------|-----------|--------------|
| `from_date` | `2025-01-01` | Start datum (YYYY-MM-DD) |
| `to_date` | `2025-12-31` | Eind datum (YYYY-MM-DD) |  
| `user_id` | `66820` | Specifieke Rework gebruiker ID |
| `per_page` | `50` | Aantal requests per pagina (max 100) |
| `page` | `2` | Pagina nummer |

#### Voorbeelden:
```bash
# Alle toekomstige goedgekeurde verlof
GET /import/auto-fetch?from_date=2025-10-01&to_date=2025-12-31

# Historisch verlof van dit jaar  
GET /import/auto-fetch?from_date=2025-01-01&to_date=2025-09-01

# Alleen Marcel's verlof
GET /import/auto-fetch?user_id=66820

# Test met kleine batch
GET /import/auto-fetch?per_page=10&from_date=2025-09-01
```

### 4. **Company Days Import** 🎄
```
GET /import/company-days[?parameters]
```
**Importeert bedrijfsvrije dagen (feestdagen) voor alle medewerkers uit Rework.**

#### Query Parameters:
| Parameter | Voorbeeld | Beschrijving |
|-----------|-----------|--------------|
| `year` | `2025` | Specifiek jaar (standaard: huidig jaar) |
| `since` | `2025-01-01` | Start datum (alternatief voor year) |
| `until` | `2025-12-31` | Eind datum (alternatief voor year) |

#### Voorbeelden:
```bash
# Alle feestdagen van 2025
GET /import/company-days?year=2025

# Feestdagen in periode
GET /import/company-days?since=2025-10-01&until=2025-12-31
```

**Wat het doet:**
- Haalt alle `day_off: true` dagen op uit Rework
- Maakt Schedule Deviations aan voor **alle vPlan resources**  
- Type: `"holiday"` met beschrijving zoals "Kerstmis - Bedrijfsvrije dag"
- Duplicate check: voorkomt overschrijven van bestaande afwezigheid

### 5. **Individual Schedules Import** 📅
```
GET /import/schedules?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD[&parameters]
```
**Analyseert individuele roosters en maakt "roostervrij" dagen aan voor elke medewerker.**

#### Query Parameters (verplicht):
| Parameter | Voorbeeld | Beschrijving |
|-----------|-----------|--------------|
| `from_date` | `2025-10-01` | **Verplicht** - Start datum analyse |
| `to_date` | `2025-10-31` | **Verplicht** - Eind datum analyse |
| `user_id` | `66820` | Optioneel - Specifieke gebruiker |

#### Voorbeelden:  
```bash
# Alle roosters voor oktober
GET /import/schedules?from_date=2025-10-01&to_date=2025-10-31

# Alleen Marcel's rooster
GET /import/schedules?from_date=2025-10-01&to_date=2025-10-31&user_id=66820

# Volledig kwartaal
GET /import/schedules?from_date=2025-10-01&to_date=2025-12-31
```

**Wat het doet:**
- Haalt schedules op uit Rework per gebruiker
- Analyseert `workhours` arrays: `[8,8,0,8,8,0,0]` → woensdag = 0 uur = roostervrij
- Respecteert wisselende roosters (meerdere `workhours` patronen)  
- Maakt Schedule Deviations type `"leave"` voor dagen met 0 werkuren (8u standaard)
- Beschrijving: `"Roostervrij - [Gebruikersnaam]"`
- Duplicate check: voorkomt overschrijven van bestaande afwezigheid

### Optioneel
```bash
PORT=3000  # Server poort (Render zet dit automatisch)
```

## 📊 Technische Details

### vPlan Schedule Deviations
- **Endpoint:** `POST /resource/{resource_id}/schedule_deviation/`
- **Type:** `"leave"` (absence type)
- **Time:** Uren × 60 (wordt omgezet naar minuten)
- **External Ref:** `rework_{request_id}_{date}` (voor duplicate checking)

### Resource Matching
De server zoekt automatisch de juiste vPlan resource op naam met verbeterde matching:
```javascript
// Verbeterde naammatching ondersteunt variaties zoals:
// "Marcel Maasmann" in Rework → Marcel Maasmann resource in vPlan
// "Remco Prinsen" in Rework → Remco Prins resource in vPlan

const matchingResource = resources.find(resource => {
  const resourceName = resource.name?.toLowerCase() || '';
  const searchName = userName.toLowerCase();
  
  // Exacte match
  if (resourceName === searchName) return true;
  
  // Bevat match (beide kanten)  
  if (resourceName.includes(searchName) || searchName.includes(resourceName)) return true;
  
  // Split-name matching voor naamvariaties
  const resourceParts = resourceName.split(' ');
  const searchParts = searchName.split(' ');
  
  return searchParts.every(part => 
    resourceParts.some(rPart => rPart.includes(part) || part.includes(rPart))
  );
});
```

### Datum & Tijd Parsing
```javascript
// Tijdzone-safe datum parsing
const dayString = slot.date.split('T')[0]; // "2025-10-01T00:00:00+02:00" → "2025-10-01"

// Uren naar minuten conversie  
const minutes = Math.round(hours * 60); // 8.25 uur → 495 minuten
```

## 🔄 Workflow Example

### Scenario: Marcel vraagt 2 dagen verlof aan

1. **Rework: Aanvraag aanmaken**
   ```
   request_created → Server logt: "Verlofaanvraag aangemaakt, wacht op goedkeuring..."
   ```

2. **Rework: Manager keurt goed** 
   ```
   request_updated (status: "pending" → "ok")
   └── Server haalt resource op: Marcel Maasmann (ID: 10fd315f...)
   └── Voor elke dag:
       ├── 2025-10-01: 8.25 uur → 495 minuten Schedule Deviation  
       └── 2025-10-02: 7.0 uur → 420 minuten Schedule Deviation
   ```

3. **vPlan: Afwezigheid zichtbaar**
   ```
   Marcel's planning toont nu:
   ├── 1 okt: 495 min afwezig (Dokter, tandarts, fysio etc.)
   └── 2 okt: 420 min afwezig (Dokter, tandarts, fysio etc.)
   ```

4. **Rework: Aanvraag verwijderd**
   ```  
   request_destroyed
   └── Server zoekt: external_ref bevat "rework_20865207774319" 
   └── Verwijdert beide Schedule Deviations
   └── vPlan: Afwezigheid verdwijnt uit planning
   ```

## 🔧 Installation & Setup

### 1. Local Development
```bash
git clone https://github.com/jongkeescasper/Rework.git
cd Rework
npm install
cp .env.example .env  # Configureer je API keys
npm start  # Server draait op http://localhost:3000
```

### 2. Render Deployment (Productie)
1. **GitHub → Render verbinding**
2. **Environment Variables configureren:**
   - `VPLAN_API_TOKEN`
   - `VPLAN_ENV_ID` 
   - `REWORK_API_TOKEN`
   - `REWORK_COMPANY_ID`
3. **Auto-deploy** bij elke git push naar `main`

### 3. Rework Webhook Configuratie
Ga naar Rework → Settings → Integrations → Webhooks:
```
URL: https://rework-kiaa.onrender.com/webhook/rework
Events: ✅ request_created, ✅ request_updated, ✅ request_destroyed  
```

## 📈 Monitoring & Logs

### Real-time Logs (Render)
```bash
# Render Dashboard → Service → Logs
📥 Rework webhook ontvangen: request_updated
✅ Resource gevonden: Marcel Maasmann (10fd315f-1c81-4d59-a3fc-0419c4ba02f5)
📅 Verwerk dag: 2025-10-01 (8.25 uur)
📤 Verstuur naar vPlan: {"time": 495, "type": "leave", ...}
✅ Afwezigheid voor 2025-10-01 aangemaakt (8.25 uur = 495 minuten)
```

### Import Response Format
```json
{
  "message": "Auto-fetch voltooid",
  "summary": {
    "total_found": 5,
    "imported": 3, 
    "skipped": 1,
    "failed": 1
  },
  "results": [
    {
      "id": 20865207774319,
      "success": true,
      "user": "Marcel Maasmann", 
      "type": "Vakantie",
      "days": 2,
      "dates": ["2025-10-01", "2025-10-02"]
    }
  ]
}
```

## 🛡️ Error Handling & Recovery

### Duplicate Prevention
```javascript
// Checks via external_ref pattern
external_ref: `rework_${request_id}_${date}`
// Bijvoorbeeld: "rework_20865207774319_2025-10-01"
```

### API Rate Limiting
- **Rework:** 150 requests per 5 minuten
- **vPlan:** Standaard rate limiting
- **Strategy:** Respecteer `Retry-After` headers

### Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Resource niet gevonden | `❌ Geen resource gevonden voor "Marcel Maasmann"` | Check spelling naam, voeg resource toe in vPlan |
| API Auth fout | `401 Unauthorized` | Check API tokens in environment variables |
| Tijdzone probleem | Verkeerde datums | Server gebruikt directe string parsing `slot.date.split('T')[0]` |
| Decimale uren | "8 minuten ipv 8 uur" | Server converteert: `hours * 60` voor vPlan API |
| 422 Roster errors | `Request failed with status code 422` | Controleer of roostervrije dagen niet al bezet zijn |
| Naamverschillen | "Remco Prinsen" vs "Remco Prins" | Server gebruikt verbeterde split-name matching |

## 🔄 Migration & Data Import

### Historische Data Importeren
```bash
# Alles van 2025
curl "https://rework-kiaa.onrender.com/import/auto-fetch?from_date=2025-01-01&to_date=2025-12-31"

# Per kwartaal voor grote datasets  
curl "https://rework-kiaa.onrender.com/import/auto-fetch?from_date=2025-01-01&to_date=2025-03-31&per_page=100"
curl "https://rework-kiaa.onrender.com/import/auto-fetch?from_date=2025-04-01&to_date=2025-06-30&per_page=100"
```

### Bulk Import via JSON
```bash
curl -X POST "https://rework-kiaa.onrender.com/import/approved-requests" \
  -H "Content-Type: application/json" \
  -d '{"requests": [...]}'  # Array met Rework request objecten
```

## 🎯 Dependencies

```json
{
  "express": "^4.18.2",
  "axios": "^1.5.0", 
  "dotenv": "^16.3.1"
}
```

## 📝 Development Roadmap

### ✅ Completed
- [x] Webhook event handling 
- [x] Schedule Deviation creation
- [x] Multi-day period support
- [x] Resource auto-matching with split-name logic
- [x] Duplicate prevention
- [x] Rework API integration
- [x] Auto-fetch endpoint
- [x] Company days import (holidays)
- [x] Individual schedules import (roster-free days)
- [x] Error handling & logging
- [x] Production deployment

### 🔄 Future Enhancements  
- [ ] Database voor persistent request mapping
- [ ] Webhook authentication/security
- [ ] User interface voor import management  
- [ ] Scheduled imports (daily/weekly)
- [ ] Multi-company support
- [ ] Advanced filtering & reporting
- [ ] Unit tests & integration tests

## 📞 Support & Troubleshooting

**Issues?** Check de [live logs in Render Dashboard](https://dashboard.render.com/) of maak een GitHub issue.

**Server Status:** https://rework-kiaa.onrender.com/

**Last Updated:** September 24, 2025
**Version:** 2.1.0 - Full Roster Integration + Enhanced Name Matching