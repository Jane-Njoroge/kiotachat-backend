import { Server } from "socket.io";
import prisma from "../prisma.js";

let io;
const userSocketMap = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    },
  });

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);
    socket.on("register", ({ userId, role }) => {
      if (!userId || isNaN(parseInt(userId, 10))) {
        console.error("Invalid userId during registration:", userId);
        socket.emit("error", { message: "Invalid userId" });
        return;
      }
      console.log(`Registering user with userId ${userId}, role ${role}`);
      userSocketMap.set(parseInt(userId, 10), socket.id);
    });

    socket.on(
      "private message",
      async ({ content, to, from, conversationId }) => {
        try {
          // Validate inputs
          const toId = parseInt(to, 10);
          const fromId = parseInt(from, 10);
          const convId = conversationId
            ? parseInt(conversationId, 10)
            : undefined;

          if (!content || isNaN(toId) || isNaN(fromId)) {
            throw new Error("Missing or invalid message fields");
          }

          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: {
              OR: [
                { id: convId },
                { participant1Id: fromId, participant2Id: toId },
                { participant1Id: toId, participant2Id: fromId },
              ],
            },
            include: { participant1: true, participant2: true },
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                participant1Id: fromId,
                participant2Id: toId,
                unread: 1,
              },
              include: { participant1: true, participant2: true },
            });
          }

          // Create message
          const message = await prisma.message.create({
            data: {
              content,
              senderId: fromId,
              conversationId: conversation.id,
            },
            include: {
              sender: {
                select: { id: true, fullName: true, email: true, role: true },
              },
            },
          });

          const formattedMessage = {
            id: String(message.id),
            content: message.content,
            senderId: message.senderId,
            sender: message.sender,
            createdAt: message.createdAt.toISOString(),
            conversationId: conversation.id,
          };

          const recipientId =
            fromId === conversation.participant1Id
              ? conversation.participant2Id
              : conversation.participant1Id;
          const recipientSocketId = userSocketMap.get(recipientId);

          if (recipientSocketId) {
            io.to(recipientSocketId).emit("private message", formattedMessage);
          } else {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { unread: { increment: 1 } },
            });
          }
          socket.emit("private message", formattedMessage);

          const updatedConversation = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            include: {
              participant1: {
                select: { id: true, fullName: true, email: true, role: true },
              },
              participant2: {
                select: { id: true, fullName: true, email: true, role: true },
              },
              messages: {
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
                orderBy: { createdAt: "asc" },
              },
            },
          });

          if (!updatedConversation) {
            throw new Error("Failed to fetch updated conversation");
          }

          const socket1Id = userSocketMap.get(
            updatedConversation.participant1Id
          );
          const socket2Id = userSocketMap.get(
            updatedConversation.participant2Id
          );
          if (socket1Id) {
            io.to(socket1Id).emit("conversation updated", updatedConversation);
          }
          if (socket2Id) {
            io.to(socket2Id).emit("conversation updated", updatedConversation);
          }
        } catch (error) {
          console.error("Message send error:", error);
          socket.emit("error", {
            message: error.message || "Failed to send message",
          });
        }
      }
    );

    socket.on("conversation opened", async ({ conversationId }) => {
      try {
        if (!conversationId || isNaN(parseInt(conversationId, 10))) {
          throw new Error("Valid conversationId is required");
        }
        const conversation = await prisma.conversation.update({
          where: { id: parseInt(conversationId, 10) },
          data: { unread: 0 },
          include: {
            participant1: {
              select: { id: true, fullName: true, email: true, role: true },
            },
            participant2: {
              select: { id: true, fullName: true, email: true, role: true },
            },
            messages: {
              include: {
                sender: {
                  select: { id: true, fullName: true, email: true, role: true },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        const socket1Id = userSocketMap.get(conversation.participant1Id);
        const socket2Id = userSocketMap.get(conversation.participant2Id);
        if (socket1Id) {
          io.to(socket1Id).emit("conversation updated", conversation);
        }
        if (socket2Id) {
          io.to(socket2Id).emit("conversation updated", conversation);
        }

        console.log(`Conversation ${conversationId} opened, unread reset`);
      } catch (error) {
        console.error("Conversation Fetched:", error);
        socket.emit("error", {
          message: error.message || "Failed to update conversation",
        });
      }
    });

    socket.on("disconnect", () => {
      [...userSocketMap.entries()].forEach(([key, value]) => {
        if (value === socket.id) userSocketMap.delete(key);
      });
      console.log("Disconnected:", socket.id);
    });
  });
};

export const getIo = () => io;
export { userSocketMap };
