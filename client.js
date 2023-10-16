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

    var init = true;
    let concatBuffer = Buffer.alloc(0); // create empty buffer
    socket.on('data', (chunk) => {
        concatBuffer = Buffer.concat([concatBuffer, chunk]);

        if (init) {
            console.log(concatBuffer.toString());
            init = false;
        }

        if (buffer !== null) {
            buffer.push(concatBuffer);
        };

        while (concatBuffer.length >= 4 * 1024) {
            console.log('trigger 1');
            const data = concatBuffer.slice(0, 4 * 1024);

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
            concatBuffer = buffer.slice(4 * 1024);
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