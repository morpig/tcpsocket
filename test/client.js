const WebSocket = require('ws');

const { HOST } = process.env;
console.log(`ws://${HOST}:7979`)

const ws = new WebSocket(`ws://${HOST}:7979`, {
    perMessageDeflate: false,
    maxPayload: 64 * 1024,
    skipUTF8Validation: false
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