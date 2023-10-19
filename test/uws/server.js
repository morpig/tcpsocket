const uws = require('uWebSockets.js');
const fs = require('fs');

const { PORT } = process.env;

uws.SSLApp({
    cert_file_name: `../../ssl/cert.pem`,
    key_file_name: `../../ssl/privkey.pem`
    
}).ws('/*', {
    sendPingsAutomatically: false,
    upgrade: (res, req, context) => {
        console.log(`${getCurrentDateTime()}: upgrade extensions=${req.getHeader('sec-websocket-extensions')} protocol=${req.getHeader('sec-websocket-protocol')} key=${req.getHeader('sec-websocket-key')} version=${req.getHeader('sec-websocket-version')}`)
        // server received upgrade request -> upgrade request to websocket
        res.upgrade(
            {
                'cfRay': req.getHeader('cf-ray'),
                'forwardedFor': req.getHeader('cf-connecting-ip') || req.getHeader('x-forwarded-for') || '8.8.8.8',
                id: req.getHeader('x-websocket-id') || req.getQuery('id'),
            },
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
            context
        );
    },
    open: (ws) => {
        // on websocket open event
        ws.rawIp = Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8');
        console.log(`${getCurrentDateTime()}: ${ws.id} connected to ws, remote=${ws.forwardedFor}, cfRay=${ws.cfRay}, rawIp: ${Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8')}`);
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
        console.log(`${getCurrentDateTime()}: ${ws.id} ws closed: ${code} ${Buffer.from(message).toString('utf-8')} ${ws.cfRay} ${ws.rawIp}`)
    }
}).get('/*', (res, req) => { // opposite!
    res.writeStatus('200 OK').end('OK');
}).listen(parseInt(PORT), (listenSocket) => {
    if (listenSocket) {
        console.log(`Listening to port ${PORT}`)
    }
});

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