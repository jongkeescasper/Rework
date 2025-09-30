# Rework vPlan Integration Server

Node.js webhook server that automatically synchronizes Rework leave requests with vPlan planning.

## Quick Setup

### 1. Environment Variables


### Optional
PORT=3000
```

### 2. Dependencies

```bash
npm install
```

Required packages:
- express ^4.18.2
- axios ^1.6.2
- dotenv ^16.3.1
- body-parser ^1.20.2

### 3. Run Server

```bash
npm start
```

Server will be available at `http://localhost:3000`

## Deployment

### Render (Current Production)

1. Connect GitHub repository
2. Set environment variables in Render dashboard
3. Deploy automatically on git push

### Other Platforms

Works on any Node.js hosting platform:
- Heroku
- Railway
- DigitalOcean App Platform
- AWS Elastic Beanstalk
- Vercel

## Webhook Configuration

Configure webhook in Rework:
- URL: `https://your-domain.com/webhook/rework`
- Events: `request_created`, `request_updated`, `request_destroyed`

## API Endpoints

### Core Endpoints

- `POST /webhook/rework` - Webhook receiver
- `GET /` - Health check
- `GET /import/auto-fetch` - Import approved requests from Rework
- `POST /import/approved-requests` - Manual import via JSON

### Roster Import

- `GET /import/company-days` - Import company holidays
- `GET /import/schedules` - Import individual schedules (roster-free days)

## How It Works

1. **Approved Leave Request**: Rework sends webhook when status changes to "ok"
2. **Resource Matching**: Server finds corresponding vPlan resource by name
3. **Schedule Deviation**: Creates absence in vPlan for each day
4. **Deletion**: Automatically removes vPlan absences when request is deleted

## Technical Details

- **Framework**: Express.js
- **Async Processing**: Webhooks respond immediately, process in background
- **External References**: Uses `rework_{request_id}_{date}` pattern for duplicate prevention
- **Resource Matching**: Smart name matching with split-name logic for variations
- **Time Conversion**: Hours to minutes (8.25h = 495min)

## File Structure

```
├── server.js          # Main application
├── package.json       # Dependencies
├── .env               # Environment variables (local)
└── README.md          # Documentation
```

## Troubleshooting

### Common Issues

- **401 Unauthorized**: Check API tokens
- **Resource not found**: Verify user names match between Rework and vPlan
- **422 Validation Error**: Check date formats and required fields
- **Webhook timeout**: Server responds immediately to prevent timeouts

### Logs

Monitor application logs for debugging:
- Webhook events
- API responses
- Resource matching
- Error details

## Support

- Current production: https://rework-kiaa.onrender.com
- GitHub repository: https://github.com/jongkeescasper/Rework
- Server status endpoint: `GET /` returns JSON with status and timestamp