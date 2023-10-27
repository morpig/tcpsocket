// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { PORT, HOST } = process.env;

function openConnection(id) {
    const tcpOpen = performance.now();
    console.log(`${getCurrentDateTime()}: ${id} open ws req`);

    // send to buffer until websocket is connected
    let buffer = [];
    let heartbeatInterval;

    const socket = new WebSocket(HOST);

    // message is received
    socket.addEventListener("message", event => {
        const message = event.data;
        if (message.toString() === 'ping') {
            socket.send('pong');
        }
    });

    socket.addEventListener("open", event => {
        console.log(`${getCurrentDateTime()}: ${id} connected to ws`)
    });

    socket.addEventListener("close", event => {
        console.log(`${getCurrentDateTime()}: ${id} ws closed: code=${event.code} reason=${event.reason} wasClean=${event.wasClean}`)
    });

    socket.addEventListener("error", event => {
        console.log(event);
        console.log(`${getCurrentDateTime()}: ${id} error`)
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