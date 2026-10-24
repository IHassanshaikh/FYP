#ifndef DASHBOARD_H
#define DASHBOARD_H

const char DASHBOARD_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VectorBat ESP32-S3 Hardware Monitor</title>
  <style>
    :root {
      --bg: #0B0F19;
      --card: #151D2F;
      --border: #232E47;
      --primary: #38BDF8;
      --accent: #22C55E;
      --danger: #EF4444;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .container { max-width: 800px; width: 100%; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .title { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: 1px; }
    .title span { color: var(--primary); }
    .badge {
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-ok { background: rgba(34, 197, 94, 0.2); color: var(--accent); border: 1px solid var(--accent); }
    .badge-err { background: rgba(239, 68, 68, 0.2); color: var(--danger); border: 1px solid var(--danger); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
    }
    .card-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
    .card-val { font-size: 32px; font-weight: 800; font-family: monospace; color: #fff; }
    .card-val.accent { color: var(--accent); }
    .card-val.primary { color: var(--primary); }
    .terminal {
      background: #060911;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      font-family: monospace;
      font-size: 13px;
      height: 200px;
      overflow-y: auto;
      color: #A3E635;
    }
    .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .indicator { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
    .ind-ok { background: #22C55E; box-shadow: 0 0 8px #22C55E; }
    .ind-fail { background: #EF4444; box-shadow: 0 0 8px #EF4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">VECTOR<span>BAT</span> TELEMETRY</div>
      <div id="wsBadge" class="badge badge-err">Connecting WS...</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-label">ADXL375 Accel (Z)</div>
        <div id="accelZ" class="card-val primary">0.00 G</div>
        <div class="row" style="margin-top: 8px; font-size: 12px; color: #94A3B8;">
          <span>X: <span id="accelX" style="color: #fff;">0.00</span> G</span>
          <span>Y: <span id="accelY" style="color: #fff;">0.00</span> G</span>
        </div>
      </div>

      <div class="card">
        <div class="card-label">BNO085 Angles</div>
        <div id="rollVal" class="card-val accent">0.0°</div>
        <div class="row" style="margin-top: 8px; font-size: 12px; color: #94A3B8;">
          <span>Pitch: <span id="pitchVal" style="color: #fff;">0.0°</span></span>
          <span>Yaw: <span id="yawVal" style="color: #fff;">0.0°</span></span>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Hardware Health</div>
        <div style="margin-top: 8px; font-size: 14px;">
          <div class="row"><span>ADXL375 CS(10)</span><span id="adxlStat"><span class="indicator ind-fail"></span>INIT</span></div>
          <div class="row"><span>BNO085 CS(5)</span><span id="bnoStat"><span class="indicator ind-fail"></span>INIT</span></div>
          <div class="row"><span>WiFi Signal</span><span id="rssiVal">-- dBm</span></div>
        </div>
      </div>
    </div>

    <div class="card-label">Live Packet Stream (50 Hz WebSocket)</div>
    <div id="term" class="terminal">Awaiting live sensor broadcast on ws://IP:81...</div>
  </div>

  <script>
    const term = document.getElementById('term');
    const wsBadge = document.getElementById('wsBadge');
    const wsUrl = 'ws://' + window.location.hostname + ':81';
    let packetCount = 0;

    function logMsg(msg) {
      const line = document.createElement('div');
      line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      term.appendChild(line);
      term.scrollTop = term.scrollHeight;
      if (term.childNodes.length > 50) term.removeChild(term.firstChild);
    }

    function initWebSocket() {
      logMsg('Connecting to WebSocket at ' + wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wsBadge.textContent = 'WS LIVE (PORT 81)';
        wsBadge.className = 'badge badge-ok';
        logMsg('WebSocket connected to ESP32!');
      };

      ws.onmessage = (evt) => {
        packetCount++;
        try {
          const d = JSON.parse(evt.data);
          if (d.type === 'welcome') {
            logMsg('ESP32 Status: ADXL=' + (d.adxl ? 'OK' : 'FAIL') + ', BNO=' + (d.bno ? 'OK' : 'FAIL'));
            return;
          }
          if (d.ax !== undefined) {
            document.getElementById('accelX').textContent = Number(d.ax).toFixed(2);
            document.getElementById('accelY').textContent = Number(d.ay).toFixed(2);
            document.getElementById('accelZ').textContent = Number(d.az).toFixed(2) + ' G';
            document.getElementById('rollVal').textContent = Number(d.roll).toFixed(1) + '°';
            document.getElementById('pitchVal').textContent = Number(d.pitch).toFixed(1) + '°';
            document.getElementById('yawVal').textContent = Number(d.yaw).toFixed(1) + '°';
            document.getElementById('adxlStat').innerHTML = d.adxl ? '<span class="indicator ind-ok"></span>OK' : '<span class="indicator ind-fail"></span>FAIL';
            document.getElementById('bnoStat').innerHTML = d.bno ? '<span class="indicator ind-ok"></span>OK' : '<span class="indicator ind-fail"></span>FAIL';
            document.getElementById('rssiVal').textContent = d.rssi + ' dBm';

            if (packetCount % 50 === 0) {
              logMsg(`Packet #${packetCount} | Accel: (${Number(d.ax).toFixed(2)}, ${Number(d.ay).toFixed(2)}, ${Number(d.az).toFixed(2)}) G | R:${Number(d.roll).toFixed(1)}° P:${Number(d.pitch).toFixed(1)}° Y:${Number(d.yaw).toFixed(1)}°`);
            }
          }
        } catch(e) {
          logMsg('Raw: ' + evt.data);
        }
      };

      ws.onclose = () => {
        wsBadge.textContent = 'DISCONNECTED';
        wsBadge.className = 'badge badge-err';
        logMsg('WebSocket closed. Retrying in 2 seconds...');
        setTimeout(initWebSocket, 2000);
      };

      ws.onerror = (e) => {
        wsBadge.textContent = 'WS ERROR';
        wsBadge.className = 'badge badge-err';
      };
    }

    window.onload = initWebSocket;
  </script>
</body>
</html>
)rawliteral";

#endif
