import { Server } from "socket.io";
import prisma from "../prisma.js";

let io;
const userSocketMap = new Map();
const adminSocketMap = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    socket.on("register", ({ userId, role }) => {
      if (role === "ADMIN") {
        adminSocketMap.set(userId, socket.id);
      } else {
        userSocketMap.set(userId, socket.id);
      }
      console.log(
        `Registered ${role} with userId ${userId} and socketId ${socket.id}`
      );
    });

    socket.on(
      "private message",
      async ({ content, to, from, conversationId }) => {
        try {
          let conversation = await prisma.conversation.findFirst({
            where: {
              OR: [
                { id: conversationId },
                { AND: [{ userId: to }, { adminId: from }] },
                { AND: [{ userId: from }, { adminId: to }] },
              ],
            },
          });

          if (!conversation) {
            const sender = await prisma.user.findUnique({
              where: { id: from },
              select: { role: true },
            });
            if (!sender) throw new Error("Sender not found");

            conversation = await prisma.conversation.create({
              data: {
                userId: sender.role === "USER" ? from : to,
                adminId: sender.role === "ADMIN" ? from : to,
              },
            });
          }

          const message = await prisma.message.create({
            data: {
              content,
              senderId: from,
              conversationId: conversation.id,
            },
            include: {
              sender: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
            },
          });

          const formattedMessage = {
            ...message,
            createdAt: message.createdAt.toISOString(),
            sender: message.sender,
            conversationId: conversation.id,
          };

          const recipientId =
            from === conversation.userId
              ? conversation.adminId
              : conversation.userId;
          const recipientSocketId =
            userSocketMap.get(recipientId) || adminSocketMap.get(recipientId);

          if (recipientSocketId) {
            io.to(recipientSocketId).emit("private message", formattedMessage);
          }
          socket.emit("private message", formattedMessage);
        } catch (error) {
          console.error("Message send error:", error);
          socket.emit("error", {
            message: error.message || "Failed to send message",
          });
        }
      }
    );

    socket.on("disconnect", () => {
      [...userSocketMap.entries()].forEach(([key, value]) => {
        if (value === socket.id) userSocketMap.delete(key);
      });
      [...adminSocketMap.entries()].forEach(([key, value]) => {
        if (value === socket.id) adminSocketMap.delete(key);
      });
      console.log("Disconnected:", socket.id);
    });
  });
};

export const getIo = () => io;
