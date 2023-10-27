const uws = require('uWebSockets.js');
const net = require('net');

const { HOST, PORT } = process.env;

let buffers = {}
let backPressure = {};

const app = uws.SSLApp({
    cert_file_name: `../ssl/cert.pem`,
    key_file_name: `../ssl/privkey.pem`
    
}).ws('/*', {
    idleTimeout: 0,
    maxLifetime: 0,
    maxBackpressure: 0,
    maxPayloadLength: 1 * 1024 * 1024,
    sendPingsAutomatically: false,
    upgrade: (res, req, context) => {
        const id = req.getHeader('x-websocket-id') || req.getQuery('id') || 'socketid';
        const forwardedFor = req.getHeader('cf-connecting-ip') || req.getHeader('x-forwarded-for') || '8.8.8.8';
        const cfRay = req.getHeader('cf-ray') || 'cfRay';

        buffers[id] = [];

        console.log(`${getCurrentDateTime()}: ${id} ws upgrade: cfRay=${cfRay}, remote=${forwardedFor}, extensions=${req.getHeader('sec-websocket-extensions')}, protocol=${req.getHeader('sec-websocket-protocol')}, key=${req.getHeader('sec-websocket-key')}, version=${req.getHeader('sec-websocket-version')}`)
        // server received upgrade request -> upgrade request to websocket
        res.upgrade(
            {
                'cfRay': cfRay,
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
        // on websocket open event
        ws.subscribe('ping');
        ws.send(Buffer.from('ping'));
        ws.isOpen = true;
        ws.isBackpressured = false;
        ws.rawIp = Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8');

        const hostname = HOST.split(':')[0];
        const port = HOST.split(':')[1];

        ws.tcpConnection = new net.Socket();
        ws.tcpConnection.setKeepAlive(true);

        ws.tcpConnection.connect(port, hostname, () => {
            ws.buffer.forEach((b) => {
                ws.tcpConnection.write(Buffer.from(b));
            })
            //ws.tcpConnection.write(Buffer.from(buffers[ws.id]));
            ws.buffer = null;

            //ws.isBackpressured = true;
            console.log(`${getCurrentDateTime()}: ${ws.id} ws+tcp open: cfRay=${ws.cfRay}, remote=${ws.forwardedFor}, rawIp: ${Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8')}`);
        });


        ws.tcpConnection.on('data', (data) => {
            if (ws.isOpen) {
                const result = ws.send(data, true, false);
                if (result === 0 && !ws.isBackpressured) {
                    console.log(`${getCurrentDateTime()}: ${ws.id} connection backpressured: cfRay=${ws.cfRay}, remote=${ws.forwardedFor}, rawIp: ${Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8')}`);
                    ws.isBackpressured = true;
                }
                /*
                                if (!ws.isBackpressured) {
                    const result = ws.send(data, true, false);

                    if ((result === 0)) {
                        console.log(`${getCurrentDateTime()}: ${ws.id} backpressure full! queueing tcp stream ${ws.getBufferedAmount()}`);
                        ws.isBackpressured = true;

                        if (!backPressure[ws.id]) {
                            backPressure[ws.id] = []
                        }
                        backPressure[ws.id].push(data);

                        return;
                    }
    
                    if (result != 1) {
                        console.log(`${getCurrentDateTime()}: ${ws.id} ws send status: ${result} ${ws.getBufferedAmount()}`);
                    }
                } else {
                    if (!backPressure[ws.id]) {
                        backPressure[ws.id] = []
                    }
                    backPressure[ws.id].push(data);
                }*/
            }
        });

        ws.tcpConnection.on('error', (err) => {
            console.log(`${getCurrentDateTime()}: ${ws.id} tcp error: ${err}`)
        });

        ws.tcpConnection.on('close', (data) => {
            console.log(`${getCurrentDateTime()}: ${ws.id} tcp closed, closing ws`);
            if (ws.isOpen) {
                ws.end(4500, 'origin tcp closed');
            }
        });
    },
    message: (ws, message, isBinary) => {
        // on websocket receive msg event
        const buffer = Buffer.from(message)
        if (buffer.toString('utf-8') === 'ping') {
            ws.send(Buffer.from('ping'));
            return;
        }

        if (ws.buffer !== null) {
            ws.buffer.push(message.slice(0));
            return;
        }

        if (ws.tcpConnection.readyState === 'open') {
            ws.tcpConnection.write(buffer);
        }
    },
    drain: (ws) => {
        console.log(`${getCurrentDateTime()}: ${ws.id} backpressure drain done, sending pending data. cfRay=${ws.cfRay}, remote=${ws.forwardedFor}, rawIp: ${Buffer.from(ws.getRemoteAddressAsText()).toString('utf-8')}`);
        if (ws.isBackpressured) {
            ws.isBackpressured = false;
        }
        /*
                if (ws.isBackpressured && backPressure[ws.id]) {
             while (backPressure[ws.id].length > 0) {
                if ((ws.getBufferedAmount() < 1024)) {
                    const b = backPressure[ws.id][0];
                    const result = ws.send(b, true, false);
                    if (result == 1) {
                        backPressure[ws.id].shift();
                    }
                    console.log(`${getCurrentDateTime()}: ${ws.id} backpressure3 draining status=${result}, size=${backPressure[ws.id].length}, bufferedAmount=${ws.getBufferedAmount()}`);
                }
            }

            if (backPressure[ws.id].length === 0) {
                ws.isBackpressured = false;
                delete backPressure[ws.id];
                console.log(`${getCurrentDateTime()}: ${ws.id} backpressure2 drain done`);
            }
        } */
    },
    close: (ws, code, message) => {
        ws.isOpen = false;
        delete backPressure[ws.id];
        delete buffers[ws.id];
        // on websocket close event
        if (ws.tcpConnection.readyState === 'open') {
            ws.tcpConnection.end();
        }
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
    app.publish('ping', 'ping');
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