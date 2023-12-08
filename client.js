const net = require('net');
const WebSocket = require('ws');
const axios = require('axios');
const os = require("os");

// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { HOST, PORT, LOG_URL } = process.env;
const isLogEnabled = (LOG_URL) ? true : false;

const server = new net.Server();

// create tcp server
server.listen(PORT, () => {
    console.log(`${getCurrentDateTime()}: waiting for new conns ${PORT} ${HOST}`);
});

// on new tcp connection
server.on('connection', (socket) => {
    const tcpOpen = performance.now();
    const id = generateRandomCharacters(6);
    socket.setKeepAlive(true);

    console.log(`${getCurrentDateTime()}: ${id} tcp open`)

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;
    const ws = new WebSocket(HOST, {
        handshakeTimeout: 2500,
        perMessageDeflate: false,
        maxPayload: 64 * 1024,
        skipUTF8Validation: false,
        headers: {
            'x-websocket-id': id
        }
    });

    ws.on('open', () => {
        buffer.forEach((b) => {
            ws.send(b);
        });
        buffer = null;
        console.log(`${getCurrentDateTime()}: ${id} websocket connected (${Math.round(performance.now() - tcpOpen)}ms)`);
        sendLogs(Date.now(), `${id} websocket connected (${Math.round(performance.now() - tcpOpen)}ms)`, {
            type: 'WS_OPEN',
            id: id,
            time: Math.round(performance.now() - tcpOpen)
        });
    });

    ws.on('message', (data) => {
        socket.write(data);
    });

    ws.on('close', (code, reason) => {
        socket.destroy();
        clearInterval(heartbeatInterval);
        console.log(`${getCurrentDateTime()}: ${id} websocket closed: ${code} ${reason}`);
        sendLogs(Date.now(), `${id} websocket closed ${code} ${reason} (${Math.round(performance.now() - tcpOpen)}ms`, {
            type: 'WS_CLOSED',
            code: code,
            reason: reason,
            id: id,
        });
    });

    ws.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket error ${err}`);
        sendLogs(Date.now(), `${id} websocket error ${err}`, {
            type: 'WS_ERROR',
            err: err
        });
    });

    var init = true;
    let bufferConcat = Buffer.alloc(0);
    socket.on('data', (chunk) => {
        if (init) {
            init = false;
        }

        if (buffer !== null) {
            buffer.push(chunk);
            return;
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk);
            return;
        }
    })

    socket.on('end', () => {
        console.log(`${getCurrentDateTime()}: ${id} tcp end!`);
        sendLogs(Date.now(), `${id} tcp end!`, {
            type: 'TCP_END',
            id: id,
        });
    });

    socket.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} tcp error ${err}`);
        sendLogs(Date.now(), `${id} tcp error!`, {
            type: 'TCP_ERROR',
            id: id,
            err: err
        });
    });

    socket.on('close', (err) => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log(`${getCurrentDateTime()}: ${id} closing ws due to tcp close`)
            ws.close(4000, 'client tcp closed');
        }
        console.log(`${getCurrentDateTime()}: ${id} tcp closed`);
        sendLogs(Date.now(), `${id} tcp closed!`, {
            type: 'TCP_CLOSED',
            id: id,
            err: err
        });
    })
});

function sendLogs(_time, message, data) {
    if (isLogEnabled) {
        axios.post(LOG_URL, {
            _time,
            message,
            data: {
                ...data,
                origin: 'CLIENT',
                hostname: os.hostname()
            }
        }, {
            timeout: 5000
        }).then(() => {
            //
        }).catch(() => {
            //
        })
    }
}

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

function generateRandomCharacters(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomChars = '';
  
    while (randomChars.length < length) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomChars += characters.charAt(randomIndex);
    }
  
    return randomChars;
}