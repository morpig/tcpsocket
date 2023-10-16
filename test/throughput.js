const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/octet-stream');

    const sendInfiniteData = () => {
        if (!res.write(Buffer.alloc(1024 * 1024, 'A'))) {
            // If the internal buffer is full, wait for it to drain before continuing
            res.once('drain', sendInfiniteData);
        } else {
            // Otherwise, keep sending data
            process.nextTick(sendInfiniteData);
        }
    };

    sendInfiniteData();
});

server.listen(PORT, () => {
    console.log(`listening on ${PORT}`);
})