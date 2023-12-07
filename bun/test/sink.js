let data = await Bun.connect({
  hostname: '127.0.0.1',
  port: 5201,
  socket: {
    data: () => {

    },
    drain: () => {

    }
  }
});

console.log(data);