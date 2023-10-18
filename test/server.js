const { createServer } = require('https');
const { readFileSync } = require('fs');
const net = require('net');
const WebSocket = require('ws');

// PORT=3000 HOST=localhost:3000
const { PORT, HOST } = process.env;

const server = createServer({
    cert: readFileSync('../ssl/cert.pem'),
    key: readFileSync('../ssl/privkey.pem')
}, (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({ message: 'OK' }));
});

const wss = new WebSocket.Server({
    server: server,
    perMessageDeflate: false,
    skipUTF8Validation: false,
    maxPayload: 64 * 1024
});

function heartbeat() {
    this.isAlive = true;
}
  
// on WS connect -> open TCP connection
wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    const id = req.headers['x-websocket-id'];
    const forwardedFor = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '8.8.8.8';
    const cfRay = req.headers['cf-ray'] || 'cf-ray';

    let connectionData = {
        id: id,
        cfRay: cfRay
    };

    let buffer = [];
    
    ws.on('pong', heartbeat);

    // init -> debug purposes. get first messages
    let init = true;
    ws.on('message', (data) => {
        connectionData["tcp_write_time"] = getCurrentDateTime();
        connectionData["tcp_write"] = data.length;

        if (init) {
            init = false;
        }

        if (data.toString() === 'ping') {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(Buffer.from('ping').toString('utf8'));
            }
            return;
        }

        // buffer !== null -> tcp not connected YET
        if (buffer !== null) {
            buffer.push(data);
            return;
        }
    });

    ws.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} ws error: ${err}`)
    });

    ws.on('close', (code, reason) => {
        console.log(`${getCurrentDateTime()}: ${id} ws closed: ${code} ${reason}`)
        console.log(JSON.stringify(connectionData))
        delete connectionData;
    });
});

wss.on('close', () => {
    clearInterval(interval);
});

const interval = setInterval(() => {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate();
  
      ws.isAlive = false;
      ws.ping();
    });
}, 5000);

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

server.listen(PORT, () => {
    console.log(`${getCurrentDateTime()}: listening on port ${PORT}`);
})