const net = require('net');
const WebSocket = require('ws');

// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { PORT, HOST } = process.env;

function openConnection(id) {
    const tcpOpen = performance.now();
    console.log(`${getCurrentDateTime()}: ${id} open ws req`);

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;
    const ws = new WebSocket(HOST, {
        rejectUnauthorized: true,
        handshakeTimeout: 2500,
        perMessageDeflate: false,
        maxPayload: 64 * 1024,
        skipUTF8Validation: false,
        headers: {
            'x-websocket-id': id,
            'sec-websocket-version': '13'
        }
    });

    console.log(ws);

    ws.on('upgrade', (res) => {
        ws.cfRay = res.headers['cf-ray'] || `cfRay-${id}`,
        ws.cfColoId = res.headers['x-cloudflare-colo'] || '0',
        ws.cfMetalId = res.headers['x-cloudflare-metal'] || '0'
    });

    ws.on('open', () => {
        console.log(`${getCurrentDateTime()}: ${id} websocket connected, cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId}, time=${Math.round(performance.now() - tcpOpen)}ms`);
        buffer.forEach((b) => {
            ws.send(b);
        });
        heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(Buffer.from('ping').toString('utf8'));
            }
        }, 5000)
        buffer = null;
    });

    ws.on('message', (data) => {
        if (data.toString() === 'ping') {
            return;
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket closed: code=${code}, reason=${reason}, cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId}`);
        clearInterval(heartbeatInterval);
    });

    ws.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket error ${err}`);
    });
}

for (var i = 0; i < 100; i++) {
    const id = generateRandomCharacters(6);
    openConnection(id);
}

function getCurrentDateTime() {
    const now = new Date();

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // +1 because months are 0-based in JavaScript
    const year = now.getFullYear();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function generateRandomCharacters(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomChars = '';
  
    while (randomChars.length < length) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomChars += characters.charAt(randomIndex);
    }
  
    return randomChars;
}