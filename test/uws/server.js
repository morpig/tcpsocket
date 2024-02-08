const uws = require('uWebSockets.js');
const fs = require('fs');

const { PORT } = process.env;

const app = uws.SSLApp({
    cert_file_name: `../../ssl/cert.pem`,
    key_file_name: `../../ssl/privkey.pem`
    
}).ws('/*', {
    idleTimeout: 0,
    sendPingsAutomatically: false,
    maxBackpressure: 1,
    upgrade: (res, req, context) => {
        const id = req.getHeader('x-websocket-id') || req.getQuery('id') || 'socketid';
        const forwardedFor = req.getHeader('cf-connecting-ip') || req.getHeader('x-forwarded-for') || '8.8.8.8';
        const cfRay = req.getHeader('cf-ray') || 'cfRay';

        console.log(`${getCurrentDateTime()}: ${id} ws upgrade: cfRay=${cfRay}, remote=${forwardedFor}, extensions=${req.getHeader('sec-websocket-extensions')}, protocol=${req.getHeader('sec-websocket-protocol')}, key=${req.getHeader('sec-websocket-key')}, version=${req.getHeader('sec-websocket-version')}`)
        // server received upgrade request -> upgrade request to websocket
        res.upgrade(
            {
                'cfRay': cfRay,
                'forwardedFor': forwardedFor,
                id: id,
            },
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
            context
        );
    },
    open: (ws) => {
        ws.subscribe('cfpingtest');
        ws.send(Buffer.from('connect-ping'));
        ws.rawIp = Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8');
        if (ws.rawIp.includes('0000:0000:0000:0000:0000:ffff')) {
            ws.rawIp = convertIPv6ToIPv4(Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8'));
        }
        console.log(`${getCurrentDateTime()}: ${ws.id} ws open: cfRay=${ws.cfRay}, remote=${ws.forwardedFor}, rawIp: ${ws.rawIp}`);
    },
    message: (ws, message, isBinary) => {
        // on websocket receive msg event
        const buffer = Buffer.from(message);
        if (buffer.toString('utf-8') === 'ping') {
            ws.send(Buffer.from('ping'))
        }
    },
    close: (ws, code, message) => {
        // on websocket close event
        console.log(`${getCurrentDateTime()}: ${ws.id} ws closed: cfRay=${ws.cfRay}, remote=${ws.forwardedFor}, code=${code}, reason=${Buffer.from(message).toString('utf-8')}`)
    }
}).get('/*', (res, req) => { // opposite!
    res.writeStatus('200 OK').end('OK');
}).listen(parseInt(PORT), (listenSocket) => {
    if (listenSocket) {
        console.log(`Listening to port ${PORT}`)
    }
});

setInterval(() => {
    app.publish('cfpingtest', 'ping2');
}, 5000);

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