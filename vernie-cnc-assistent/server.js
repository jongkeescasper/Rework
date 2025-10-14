require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(express.json());

// Configuratie
const PORT = process.env.PORT || 3001;
const API_TOKEN = process.env.API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

console.log('🔧 Vernie CNC Assistent wordt opgestart...');
console.log('⚙️  Configuratie:');
console.log('   - Port:', PORT);
console.log('   - API Token:', API_TOKEN ? '✅ Geconfigureerd' : '⚠️  Niet geconfigureerd');
console.log('   - Log Level:', LOG_LEVEL);

// In-memory machine data (voor demo doeleinden)
let machines = [
  {
    id: 'cnc-001',
    name: 'CNC Machine 1',
    status: 'running',
    currentJob: 'Job-2025-001',
    uptime: 8.5,
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'cnc-002',
    name: 'CNC Machine 2',
    status: 'idle',
    currentJob: null,
    uptime: 12.3,
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'cnc-003',
    name: 'CNC Machine 3',
    status: 'maintenance',
    currentJob: null,
    uptime: 0,
    lastUpdate: new Date().toISOString()
  }
];

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Vernie CNC Assistent',
    status: 'active',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API: Haal alle machines op
app.get('/api/machines', (req, res) => {
  console.log('📊 Machines opgevraagd');
  res.json({
    success: true,
    count: machines.length,
    machines: machines
  });
});

// API: Haal specifieke machine op
app.get('/api/machines/:id', (req, res) => {
  const machineId = req.params.id;
  const machine = machines.find(m => m.id === machineId);
  
  if (!machine) {
    console.log(`❌ Machine ${machineId} niet gevonden`);
    return res.status(404).json({
      success: false,
      error: 'Machine niet gevonden',
      machineId: machineId
    });
  }
  
  console.log(`✅ Machine ${machineId} details opgehaald`);
  res.json({
    success: true,
    machine: machine
  });
});

// API: Update machine status
app.put('/api/machines/:id', (req, res) => {
  const machineId = req.params.id;
  const machine = machines.find(m => m.id === machineId);
  
  if (!machine) {
    console.log(`❌ Machine ${machineId} niet gevonden voor update`);
    return res.status(404).json({
      success: false,
      error: 'Machine niet gevonden',
      machineId: machineId
    });
  }
  
  // Update machine eigenschappen
  const updates = req.body;
  if (updates.status) machine.status = updates.status;
  if (updates.currentJob !== undefined) machine.currentJob = updates.currentJob;
  if (updates.uptime !== undefined) machine.uptime = updates.uptime;
  machine.lastUpdate = new Date().toISOString();
  
  console.log(`✅ Machine ${machineId} bijgewerkt:`, updates);
  res.json({
    success: true,
    message: 'Machine bijgewerkt',
    machine: machine
  });
});

// API: Voeg nieuwe machine toe
app.post('/api/machines', (req, res) => {
  const { id, name, status = 'idle' } = req.body;
  
  if (!id || !name) {
    return res.status(400).json({
      success: false,
      error: 'ID en naam zijn verplicht'
    });
  }
  
  // Check of machine al bestaat
  if (machines.find(m => m.id === id)) {
    return res.status(409).json({
      success: false,
      error: 'Machine met dit ID bestaat al'
    });
  }
  
  const newMachine = {
    id,
    name,
    status,
    currentJob: null,
    uptime: 0,
    lastUpdate: new Date().toISOString()
  };
  
  machines.push(newMachine);
  console.log(`✅ Nieuwe machine toegevoegd: ${id} - ${name}`);
  
  res.status(201).json({
    success: true,
    message: 'Machine toegevoegd',
    machine: newMachine
  });
});

// Webhook endpoint voor machine events
app.post('/webhook/machine-event', async (req, res) => {
  try {
    console.log('📥 Machine event webhook ontvangen');
    
    const event = req.body;
    console.log('Event type:', event.type);
    console.log('Event data:', JSON.stringify(event, null, 2));
    
    // Stuur direct 200 OK response
    res.status(200).json({ 
      success: true, 
      message: 'Event ontvangen',
      timestamp: new Date().toISOString()
    });
    
    // Verwerk event asynchroon
    processEventAsync(event);
    
  } catch (err) {
    console.error('❌ Fout in webhook handler:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Webhook processing fout',
        message: err.message
      });
    }
  }
});

// Helper functie voor asynchrone event processing
async function processEventAsync(event) {
  try {
    const { type, machineId, data } = event;
    
    switch(type) {
      case 'status_change':
        await handleStatusChange(machineId, data);
        break;
      case 'job_start':
        await handleJobStart(machineId, data);
        break;
      case 'job_complete':
        await handleJobComplete(machineId, data);
        break;
      case 'alert':
        await handleAlert(machineId, data);
        break;
      default:
        console.log(`⚠️  Onbekend event type: ${type}`);
    }
  } catch (err) {
    console.error('❌ Fout bij verwerken event:', err);
  }
}

async function handleStatusChange(machineId, data) {
  const machine = machines.find(m => m.id === machineId);
  if (machine) {
    machine.status = data.status;
    machine.lastUpdate = new Date().toISOString();
    console.log(`✅ Machine ${machineId} status gewijzigd naar: ${data.status}`);
  }
}

async function handleJobStart(machineId, data) {
  const machine = machines.find(m => m.id === machineId);
  if (machine) {
    machine.currentJob = data.jobId;
    machine.status = 'running';
    machine.lastUpdate = new Date().toISOString();
    console.log(`✅ Machine ${machineId} begint met job: ${data.jobId}`);
  }
}

async function handleJobComplete(machineId, data) {
  const machine = machines.find(m => m.id === machineId);
  if (machine) {
    machine.currentJob = null;
    machine.status = 'idle';
    machine.lastUpdate = new Date().toISOString();
    console.log(`✅ Machine ${machineId} heeft job ${data.jobId} voltooid`);
  }
}

async function handleAlert(machineId, data) {
  console.log(`🚨 Alert voor machine ${machineId}:`, data.message);
  // Hier zou je alerts kunnen versturen via email, SMS, etc.
}

// API: Machine statistieken
app.get('/api/stats', (req, res) => {
  const stats = {
    totalMachines: machines.length,
    running: machines.filter(m => m.status === 'running').length,
    idle: machines.filter(m => m.status === 'idle').length,
    maintenance: machines.filter(m => m.status === 'maintenance').length,
    totalUptime: machines.reduce((sum, m) => sum + m.uptime, 0).toFixed(1),
    timestamp: new Date().toISOString()
  };
  
  console.log('📊 Statistieken opgevraagd:', stats);
  res.json({
    success: true,
    stats: stats
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint niet gevonden',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('✅ Vernie CNC Assistent actief!');
  console.log(`🌐 Server draait op http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Beschikbare endpoints:');
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   GET  http://localhost:${PORT}/api/machines`);
  console.log(`   GET  http://localhost:${PORT}/api/machines/:id`);
  console.log(`   POST http://localhost:${PORT}/api/machines`);
  console.log(`   PUT  http://localhost:${PORT}/api/machines/:id`);
  console.log(`   GET  http://localhost:${PORT}/api/stats`);
  console.log(`   POST http://localhost:${PORT}/webhook/machine-event`);
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM ontvangen, server wordt afgesloten...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT ontvangen, server wordt afgesloten...');
  process.exit(0);
});
