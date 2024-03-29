const uws = require('uWebSockets.js');
const net = require('net');
const moment = require('moment');
const axios = require('axios');
const os = require("os");

const { HOST, PORT, LOG_URL } = process.env;
const isLogEnabled = (LOG_URL) ? true : false;

let buffers = {}
let backPressure = {};

const app = uws.SSLApp({
    cert_file_name: `../ssl/cert.pem`,
    key_file_name: `../ssl/privkey.pem`
    
}).ws('/*', {
    idleTimeout: 0,
    maxLifetime: 0,
    maxBackpressure: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    sendPingsAutomatically: false,
    upgrade: (res, req, context) => {
        const id = req.getHeader('x-websocket-id') || req.getQuery('id') || 'socketid';
        const forwardedFor = req.getHeader('cf-connecting-ip') || req.getHeader('x-forwarded-for') || '8.8.8.8';
        const cfRay = req.getHeader('cf-ray') || 'cfRay';
        const cfColoId = req.getHeader('x-cloudflare-colo') || 'cfColo';
        const cfMetalId = req.getHeader('x-cloudflare-metal') || 'cfMetal';

        buffers[id] = [];

        // server received upgrade request -> upgrade request to websocket
        res.upgrade(
            {
                'cfRay': cfRay,
                'cfColoId': cfColoId,
                'cfMetalId': cfMetalId,
                'forwardedFor': forwardedFor,
                id: id,
                buffer: []
            },
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
            context
        );
    },
    open: (ws) => {
        ws.isOpen = true;
        ws.isBackpressured = false;
        ws.metrics = {
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
        ws.rawIp = Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8');
        if (ws.rawIp.includes('0000:0000:0000:0000:0000:ffff')) {
            ws.rawIp = convertIPv6ToIPv4(Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8'));
        }
        ws.connectedDate = new Date();

        const hostname = HOST.split(':')[0];
        const port = HOST.split(':')[1];

        ws.tcpConnection = new net.Socket();
        ws.tcpConnection.setKeepAlive(false);

        ws.tcpConnection.connect(port, hostname, () => {
            ws.buffer.forEach((b) => {
                ws.tcpConnection.write(new Uint8Array(b));
                ws.metrics["rx"]["seq"]++;
                ws.metrics["rx"]["size"] = Buffer.byteLength(b);
                ws.metrics["rx"]["lastRcvd"] = new Date().getTime();
            })
            ws.buffer = null;
            console.log(`${getCurrentDateTime()}: ${ws.id} event=WS_OPEN, cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}`);
            sendLogs(Date.now(), `${ws.id} event=WS_OPEN, cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}`, {
                type: 'WS_OPEN',
                id: ws.id,
                cfRay: ws.cfRay,
                cfColoId: ws.cfColoId,
                cfMetalId: ws.cfMetalId,
                remoteIp: ws.forwardedFor,
                rawIp: ws.rawIp
            });
        });


        ws.tcpConnection.on('data', (data) => {
            if (ws.isOpen) {
                const result = ws.send(data.buffer, true, false);
                ws.metrics["tx"]["seq"]++;
                ws.metrics["tx"]["size"] = Buffer.byteLength(data);
                ws.metrics["tx"]["lastSent"] = new Date().getTime();
                if (result === 0 && !ws.isBackpressured) {
                    ws.isBackpressured = true;
                    console.log(`${getCurrentDateTime()}: ${ws.id} event=BACKPRESSURE_TRIGGERED buffer=${ws.getBufferedAmount()} cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}`);
                    sendLogs(Date.now(), `${ws.id} event=BACKPRESSURE_TRIGGERED buffer=${ws.getBufferedAmount()} cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}`, {
                        type: 'BACKPRESSURE_TRIGGERED',
                        id: ws.id,
                        cfRay: ws.cfRay,
                        cfColoId: ws.cfColoId,
                        cfMetalId: ws.cfMetalId,
                        remoteIp: ws.forwardedFor,
                        rawIp: ws.rawIp,
                        origin: 'SERVER'
                    });
                }
            }
        });

        ws.tcpConnection.on('error', (err) => {
            console.log(`${getCurrentDateTime()}: ${ws.id} event=TCP_ERROR, err=${err}`);
            sendLogs(Date.now(), `${ws.id} event=TCP_ERROR, err=${err}`, {
                err: err,
                type: 'TCP_ORIGIN_ERROR',
                id: ws.id,
                cfRay: ws.cfRay,
                cfColoId: ws.cfColoId,
                cfMetalId: ws.cfMetalId,
                remoteIp: ws.forwardedFor,
                rawIp: ws.rawIp
            });
        });

        ws.tcpConnection.on('close', (data) => {
            console.log(`${getCurrentDateTime()}: ${ws.id} event=TCP_CLOSED`);
            sendLogs(Date.now(), `${ws.id} event=TCP_CLOSED`, {
                type: 'TCP_CLOSED',
                id: ws.id,
                cfRay: ws.cfRay,
                cfColoId: ws.cfColoId,
                cfMetalId: ws.cfMetalId,
                remoteIp: ws.forwardedFor,
                rawIp: ws.rawIp
            });
            if (ws.isOpen) {
                ws.end(4500, 'origin tcp closed');
            }
        });
    },
    message: (ws, message, isBinary) => {
        if (ws.tcpConnection.readyState === 'open') {
            ws.tcpConnection.write(new Uint8Array(message));
            ws.metrics["rx"]["seq"]++;
            ws.metrics["rx"]["size"] = Buffer.byteLength(message);
            ws.metrics["rx"]["lastRcvd"] = new Date().getTime();
            return;
        }

        if (ws.buffer !== null) {
            ws.buffer.push(message.slice(0));
            return;
        }
    },
    drain: (ws) => {
        if (ws.getBufferedAmount() < 1024) {
            console.log(`${getCurrentDateTime()}: ${ws.id} event=WS_DRAIN_COMPLETED, buffer=${ws.getBufferedAmount()} cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}`);
            sendLogs(Date.now(), `${ws.id} event=WS_DRAIN_COMPLETED, buffer=${ws.getBufferedAmount()} cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}`, {
                type: 'WS_DRAIN',
                id: ws.id,
                cfRay: ws.cfRay,
                cfColoId: ws.cfColoId,
                cfMetalId: ws.cfMetalId,
                remoteIp: ws.forwardedFor,
                rawIp: ws.rawIp
            });
        }
        if (ws.isBackpressured) {
            ws.isBackpressured = false;
        }
    },
    close: (ws, code, message) => {
        ws.isOpen = false;
        delete backPressure[ws.id];
        delete buffers[ws.id];
        // on websocket close event
        if (ws.tcpConnection.readyState === 'open') {
            ws.tcpConnection.destroy();
        }
        console.log(`${getCurrentDateTime()}: ${ws.id} event=WS_CLOSED, cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}, code=${code}, reason=${Buffer.from(message).toString('utf-8')}, firstConnect=${moment(ws.connectedDate).fromNow()}, rx=${JSON.stringify(ws.metrics['rx'])}, tx=${JSON.stringify(ws.metrics['tx'])}`)
        sendLogs(Date.now(), `${ws.id} event=WS_CLOSED, cfRay=${ws.cfRay}, cfColo=${ws.cfColoId}, cfMetal=${ws.cfMetalId} remote=${ws.forwardedFor}, code=${code}, reason=${Buffer.from(message).toString('utf-8')}, firstConnect=${moment(ws.connectedDate).fromNow()}, rx=${JSON.stringify(ws.metrics["rx"])}, tx=${JSON.stringify(ws.metrics["tx"])}`, {
            type: 'WS_CLOSED',
            code: code,
            message: message,
            id: ws.id,
            cfRay: ws.cfRay,
            cfColoId: ws.cfColoId,
            cfMetalId: ws.cfMetalId,
            remoteIp: ws.forwardedFor,
            rawIp: ws.rawIp,
            metrics: ws.metrics,
            origin: 'SERVER'
        });
    }
}).get('/*', (res, req) => { // opposite!
    return res.writeStatus('200 OK').end('OK', true);
}).listen(parseInt(PORT), (listenSocket) => {
    if (listenSocket) {
        console.log(`Listening to port ${PORT}`)
    }
});

function sendLogs(_time, message, data) {
    if (isLogEnabled) {
        axios.post(LOG_URL, {
            _time,
            message,
            data: {
                ...data,
                origin: 'SERVER',
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

function convertIPv6ToIPv4(ipv6) {
    // Extract the last two segments of the IPv6 address
    const ipv6Parts = ipv6.split(':');
    const ipv4Hex = ipv6Parts.slice(-2).join('');

    // Split the 8-character string into two-character pairs
    const ipv4Bytes = ipv4Hex.match(/.{1,2}/g);

    // Convert each pair from hex to decimal
    const ipv4 = ipv4Bytes.map(hexPair => parseInt(hexPair, 16)).join('.');

    return ipv4;
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