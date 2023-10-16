const net = require('net');
const WebSocket = require('ws');
const shortid = require('shortid');

// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { PORT, HOST } = process.env;

const server = new net.Server();

// create tcp server
server.listen(PORT, () => {
    console.log(`${new Date()}: waiting for new conns ${PORT} ${HOST}`);
});

// on new tcp connection
server.on('connection', (socket) => {
    const id = shortid();
    socket.setKeepAlive(true);

    // send to buffer until websocket is connected
    let buffer = [];
    const ws = new WebSocket(HOST, {
        perMessageDeflate: false,
        maxPayload: 32 * 1024,
        skipUTF8Validation: false
    });

    ws.on('open', () => {
        console.log(`${id} websocket connected`);
        buffer.forEach((b) => {
            ws.send(b);
        });
        buffer = null;
    });

    ws.on('message', (data) => {
        socket.write(data);
    });

    ws.on('close', (close) => {
        console.log(`${id} websocket closed`);
        socket.end();
    });

    ws.on('error', (err) => {
        console.log(`${id} websocket error`, err);
    });

    var init = true;
    let bufferConcat = Buffer.alloc(0);
    socket.on('data', (chunk) => {
        if (init) {
            console.log(chunk.toString());
            init = false;
        }

        if (buffer !== null) {
            buffer.push(chunk);
            return;
        }

        if (ws.readyState === WebSocket.OPEN) {
            if (chunk.length <= 32 * 1024) {
                ws.send(chunk);
                return;
            }
            bufferConcat = Buffer.concat([bufferConcat, chunk]);
            while (bufferConcat.length >= 32 * 1024) {
                const data = bufferConcat.slice(0, 32 * 1024);
                ws.send(data);
                bufferConcat = bufferConcat.slice(32 * 1024);
            }
            return;
        }
    })

    socket.on('end', () => {
        console.log(`${id} tcp closed`);
        ws.close();
    });

    socket.on('error', (err) => {
        console.log(`${id} tcp error`, err);
    })
});