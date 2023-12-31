// PORT=3000 HOST=wss://gpu6-0.serverdream.net

function openConnection(id, host) {
    const tcpOpen = performance.now();
    console.log(`${getCurrentDateTime()}: ${id} open ws req`);

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;
    const ws = new WebSocket(`${host}?id=${id}`);

    ws.addEventListener('open', () => {
        console.log(`${getCurrentDateTime()}: ${id} websocket connected (${Math.round(performance.now() - tcpOpen)}ms)`);
        heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send("ping");
            }
        }, 5000)
        buffer = null;
    });

    ws.addEventListener('message', (data) => {
        if (data.toString() === 'ping') {
            return;
        }
    });

    ws.addEventListener('close', (code, reason) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket closed: ${code} ${reason}`);
        clearInterval(heartbeatInterval);
    });

    ws.addEventListener('error', (err) => {
        console.log(`${getCurrentDateTime()}: ${id} websocket error ${err}`);

    })
}

for (var i = 0; i < 100; i++) {
    const id = generateRandomCharacters(6);
    openConnection(id, "wss://uws-test.serverdream.net:8443");
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