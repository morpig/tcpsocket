const net = require('net');
const WebSocket = require('ws');
const axios = require('axios');
const os = require("os");

// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { HOST, PORT, LOG_URL } = process.env;
const isLogEnabled = (LOG_URL) ? true : false;

const server = new net.Server();

// create tcp server
server.listen(PORT, () => {
    console.log(`${getCurrentDateTime()}: waiting for new conns ${PORT} ${HOST}`);
});

// on new tcp connection
server.on('connection', (socket) => {
    const tcpOpen = performance.now();
    const id = generateRandomCharacters(6);
    const address = socket.remoteAddress;
    let metrics = {
        rx: {
            seq: 0,
            size: 0,
            lastRcvd: 0
        },
        tx: {
            seq: 0,
            size: 0,
            lastSent: 0
        }
    }
    let headers, cfRay, cfColoId, cfMetalId, url;

    socket.setKeepAlive(false);
    
    console.log(`${getCurrentDateTime()}: ${id} tcp open`)

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;
    const ws = new WebSocket(HOST, {
        allowSynchronousEvents: true,
        rejectUnauthorized: true,
        handshakeTimeout: 2500,
        perMessageDeflate: false,
        maxPayload: 64 * 1024 * 1024,
        skipUTF8Validation: false,
        headers: {
            'x-websocket-id': id
        }
    });

    ws.on('upgrade', (res) => {
        headers = res.headers;
        cfRay = res.headers['cf-ray'] || `cfRay-${id}`,
        cfColoId = res.headers['x-cloudflare-colo'] || '0',
        cfMetalId = res.headers['x-cloudflare-metal'] || '0'
    });

    ws.on('open', () => {
        buffer.forEach((b) => {
            ws.send(b.buffer, { binary: true });
            metrics["tx"]["seq"]++;
            metrics["tx"]["size"] = Buffer.byteLength(b);
            metrics["tx"]["lastSent"] = new Date().getTime();
        });
        buffer = null;
        console.log(`${getCurrentDateTime()}: ${id} event=WS_OPEN, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}, time=${Math.round(performance.now() - tcpOpen)}ms`);
        sendLogs(Date.now(), `${id} event=WS_OPEN, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}, time=${Math.round(performance.now() - tcpOpen)}ms`, {
            type: 'WS_OPEN',
            id: id,
            cfRay: cfRay,
            cfMetalId: cfMetalId,
            cfColoId: cfColoId,
            address: address,
            headers: headers,
            time: Math.round(performance.now() - tcpOpen)
        });
    });

    ws.on('message', (data, isBinary) => {
        socket.write(new Uint8Array(data));
        metrics["rx"]["seq"]++;
        metrics["rx"]["size"] = Buffer.byteLength(data);
        metrics["rx"]["lastRcvd"] = new Date().getTime();
        return;
    });

    ws.on('close', (code, reason) => {
        socket.destroy();
        console.log(`${getCurrentDateTime()}: ${id} event=WS_CLOSE, code=${code}, reason=${reason}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`);
        sendLogs(Date.now(), `${id} event=WS_CLOSE, code=${code}, reason=${reason}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`, {
            type: 'WS_CLOSE',
            code: code,
            reason: reason.toString(),
            cfRay: cfRay,
            cfMetalId: cfMetalId,
            cfColoId: cfColoId,
            id: id,
            headers: headers,
            address: address,
            metrics: metrics
        });
    });

    ws.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} event=WS_ERROR, error=${err}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}`);
        sendLogs(Date.now(), `${id} event=WS_ERROR, error=${err}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}`, {
            type: 'WS_ERROR',
            event: err,
            id: id,
            headers: headers,
            address: address,
            metrics: metrics
        });
    });

    socket.on('data', (chunk) => {
        if (buffer !== null) {
            buffer.push(chunk);
            return;
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk.buffer, { binary: true });
            metrics["tx"]["seq"]++;
            metrics["tx"]["size"] = Buffer.byteLength(chunk);
            metrics["tx"]["lastSent"] = new Date().getTime();
            return;
        }
    });

    socket.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} event=TCP_LOCAL_ERROR, err=${err}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}`);
        sendLogs(Date.now(), `${id} event=TCP_LOCAL_ERROR, err=${err}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}`, {
            type: 'TCP_LOCAL_ERROR',
            err: err,
            id: id,
            headers: headers,
            address: address
        });
    });

    socket.on('close', (err) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(4000, 'edge tcp closed');
        }
        console.log(`${getCurrentDateTime()}: ${id} event=TCP_LOCAL_CLOSED, err=${err}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}`);
        sendLogs(Date.now(), `${id} event=TCP_LOCAL_CLOSED, err=${err}, cfRay=${cfRay}, cfColo=${cfColoId}, cfMetal=${cfMetalId}, socket=${address}`, {
            type: 'TCP_LOCAL_CLOSED',
            id: id,
            headers: headers,
            address: address,
            metrics: metrics
        });
    })
});

function sendLogs(_time, message, data) {
    if (isLogEnabled) {
        axios.post(LOG_URL, {
            _time,
            message,
            data: {
                ...data,
                origin: 'CLIENT',
                hostname: os.hostname()
            }
        }, {
            timeout: 5000
        }).then(() => {
            //
        }).catch(() => {
            //
        })
    }
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