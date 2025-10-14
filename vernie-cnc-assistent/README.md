# 🔧 Vernie CNC Assistent

Een intelligente assistent voor CNC machineoperaties en productieondersteuning.

## 📋 Overzicht

De Vernie CNC Assistent is een Node.js applicatie die helpt bij het beheren en ondersteunen van CNC machineoperaties. De assistent biedt functies voor:

- 📊 Machine status monitoring
- 📝 Productie planning ondersteuning
- 🔔 Meldingen en alerts
- 📈 Rapportage en logging
- 🤖 Geautomatiseerde workflows

## 🚀 Functionaliteiten

### Huidige Features
- REST API endpoints voor machine interactie
- Webhook ondersteuning voor real-time updates
- Status dashboard
- Logging en monitoring

### Geplande Features
- Machine data analytics
- Automatische foutdetectie
- Integratie met productiesystemen
- Maintenance scheduling

## 🔧 Installatie & Setup

### Vereisten
- Node.js (versie 16 of hoger)
- npm of yarn

### Lokale Ontwikkeling

```bash
# Clone repository
git clone https://github.com/jongkeescasper/Rework.git
cd Rework/vernie-cnc-assistent

# Installeer dependencies
npm install

# Kopieer en configureer environment variables
cp .env.example .env

# Start de server
npm start
```

De server draait standaard op `http://localhost:3001`

## ⚙️ Configuratie

Maak een `.env` bestand aan met de volgende variabelen:

```bash
# Server configuratie
PORT=3001
NODE_ENV=development

# API configuratie
API_TOKEN=your_api_token_here

# Database (optioneel)
# DATABASE_URL=your_database_url

# Logging
LOG_LEVEL=info
```

## 📋 API Endpoints

### Health Check
```
GET /
```
Controleert of de server actief is.

**Response:**
```json
{
  "message": "Vernie CNC Assistent",
  "status": "active",
  "timestamp": "2025-10-14T12:00:00Z"
}
```

### Machine Status
```
GET /api/machines
```
Haalt de status van alle machines op.

### Machine Details
```
GET /api/machines/:id
```
Haalt details van een specifieke machine op.

### Webhook Endpoint
```
POST /webhook/machine-event
```
Ontvangt machine events voor real-time processing.

## 🏗️ Project Structuur

```
vernie-cnc-assistent/
├── server.js           # Main application
├── package.json        # Dependencies
├── .env.example        # Environment template
├── .gitignore         # Git ignore rules
├── README.md          # This file
└── docs/              # Additional documentation
```

## 🚀 Deployment

### Render
1. Verbind je GitHub repository met Render
2. Configureer de environment variables
3. Deploy automatisch bij elke push naar `main`

### Andere platforms
De applicatie kan draaien op:
- Heroku
- Railway
- DigitalOcean App Platform
- AWS Elastic Beanstalk
- Vercel

## 📊 Monitoring & Logging

De applicatie logt belangrijke events naar de console:
- Inkomende requests
- Machine status updates
- Fouten en warnings
- API calls

## 🛡️ Error Handling

De applicatie bevat robuuste error handling:
- Automatische retry logic
- Gestructureerde error responses
- Detailed logging voor debugging

## 🤝 Bijdragen

Bijdragen zijn welkom! Om bij te dragen:

1. Fork de repository
2. Maak een feature branch (`git checkout -b feature/nieuwe-functie`)
3. Commit je wijzigingen (`git commit -m 'Voeg nieuwe functie toe'`)
4. Push naar de branch (`git push origin feature/nieuwe-functie`)
5. Open een Pull Request

## 📝 Licentie

Dit project is gelicenseerd onder de MIT License.

## 📞 Support & Contact

**Issues?** Maak een GitHub issue aan of neem contact op met het ontwikkelteam.

**Versie:** 1.0.0
**Laatste Update:** Oktober 2025
