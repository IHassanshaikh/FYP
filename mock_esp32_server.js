// mock_esp32_server.js
// A lightweight Node.js WebSocket server that emulates the ESP32 SmartBat hardware.
// Use this to test the app's hardware connection without a physical ESP32!
// Run with: node mock_esp32_server.js

const WebSocket = require('ws');

const PORT = 81;
const wss = new WebSocket.Server({ port: PORT });

console.log(`===============================================`);
console.log(`[Mock ESP32] Hardware Server listening on ws://0.0.0.0:${PORT}/`);
console.log(`[Mock ESP32] Ready for VectorBat mobile app connection.`);
console.log(`===============================================`);

let clientCount = 0;

wss.on('connection', (ws, req) => {
  clientCount++;
  const clientIp = req.socket.remoteAddress;
  console.log(`[Mock ESP32] New client connected from ${clientIp}. Total active: ${clientCount}`);

  // Send ESP32 status header
  ws.send('[ESP32 SmartBat v1.2 Active - BNO085 + ADXL375 OK]');

  let angle = 0;
  let swingTick = 0;
  let isSwinging = false;

  // Stream telemetry at 50Hz (every 20ms)
  const interval = setInterval(() => {
    if (ws.readyState !== ws.OPEN) {
      clearInterval(interval);
      return;
    }

    angle += 0.05;
    swingTick++;

    // Every ~150 ticks (3 seconds), simulate a realistic bat swing
    if (swingTick % 150 === 0) {
      isSwinging = true;
      console.log(`[Mock ESP32] >>> Simulating Physical Bat Swing (Peak Impact Force)!`);
    }

    let ax, ay, az, pitch, roll, yaw;

    if (isSwinging) {
      // High acceleration during swing stroke
      ax = (Math.random() * 2 + 3.2).toFixed(2);
      ay = (Math.random() * 2 + 1.8).toFixed(2);
      az = (Math.random() * 5 + 14.2).toFixed(2);
      roll = (Math.sin(angle) * 35 + 20).toFixed(1);
      pitch = (Math.cos(angle) * 45 + 55).toFixed(1);
      yaw = (Math.sin(angle * 0.5) * 25).toFixed(1);

      // Finish swing after a brief burst
      if (swingTick % 150 > 15) {
        isSwinging = false;
      }
    } else {
      // Normal idle bat stance
      ax = (Math.random() * 0.2 - 0.1).toFixed(2);
      ay = (Math.random() * 0.2 - 0.1).toFixed(2);
      az = (9.81 + Math.random() * 0.15 - 0.07).toFixed(2);
      roll = (Math.sin(angle * 0.5) * 3).toFixed(1);
      pitch = (45.0 + Math.cos(angle * 0.5) * 2).toFixed(1);
      yaw = (0.0).toFixed(1);
    }

    const payload = JSON.stringify({
      ax: parseFloat(ax),
      ay: parseFloat(ay),
      az: parseFloat(az),
      roll: parseFloat(roll),
      pitch: parseFloat(pitch),
      yaw: parseFloat(yaw),
      timestamp: Date.now(),
    });

    ws.send(payload);
  }, 20); // 50 Hz

  ws.on('close', () => {
    clientCount--;
    clearInterval(interval);
    console.log(`[Mock ESP32] Client disconnected. Remaining: ${clientCount}`);
  });

  ws.on('error', (err) => {
    console.error(`[Mock ESP32] WebSocket error:`, err);
  });
});
