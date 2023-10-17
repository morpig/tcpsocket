const net = require('net');
const WebSocket = require('ws');

// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { PORT, HOST } = process.env;

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
        console.log(`${getCurrentDateTime()}: ${id} websocket connected (${Math.round(performance.now() - tcpOpen)}ms)`);
        buffer.forEach((b) => {
            ws.send(b);
        });
        heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(Buffer.from('ping').toString('utf8'));
            }
        }, 5000)
        buffer = null;
    });

    ws.on('message', (data) => {
        socket.write(data);
    });

    ws.on('close', (code, reason) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket closed: ${code} ${reason}`);
        socket.end();
        clearInterval(heartbeatInterval);
    });

    ws.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket error ${err}`);
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
    });

    socket.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} tcp error ${err}`);
    });

    socket.on('close', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} tcp closed`);
        if (ws.readyState === WebSocket.OPEN) {
            console.log(`${getCurrentDateTime()}: ${id} closing ws due to tcp close`)
            ws.close(4000, 'client tcp closed');
        }
    })
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

function generateRandomCharacters(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomChars = '';
  
    while (randomChars.length < length) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomChars += characters.charAt(randomIndex);
    }
  
    return randomChars;
}