const net = require('net');
const WebSocket = require('ws');

// PORT=3000 HOST=localhost:3000
const { PORT, HOST } = process.env;

const wss = new WebSocket.Server({
    port: PORT,
    perMessageDeflate: false,
    skipUTF8Validation: false,
    maxPayload: 16 * 1024
});

// on WS connect -> open TCP connection
wss.on('connection', (ws, req) => {
    // create tcp conn, keepalive true
    const tcpConnection = new net.Socket();
    tcpConnection.setKeepAlive(true);

    let buffer = [];
    const hostname = HOST.split(':')[0];
    const port = HOST.split(':')[1];

    console.log(`${new Date()}: connecting tcp to ${hostname}:${port}`);
    tcpConnection.connect(port, hostname, () => {
        console.log(`${new Date()}: connected tcp to ${hostname}:${port}`);

        //send pending WS buffer data -> tcp
        buffer.forEach((b) => {
            if (tcpConnection.readyState === 'open') {
                tcpConnection.write(b);
            }
        });
        buffer = null;

        let bufferConcat = Buffer.alloc(0);
        tcpConnection.on('data', (data) => {
            if (data.length <= 32 * 1024) {
                ws.send(data);
            }
            bufferConcat = Buffer.concat([bufferConcat, data]);
            while (bufferConcat.length >= 32 * 1024) {
                const data = bufferConcat.slice(0, 32 * 1024);
                console.log(data.length);
                ws.send(data);
                bufferConcat = bufferConcat.slice(32 * 1024)
            }
            //forward tcp data -> ws. validate connection status
            /*if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }*/
        });

        tcpConnection.on('error', (err) => {
            console.log('tcp error', err);
        });

        tcpConnection.on('end', (data) => {
            ws.close();
            console.log('tcp closed');
        });
    });

    // init -> debug purposes. get first messages
    let init = true;
    ws.on('message', (data) => {
        if (init) {
            console.log(data.toString());
            init = false;
        }

        // buffer !== null -> tcp not connected YET
        if (buffer !== null) {
            buffer.push(data);
            return;
        }

        if (tcpConnection.readyState === 'open') {
            tcpConnection.write(data);
        }
    });

    ws.on('error', (err) => {
        console.log('ws error', err);
    });

    ws.on('close', (err) => {
        if (tcpConnection.readyState === 'open') {
            tcpConnection.end();
        }
    });
});