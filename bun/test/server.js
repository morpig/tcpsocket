const { PORT, HOST } = process.env;

const server = Bun.serve({
    port: PORT,
    tls: {
        cert: Bun.file('../../ssl/cert.pem'),
        key: Bun.file('../../ssl/privkey.pem')
    },
    fetch: (req, server) => {
        let url = new URL(req.url);
        const id = req.headers['x-websocket-id'] || url.searchParams['id'] || 'socketid';
        const forwardedFor = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '8.8.8.8';
        const cfRay = req.headers['cf-ray'] || 'cfRay';
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
        async open(ws) {
            // on websocket open event
            ws.subscribe('cfpingtest');
            ws.send('connect-ping');
            ws.data.rawIp = Buffer.from(ws.remoteAddress).toString('utf-8');
            console.log(`${getCurrentDateTime()}: ${ws.data.id} ws open: cfRay=${ws.data.cfRay}, remote=${ws.data.forwardedFor}, rawIp: ${Buffer.from(ws.remoteAddress).toString('utf-8')}`);
        },
        async message(ws, message, isBinary) {
            // on websocket receive msg event
            const buffer = Buffer.from(message);
            console.log(message);
            if (buffer.toString('utf-8') === 'ping') {
                ws.send(Buffer.from('ping'))
            }
        },
        async close(ws, code, message) {
            // on websocket close event
            console.log(`${getCurrentDateTime()}: ${ws.data.id} ws closed: cfRay=${ws.data.cfRay}, remote=${ws.data.forwardedFor}, code=${code}, reason=${Buffer.from(message).toString('utf-8')}`)
        }
    }
});

setInterval(() => {
    server.publish('cfpingtest', Buffer.from('ping'));
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