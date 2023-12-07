const { PORT, HOST } = process.env;

const server = Bun.serve({
    port: PORT,
    tls: {
        cert: Bun.file('../ssl/cert.pem'),
        key: Bun.file('../ssl/privkey.pem')
    },
    fetch: (req, server) => {
        let url = new URL(req.url);
        const id = req.headers.get('x-websocket-id') || url.searchParams['id'] || 'socketid';
        const forwardedFor = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '8.8.8.8';
        const cfRay = req.headers.get('cf-ray') || 'cfRay';
        const upgrade = server.upgrade(req, {
            data: {
                id,
                forwardedFor,
                cfRay
            }
        });
        if (upgrade) return undefined;
        return new Response("OK");
    },
    websocket: {
        perMessageDeflate: false,
        idleTimeout: 0,
        sendPingsAutomatically: false,
        maxBackpressure: 1,
        async open(ws) {
            // on websocket open event
            ws.data.isTcpConnected = false;
            ws.data.rawIp = Buffer.from(ws.remoteAddress).toString('utf-8');
            ws.data.tcpSink = new Bun.ArrayBufferSink();
            ws.data.tcpSink.start({
                stream: true, highWaterMark: 1024
            });
            
            const hostname = HOST.split(':')[0];
            const port = HOST.split(':')[1];

            console.log('ws conenct')

            ws.data.socket = await Bun.connect({
                hostname: '127.0.0.1',
                port: 5201,
                socket: {
                  data(socket, data) {
                    console.log('rcv data');
                    ws.send(data);
                  },
                  open(socket) {
                    console.log('tcp connected')
                    ws.data.isTcpConnected = true;

                    queueMicrotask(() => {
                        console.log('triggered')
                        const data = ws.data.tcpSink.flush();
                        let a = socket.write(data);
                        if (!a) {
                            ws.data.tcpSink.write(data);
                        }
                    })
                  },

                  close(socket) {
                    console.log('c')
                  },
                  drain(socket) {
                    //
                  },
                  error(socket, error) {
                    console.log('e')
                  },
              
                  // client-specific handlers
                  connectError(socket, error) {}, // connection failed
                  end(socket) {}, // connection closed by server
                  timeout(socket) {}, // connection timed out
                },
              });
        },
        async message(ws, message, isBinary) {
            // on websocket receive msg event
            ws.data.tcpSink.write(message);

            queueMicrotask(() => {
                const data = ws.data.tcpSink.flush();
                const b = ws.data.socket.write(data);
                if (!b) {
                    console.log('zero zero')
                    ws.data.tcpSink.write(data);
                }
            })
        },
        async close(ws, code, message) {
            // on websocket close event
            console.log(`${getCurrentDateTime()}: ${ws.data.id} ws closed: cfRay=${ws.data.cfRay}, remote=${ws.data.forwardedFor}, code=${code}, reason=${Buffer.from(message).toString('utf-8')}`)
        }
    }
});

setInterval(() => {
    //server.publish('cfpingtest', Buffer.from('ping'));
}, 5000);

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

console.log(`Listening on localhost:${server.port}`);