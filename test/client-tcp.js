const tls = require('node:tls');
const websocket = require('websocket-driver');

const { PORT, HOST } = process.env;
 
function openConnection(id) {
    const tcpOpen = performance.now();
    console.log(`${getCurrentDateTime()}: ${id} open ws req`);

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;

    const driver = websocket.client(`wss://${HOST}`);
    driver.setHeader('host', HOST);
    driver.setHeader('accept', '*/*');
    driver.setHeader('x-websocket-id', id);
    
    const tcp = tls.connect({
        port: PORT,
        host: HOST,
        servername: HOST
    });
     
    tcp.pipe(driver.io).pipe(tcp);
     
    tcp.on('connect', function() {
      driver.start();
    });

    tcp.on('error', function(error) {
        console.log(`${getCurrentDateTime()}: ${id} tcp LL error: ${error}`);
    });

    tcp.on('close', function(hasError) {
        console.log(`${getCurrentDateTime()}: ${id} tcp LL closed: ${hasError}`);
    });
     
    driver.on('open', function(event) {
        console.log(`${getCurrentDateTime()}: ${id} websocket connected (${Math.round(performance.now() - tcpOpen)}ms)`);
        buffer.forEach((b) => {
            ws.send(b);
        });
        heartbeatInterval = setInterval(() => {
            driver.binary(Buffer.from('ping'))
        }, 5000)
        buffer = null;
    })
    
    driver.on('error', function(event) {
        console.log(`${getCurrentDateTime()}: ${id} websocket error ${event}`);
        clearInterval(heartbeatInterval);
    })
    
    driver.on('close', function({ code, reason }) {
        console.log(`${getCurrentDateTime()}: ${id} close`)
        console.log(`${getCurrentDateTime()}: ${id} websocket closed: ${code} ${reason}`);
    })
    
    driver.messages.on('data', function(message) {
        //
    });
}

for (var i = 0; i < 100; i++) {
    const id = generateRandomCharacters(6);
    openConnection(id);
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