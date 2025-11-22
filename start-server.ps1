# PowerShell script to start the server with increased memory
cd pbf-map-router
node --max-old-space-size=8192 --expose-gc src/backend/server.js
