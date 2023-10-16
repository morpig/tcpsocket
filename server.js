const net = require('net');
const WebSocket = require('ws');

// PORT=3000 HOST=localhost:3000
const { PORT, HOST } = process.env;

const wss = new WebSocket.Server({
    port: PORT,
    perMessageDeflate: false,
    skipUTF8Validation: false
});

// on WS connect -> open TCP connection
wss.on('connection', (ws, req) => {
    // create tcp conn, keepalive true
    const tcpConnection = new net.Socket();
    tcpConnection.setKeepAlive(true);

    const buffer = [];
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

        tcpConnection.on('data', (data) => {
            //forward tcp data -> ws. validate connection status
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        tcpConnection.on('error', (err) => {
            console.log('tcp error', err);
        });

        tcpConnection.on('end', (data) => {
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
            buffer.push(message);
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