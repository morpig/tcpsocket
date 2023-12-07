// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { PORT, HOST } = process.env;
import TCPWebSocket from "tcp-websocket";

const socket = Bun.listen({
    hostname: '127.0.0.1',
    port: 60443,
    socket: {
      data(socket, data) {
        if (!socket.isConnected) {
            socket.buffer.push(data);
            return;
        }
        socket.ws.send(data);
      },
      open(socket) {
        console.log('hello')
        const tcpOpen = performance.now();
        const id = generateRandomCharacters(6);
    
        console.log(`${getCurrentDateTime()}: ${id} tcp open`)
        console.log(HOST);
    
        // send to buffer until websocket is connected
        socket.buffer = [];
        socket.isConnected = false;
        let heartbeatInterval;
        socket.ws = new TCPWebSocket(HOST, {
            headers: {
                'x-websocket-id': id
            }
        });

        socket.ws.on("message", (event) => {
            console.log(event);
            const message = event.data;
            if (message === 'ping') {
                return;
            }
            socket.write(event.data);
        });    

        socket.ws.on("open", (event) => {
            socket.buffer.forEach((b) => {
                console.log('send');
                console.log(socket.ws);
                let a = socket.ws.send(b);
                console.log(b);
            });
            socket.ws.send("hall")
            socket.buffer = [];
            socket.isConnected = true;
            console.log(`${getCurrentDateTime()}: ${id} connected to ws time=${Math.round(performance.now() - tcpOpen)}ms`);
        });
    
        socket.ws.on("close", event => {
            console.log(`${getCurrentDateTime()}: ${id} ws closed: code=${event.code} reason=${event.reason} wasClean=${event.wasClean}`)
        });
    
        socket.ws.on("error", event => {
            console.log(`${getCurrentDateTime()}: ${id} ws errored: ${event}`)
        });
      },
      close(socket) {},
      drain(socket) {},
      error(socket, error) {},
  
      // client-specific handlers
      connectError(socket, error) {}, // connection failed
      end(socket) {}, // connection closed by server
      timeout(socket) {}, // connection timed out
    },
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