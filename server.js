const net = require('net');
const WebSocket = require('ws');

// PORT=3000 HOST=localhost:3000
const { PORT, HOST } = process.env;

const wss = new WebSocket.Server({
    port: PORT,
    perMessageDeflate: false,
    skipUTF8Validation: false,
    maxPayload: 64 * 1024
});

// on WS connect -> open TCP connection
wss.on('connection', (ws, req) => {
    // create tcp conn, keepalive true
    const tcpConnection = new net.Socket();
    tcpConnection.setKeepAlive(true);

    let buffer = [];
    const hostname = HOST.split(':')[0];
    const port = HOST.split(':')[1];

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
        console.log(`${getCurrentDateTime()} get ws close request ${err}`);
        if (tcpConnection.readyState === 'open') {
            tcpConnection.end();
        }
    });

    console.log(`${getCurrentDateTime()} connecting tcp to ${hostname}:${port}`);
    tcpConnection.connect(port, hostname, () => {
        console.log(`${getCurrentDateTime()} connected tcp to ${hostname}:${port}`);

        //send pending WS buffer data -> tcp
        buffer.forEach((b) => {
            if (tcpConnection.readyState === 'open') {
                tcpConnection.write(b);
            }
        });
        buffer = null;

        let bufferConcat = Buffer.alloc(0);
        tcpConnection.on('data', (data) => {
            console.log(ws.bufferedAmount);
            ws.send(data);
            //forward tcp data -> ws. validate connection status
            /*if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }*/
        });

        tcpConnection.on('error', (err) => {
            ws.close();
            console.log('tcp error', err);
        });

        tcpConnection.on('end', (data) => {
            ws.close();
            console.log('tcp closed');
        });
    });
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