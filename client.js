const net = require('net');
const WebSocket = require('ws');

// PORT=3000 HOST=wss://gpu6-0.serverdream.net
const { PORT, HOST } = process.env;

const server = new net.Server();

// create tcp server
server.listen(PORT, () => {
    console.log(`${new Date()}: waiting for new conns ${PORT} ${HOST}`);
});

// on new tcp connection
server.on('connection', (socket) => {
    socket.setKeepAlive(true);

    // send to buffer until websocket is connected
    let buffer = [];
    const ws = new WebSocket(HOST);

    ws.on('open', () => {
        console.log(`websocket connected`);
        buffer.forEach((b) => {
            ws.send(b);
        });
        buffer = null;
    });

    ws.on('message', (data) => {
        socket.write(data);
    });

    ws.on('close', (close) => {
        console.log(`websocket closed`);
        socket.end();
    });

    ws.on('error', (err) => {
        console.log('ws error', err);
    });

    var first = true;
    socket.on('data', (chunk) => {
        if (first) {
            console.log(chunk.toString());
            first = false;
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
        console.log('tcp closed');
        setTimeout(() => {
            ws.close();
        }, 2000)
    });

    socket.on('error', (err) => {
        console.log('tcp err', err);
    })
});