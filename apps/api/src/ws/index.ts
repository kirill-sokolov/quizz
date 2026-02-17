import { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { WebSocket } from "ws";

const clients = new Set<WebSocket>();

export function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

export async function wsPlugin(app: FastifyInstance) {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.on("close", () => {
      clients.delete(socket);
    });
  });
}
