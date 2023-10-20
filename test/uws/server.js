const uws = require('uWebSockets.js');
const fs = require('fs');

const { PORT } = process.env;

const app = uws.SSLApp({
    cert_file_name: `../../ssl/cert.pem`,
    key_file_name: `../../ssl/privkey.pem`
    
}).ws('/*', {
    idleTimeout: 0,
    sendPingsAutomatically: false,
    upgrade: (res, req, context) => {
        const id = req.getHeader('x-websocket-id') || req.getQuery('id');
        const forwardedFor = req.getHeader('cf-connecting-ip') || req.getHeader('x-forwarded-for') || '8.8.8.8';
        const cfRay = req.getHeader('cf-ray') || 'cfRay';

        console.log(`${getCurrentDateTime()}: ${id} ws upgrade req: cfRay=${cfRay}, remote=${forwardedFor}, extensions=${req.getHeader('sec-websocket-extensions')}, protocol=${req.getHeader('sec-websocket-protocol')}, key=${req.getHeader('sec-websocket-key')}, version=${req.getHeader('sec-websocket-version')}`)
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
        // on websocket open event
        ws.subscribe('cfpingtest');
        ws.send(Buffer.from('connect-ping'));
        ws.rawIp = Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8');
        console.log(`${getCurrentDateTime()}: ${ws.id} ws open: cfRay=${ws.cfRay}, remote=${ws.forwardedFor}, rawIp: ${Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8')}`);
    },
    message: (ws, message, isBinary) => {
        // on websocket receive msg event
        const buffer = Buffer.from(message);
        if (buffer.toString('utf-8') === 'ping') {
            ws.send(Buffer.from('ping'))
        }
    },
    drain: (ws) => {
        // ws drain backpressure event
        console.log(`${getCurrentDateTime()}: ${ws.id} ws drain: ${ws.getBufferedAmount()}`)
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