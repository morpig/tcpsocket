const WebSocket = require('ws');

const wss = new WebSocket.Server({
    port: '7979',
    perMessageDeflate: false,
    skipUTF8Validation: false,
    maxPayload: 64 * 1024
});

wss.on('connection', (ws, req) => {
    console.log(`${new Date()}: [server] new connection`);

    ws.on('close', (close) => {
        console.log(`${new Date()}: [server] ws close`)
    })
});