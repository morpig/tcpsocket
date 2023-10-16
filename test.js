const WebSocket = require('ws');

const wss = new WebSocket.Server({
    port: '7979',
    perMessageDeflate: false,
    skipUTF8Validation: false,
    maxPayload: 64 * 1024
});

const { HOST } = process.env;
console.log(`ws://${HOST}:7979`)

const ws = new WebSocket(`ws://${HOST}:7979`, {
    perMessageDeflate: false,
    maxPayload: 64 * 1024,
    skipUTF8Validation: false
});

wss.on('connection', (ws, req) => {
    console.log(`${new Date()}: [server] new connection`);

    ws.on('close', (close) => {
        console.log(`${new Date()}: [server] ws close`)
    })
});

ws.on('open', () => {
    console.log(`${new Date()}: [client] websocket connected`);
    setTimeout(() => {
        console.log(`${new Date()}: [client] send close to server`)
        ws.close(4000);
    }, 2000)
});

ws.on('close', (close) => {
    console.log(`${new Date()}: [client] ws close`);
});