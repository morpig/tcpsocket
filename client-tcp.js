const net = require('net');
const tls = require('node:tls');
const WebSocket = require('websocket-driver');
const axios = require('axios');
const os = require('os');

// define PORT & HOST in OS variables. TLS is required !!!
// PORT=2087 HOST=websocket.test.net
const { HOST, PORT, LOG_URL } = process.env;
const isLogEnabled = (LOG_URL) ? true : false;

const server = new net.Server();

// start tcp server
server.listen(PORT, () => {
    console.log(`${getCurrentDateTime()}: waiting for new conns ${PORT} ${HOST}`);
});

// on new tcp connection
server.on('connection', (socket) => {
    let isSlowDown = false;
    const tcpOpen = performance.now();
    const id = generateRandomCharacters(6);
    const clientAddress = socket.remoteAddress;
    let cfRay, headers;

    socket.setKeepAlive(true);

    //console.log(`${getCurrentDateTime()}: ${id} tcp open`);

    const hostname = HOST.split(':')[0];
    const port = HOST.split(':')[1];

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;
    let metrics = {
        rx: {
            seq: 0,
            size: 0,
            lastRcvd: 0
        },
        tx: {
            seq: 0,
            size: 0,
            lastSent: 0
        }
    }

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

    tcp.setKeepAlive(false);

    tcp.pipe(driver.io).pipe(tcp);

    tcp.on('connect', () => {
      driver.start();
    });

    tcp.on('error', (err) => {
        console.log(err);
        console.log(`${getCurrentDateTime()}: ${id} event=TCP_LL_ERROR, err=${err}, url=${driver.url}, socket=${clientAddress}`);
        sendLogs(Date.now(), `${id} event=TCP_LL_ERROR, err=${err}, url=${driver.url}, socket=${clientAddress}`, {
            type: 'TCP_LL_ERROR',
            err: err,
            id: id,
            headers: headers,
            address: clientAddress
        });
    });

    tcp.on('close', (hasError) => {
        socket.destroy();
        console.log(`${getCurrentDateTime()}: ${id} event=TCP_LL_CLOSED, hasError=${hasError}, url=${driver.url}, socket=${clientAddress}`);
        sendLogs(Date.now(), `${id} event=TCP_LL_CLOSED, hasError=${hasError}, url=${driver.url}, socket=${clientAddress}`, {
            type: 'TCP_LL_CLOSED',
            hasError: hasError,
            id: id,
            headers: headers,
            address: clientAddress
        });
    });

    driver.on('open', () => {
        headers = driver.headers;
        cfRay = driver.headers['cf-ray'];

        console.log(`${getCurrentDateTime()}: ${id} event=WS_OPEN, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, time=${Math.round(performance.now() - tcpOpen)}ms`);
        sendLogs(Date.now(), `${id} event=WS_OPEN, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, time=${Math.round(performance.now() - tcpOpen)}ms`, {
            type: 'WS_OPEN',
            id: id,
            headers: headers,
            address: clientAddress,
            time: Math.round(performance.now() - tcpOpen)
        });
    })
    
    driver.on('error', (event) => {
        console.log(`${getCurrentDateTime()}: ${id} event=WS_ERROR, error=${event}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}`);
        sendLogs(Date.now(), `${id} event=WS_ERROR, error=${event}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}`, {
            type: 'WS_ERROR',
            event: event,
            id: id,
            headers: headers,
            address: clientAddress
        });
    })
    
    driver.on('close', ({ code, reason }) => {
        //console.log(`${getCurrentDateTime()}: ${id} close`)
        if (!socket.destroyed) {
            socket.destroy();
        }
        console.log(`${getCurrentDateTime()}: ${id} event=WS_CLOSE, code=${code}, reason=${reason}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`);
        sendLogs(Date.now(), `${id} event=WS_CLOSE, code=${code}, reason=${reason}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`, {
            type: 'WS_CLOSE',
            code: code,
            reason: reason,
            cfRay: cfRay,
            id: id,
            headers: headers,
            address: clientAddress,
            metrics: metrics
        });
    })
    
    driver.messages.on('data', (data) => {
        const write = socket.write(data);
        metrics["rx"]["seq"]++;
        metrics["rx"]["size"] = Buffer.byteLength(data);
        metrics["rx"]["lastRcvd"] = new Date().getTime();
    });

    socket.on('data', (chunk) => {
        const result = driver.binary(chunk);
        metrics["tx"]["seq"]++;
        metrics["tx"]["size"] = Buffer.byteLength(chunk);
        metrics["tx"]["lastRcvd"] = new Date().getTime();
    });

    socket.on('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} event=TCP_LOCAL_ERROR, err=${err}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`);
        sendLogs(Date.now(), `${id} event=TCP_LOCAL_ERROR, err=${err}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`, {
            type: 'TCP_LOCAL_ERROR',
            err: err,
            id: id,
            headers: headers,
            address: clientAddress,
            metrics: metrics
        });
    });

    socket.on('close', (err) => {
        driver.close();
        console.log(`${getCurrentDateTime()}: ${id} event=TCP_LOCAL_CLOSED, err=${err}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`);
        sendLogs(Date.now(), `${id} event=TCP_LOCAL_CLOSED, err=${err}, cfRay=${cfRay}, url=${driver.url}, socket=${clientAddress}, rx=${JSON.stringify(metrics["rx"])}, tx=${JSON.stringify(metrics["tx"])}`, {
            type: 'TCP_LOCAL_CLOSED',
            id: id,
            headers: headers,
            address: clientAddress,
            metrics: metrics
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

function convertIPv6ToIPv4(ipv6) {
    // Extract the last two segments of the IPv6 address
    const ipv6Parts = ipv6.split(':');
    const ipv4Hex = ipv6Parts.slice(-2).join('');

    // Split the 8-character string into two-character pairs
    const ipv4Bytes = ipv4Hex.match(/.{1,2}/g);

    // Convert each pair from hex to decimal
    const ipv4 = ipv4Bytes.map(hexPair => parseInt(hexPair, 16)).join('.');

    return ipv4;
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