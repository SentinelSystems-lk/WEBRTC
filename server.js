const express = require('express');
const https = require('https');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Import certificates (will generate if not exists)
const certificates = require('./generate-cert');

const app = express();

// Create HTTPS server
const server = https.createServer({
  key: certificates.key,
  cert: certificates.cert
}, app);

// Create HTTP server for redirecting to HTTPS
const httpServer = http.createServer((req, res) => {
  // Get host from request header
  const host = req.headers.host;
  // Redirect to HTTPS
  res.writeHead(301, { "Location": `https://${host}${req.url}` });
  res.end();
});

// Set up Socket.io with HTTPS server
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Add CORS headers for LAN access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve user1.html
app.get('/user1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user1.html'));
});

// Serve user2.html
app.get('/user2', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user2.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Show client IP for debugging
  const clientIP = socket.handshake.address;
  console.log(`Client connected from IP: ${clientIP}`);

  // Handle offer from user1
  socket.on('offer', (offer) => {
    console.log('Received offer, broadcasting to peers');
    socket.broadcast.emit('offer', offer);
  });

  // Handle answer from user2
  socket.on('answer', (answer) => {
    console.log('Received answer, broadcasting to peers');
    socket.broadcast.emit('answer', answer);
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (candidate) => {
    console.log('Received ICE candidate, broadcasting to peers');
    socket.broadcast.emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Ports for HTTP and HTTPS
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Start HTTP server (for redirection)
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP server running on port ${HTTP_PORT} (redirects to HTTPS)`);
});

// Start HTTPS server
server.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`\n=== WebRTC with HTTPS enabled ===\n`);
  console.log(`HTTPS server running on port ${HTTPS_PORT}`);
  
  console.log(`Local access:`);
  console.log(`  User1: https://localhost:${HTTPS_PORT}/user1`);
  console.log(`  User2: https://localhost:${HTTPS_PORT}/user2`);
  
  // Find and display all network interfaces for LAN access
  const networks = os.networkInterfaces();
  console.log('\nLAN access (for other devices on the same network):');
  
  for (const name of Object.keys(networks)) {
    for (const net of networks[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  User1: https://${net.address}:${HTTPS_PORT}/user1`);
        console.log(`  User2: https://${net.address}:${HTTPS_PORT}/user2`);
      }
    }
  }
  
  console.log('\nNOTE: Since we\'re using self-signed certificates,');
  console.log('you will need to accept the security warning in your browser.');
  console.log('This is normal for development environments.');
  console.log('\nImportant: With HTTPS enabled, camera access should now work on all browsers.');
});
