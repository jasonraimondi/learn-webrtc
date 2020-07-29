import Server from "socket.io";
import { Server as HttpServer } from "http";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default (req, res) => {
  if (!res.socket.server.io) {
    console.log("*First use, starting socket.io");
    res.socket.server.io = createSocket(res.socket.server);
  } else {
    console.log("socket.io already running");
  }
  res.end();
}


const createSocket = (server: HttpServer) => {
  const io = new Server(server);
  io.on("connection", socket => {
    socket.on("join room", roomId => {
      console.log("room has joined", roomId)
      io.emit("ready")
    });

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
  });
  return io;
}