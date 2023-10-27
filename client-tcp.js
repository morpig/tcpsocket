const net = require('net');
const tls = require('node:tls');
const WebSocket = require('websocket-driver');

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

    //console.log(`${getCurrentDateTime()}: ${id} tcp open`);

    const hostname = HOST.split(':')[0];
    const port = HOST.split(':')[1];

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;
    const driver = WebSocket.client(`wss://${hostname}`, {
        maxLength: 64 * 1024
    });
    driver.setHeader('host', HOST);
    driver.setHeader('accept', '*/*');
    driver.setHeader('x-websocket-id', id);

    const tcp = tls.connect({
        host: hostname,
        port: port,
        servername: hostname
    });

    tcp.pipe(driver.io).pipe(tcp);

    tcp.on('connect', () => {
      driver.start();
    });

    tcp.on('error', (err) => {
        console.log(err);
        console.log(`${getCurrentDateTime()}: ${id} tcp LL error: ${err}`);
    });

    tcp.on('close', (hasError) => {
        socket.destroy();
        clearInterval(heartbeatInterval);
        console.log(`${getCurrentDateTime()}: ${id} tcp LL closed: ${hasError}`);
    });

    driver.on('open', (event) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket connected rawIp=${socket.remoteAddress} (${Math.round(performance.now() - tcpOpen)}ms)`);
        buffer.forEach((b) => {
            driver.binary(b)
        });
        heartbeatInterval = setInterval(() => {
            driver.binary(Buffer.from('ping'));
        }, 5000)
        buffer = null;
    })
    
    driver.on('error', (event) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket error ${event}`);
        clearInterval(heartbeatInterval);
    })
    
    driver.on('close', ({ code, reason }) => {
        //console.log(`${getCurrentDateTime()}: ${id} close`)
        console.log(`${getCurrentDateTime()}: ${id} websocket closed: ${code} ${reason}`);
        if (!socket.destroyed) {
            socket.destroy();
        }
    })
    
    driver.messages.on('data', (data) => {
        const buffer = Buffer.from(data);
        if (buffer.toString() === 'ping') {
            return;
        }
        socket.write(data);
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

        const result = driver.binary(chunk);
    });

    socket.on('end', () => {
        //console.log(`${getCurrentDateTime()}: ${id} tcp end!`);
    });

    socket.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} tcp error ${err}`);
    });

    socket.on('close', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} tcp closed`);
        driver.close();
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