# Rework Webhook Integration

Een Node.js server die webhooks van Rework ontvangt en deze integreert met vPlan voor automatische planning van verlofverzoeken.

## Functionaliteit

Deze webhook server luistert naar events van Rework en voert automatisch acties uit in vPlan:

- **request_created**: Maakt een nieuwe kaart aan in vPlan voor het verlofverzoek
- **request_updated**: Werkt een bestaande kaart bij in vPlan  
- **request_destroyed**: Verwijdert de kaart uit vPlan

## Installatie

1. Clone deze repository:
   ```bash
   git clone https://github.com/jongkeescasper/Rework.git
   cd Rework
   ```

2. Installeer dependencies:
   ```bash
   npm install
   ```

3. Configureer je API tokens:
   - Vervang `jouw-vplan-api-token` in `server.js` met je echte vPlan API token
   - Configureer je Rework webhook URL naar: `https://rework-kiaa.onrender.com/webhook/rework`

4. Start de server:
   ```bash
   npm start
   ```

De server draait standaard op poort 3000, of de poort die gespecificeerd is in de `PORT` environment variabele.

## API Endpoints

- `POST /webhook/rework` - Ontvangt webhook events van Rework

## Dependencies

- **express**: Web framework voor Node.js
- **body-parser**: Middleware voor het parsen van JSON requests
- **axios**: HTTP client voor API calls naar vPlan

## Configuratie

Zorg ervoor dat je de volgende instellingen configureert:

1. **vPlan API Token**: Vervang de placeholder in `server.js`
2. **Webhook URL**: Configureer in Rework de webhook URL naar: `https://rework-kiaa.onrender.com/webhook/rework`
3. **User Mapping**: Implementeer de `findCardIdForRequest` functie voor het koppelen van Rework requests aan vPlan kaarten

## Ontwikkeling

Voor development kun je de server starten met:

```bash
node server.js
```

Voor productie gebruik je waarschijnlijk een process manager zoals PM2 of deploy je naar een cloud platform.

## Deployment

Deze applicatie is momenteel gedeployed op Render en beschikbaar op:
**https://rework-kiaa.onrender.com**

### Webhook URL voor Rework configuratie:
`https://rework-kiaa.onrender.com/webhook/rework`

### Deploy naar Render:
1. Verbind je GitHub repository met Render
2. Zorg ervoor dat de `PORT` environment variabele wordt gebruikt (automatisch door Render)
3. Configureer eventuele andere environment variabelen (zoals API tokens)

## TODO

- [ ] Implementeer database voor request/card mapping
- [ ] Voeg logging toe
- [ ] Voeg error handling toe voor API failures
- [ ] Voeg authenticatie toe voor webhook security
- [ ] Voeg tests toe