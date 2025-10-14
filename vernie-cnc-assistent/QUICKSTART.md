# 🎯 Quick Start Guide - Vernie CNC Assistent

## 🚀 In 5 minuten aan de slag

### Stap 1: Installatie
```bash
cd vernie-cnc-assistent
npm install
```

### Stap 2: Configuratie
```bash
cp .env.example .env
# Bewerk .env en pas de instellingen aan
```

### Stap 3: Start de applicatie
```bash
npm start
```

De server draait nu op **http://localhost:3001**

---

## ✅ Test de applicatie

### Health Check
```bash
curl http://localhost:3001/
```

**Response:**
```json
{
  "message": "Vernie CNC Assistent",
  "status": "active",
  "timestamp": "2025-10-14T12:00:00Z",
  "version": "1.0.0"
}
```

### Machines ophalen
```bash
curl http://localhost:3001/api/machines
```

### Statistieken ophalen
```bash
curl http://localhost:3001/api/stats
```

---

## 📋 Veelgebruikte Acties

### Machine status wijzigen
```bash
curl -X PUT http://localhost:3001/api/machines/cnc-001 \
  -H "Content-Type: application/json" \
  -d '{"status": "maintenance"}'
```

### Nieuwe machine toevoegen
```bash
curl -X POST http://localhost:3001/api/machines \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cnc-004",
    "name": "CNC Machine 4",
    "status": "idle"
  }'
```

### Machine event versturen
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

---

## 📚 Meer Informatie

- **[README.md](README.md)** - Volledige project documentatie
- **[docs/API.md](docs/API.md)** - Gedetailleerde API documentatie
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment handleiding

---

## 🐛 Problemen?

### Server start niet
- Controleer of poort 3001 vrij is
- Verificeer Node.js versie (>= 16.0.0)

### API geeft errors
- Check of .env correct geconfigureerd is
- Bekijk server logs voor details

### Meer hulp nodig?
Maak een GitHub issue aan of bekijk de [volledige documentatie](README.md).
