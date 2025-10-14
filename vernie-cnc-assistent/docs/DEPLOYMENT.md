# 🚀 Deployment Handleiding - Vernie CNC Assistent

## Inhoudsopgave
- [Render Deployment](#render-deployment)
- [Heroku Deployment](#heroku-deployment)
- [Docker Deployment](#docker-deployment)
- [DigitalOcean App Platform](#digitalocean-app-platform)
- [Productie Configuratie](#productie-configuratie)

## Render Deployment

### Stap 1: Repository Koppelen
1. Log in op [Render Dashboard](https://dashboard.render.com/)
2. Klik op "New +" → "Web Service"
3. Verbind je GitHub repository
4. Selecteer de `vernie-cnc-assistent` directory

### Stap 2: Configuratie
```yaml
Name: vernie-cnc-assistent
Environment: Node
Region: Frankfurt (EU Central)
Branch: main
Build Command: npm install
Start Command: npm start
```

### Stap 3: Environment Variables
Voeg de volgende environment variables toe:
```
PORT=3001
NODE_ENV=production
API_TOKEN=your_production_api_token
LOG_LEVEL=info
```

### Stap 4: Deploy
- Klik op "Create Web Service"
- Render zal automatisch je applicatie bouwen en deployen
- URL: `https://vernie-cnc-assistent.onrender.com`

### Auto-Deploy
Bij elke push naar de `main` branch wordt automatisch gedeployed.

---

## Heroku Deployment

### Voorbereiden
```bash
# Installeer Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Log in
heroku login

# Maak nieuwe app
heroku create vernie-cnc-assistent
```

### Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set API_TOKEN=your_production_api_token
heroku config:set LOG_LEVEL=info
```

### Deploy
```bash
# Push naar Heroku
git push heroku main

# Open applicatie
heroku open

# Bekijk logs
heroku logs --tail
```

---

## Docker Deployment

### Dockerfile
Maak een `Dockerfile` in de `vernie-cnc-assistent` directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

### Docker Compose
Maak een `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - API_TOKEN=${API_TOKEN}
      - LOG_LEVEL=info
    restart: unless-stopped
```

### Bouwen en Draaien
```bash
# Build image
docker build -t vernie-cnc-assistent .

# Run container
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e API_TOKEN=your_token \
  vernie-cnc-assistent

# Of met docker-compose
docker-compose up -d
```

---

## DigitalOcean App Platform

### Via Dashboard
1. Log in op [DigitalOcean](https://cloud.digitalocean.com/)
2. Klik op "Create" → "Apps"
3. Verbind je GitHub repository
4. Selecteer branch en directory
5. Configureer:
   ```
   Build Command: npm install
   Run Command: npm start
   HTTP Port: 3001
   ```
6. Voeg environment variables toe
7. Klik op "Create Resources"

### Via CLI
```bash
# Installeer doctl
# https://docs.digitalocean.com/reference/doctl/

# Authenticeer
doctl auth init

# Deploy
doctl apps create --spec app.yaml
```

**app.yaml:**
```yaml
name: vernie-cnc-assistent
services:
- name: web
  github:
    repo: jongkeescasper/Rework
    branch: main
  build_command: cd vernie-cnc-assistent && npm install
  run_command: cd vernie-cnc-assistent && npm start
  envs:
  - key: NODE_ENV
    value: production
  - key: API_TOKEN
    value: ${API_TOKEN}
  http_port: 3001
```

---

## Productie Configuratie

### Security Best Practices

1. **Environment Variables**
   - Gebruik nooit hardcoded secrets
   - Gebruik sterke, unieke API tokens
   - Roteer tokens regelmatig

2. **HTTPS**
   - Gebruik altijd HTTPS in productie
   - De meeste hosting platforms bieden gratis SSL certificaten

3. **Rate Limiting**
   Voeg toe aan `server.js`:
   ```javascript
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minuten
     max: 100 // max 100 requests per window
   });
   
   app.use('/api/', limiter);
   ```

4. **Authentication**
   Implementeer API token verificatie:
   ```javascript
   function authenticateToken(req, res, next) {
     const token = req.headers['authorization']?.split(' ')[1];
     
     if (!token || token !== process.env.API_TOKEN) {
       return res.status(401).json({ 
         success: false, 
         error: 'Unauthorized' 
       });
     }
     
     next();
   }
   
   // Gebruik op protected routes
   app.get('/api/machines', authenticateToken, (req, res) => {
     // ...
   });
   ```

### Monitoring

1. **Logging**
   - Gebruik structured logging in productie
   - Implementeer log aggregation (bijv. Papertrail, Loggly)

2. **Health Checks**
   - Monitor de `/` endpoint
   - Stel alerts in bij downtime

3. **Performance Monitoring**
   - Gebruik APM tools zoals New Relic of Datadog
   - Monitor response times en error rates

### Scaling

Voor horizontale scaling:
- Gebruik een load balancer
- Implementeer database voor gedeelde state
- Gebruik Redis voor caching

### Database Integratie

Voor persistente data storage:

```javascript
// Voorbeeld met PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Query machine data
async function getMachines() {
  const result = await pool.query('SELECT * FROM machines');
  return result.rows;
}
```

---

## Troubleshooting

### Veelvoorkomende Problemen

1. **Port Conflict**
   ```bash
   # Check welke process port gebruikt
   lsof -i :3001
   
   # Kill process
   kill -9 <PID>
   ```

2. **Environment Variables niet geladen**
   - Controleer of `.env` file bestaat (lokaal)
   - Verificeer platform environment variables (productie)

3. **Build Fails**
   - Controleer Node.js versie compatibility
   - Verificeer alle dependencies in `package.json`

4. **Memory Issues**
   - Verhoog memory limiet in hosting platform
   - Optimaliseer code voor memory gebruik

### Support
Voor deployment vragen, maak een GitHub issue aan of neem contact op met het team.
