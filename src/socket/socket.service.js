import { Server } from "socket.io";
import prisma from "../prisma.js";

let io;
const userSocketMap = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
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
          const toId = parseInt(to, 10);
          const fromId = parseInt(from, 10);
          const convId = conversationId
            ? parseInt(conversationId, 10)
            : undefined;

          if (!content || isNaN(toId) || isNaN(fromId)) {
            throw new Error("Missing or invalid message fields");
          }

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
            sender: {
              ...message.sender,
              id: String(message.sender.id),
            },
            createdAt: message.createdAt.toISOString(),
            conversationId: String(conversation.id),
            isEdited: message.isEdited,
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
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          });

          if (!updatedConversation) {
            throw new Error("Failed to fetch updated conversation");
          }

          const normalizedConversation = {
            ...updatedConversation,
            id: String(updatedConversation.id),
            participant1: {
              ...updatedConversation.participant1,
              id: String(updatedConversation.participant1.id),
            },
            participant2: {
              ...updatedConversation.participant2,
              id: String(updatedConversation.participant2.id),
            },
            messages: updatedConversation.messages.map((msg) => ({
              ...msg,
              id: String(msg.id),
              sender: { ...msg.sender, id: String(msg.sender.id) },
              isEdited: msg.isEdited,
            })),
          };

          const socket1Id = userSocketMap.get(
            updatedConversation.participant1Id
          );
          const socket2Id = userSocketMap.get(
            updatedConversation.participant2Id
          );
          if (socket1Id) {
            io.to(socket1Id).emit(
              "conversation updated",
              normalizedConversation
            );
          }
          if (socket2Id) {
            io.to(socket2Id).emit(
              "conversation updated",
              normalizedConversation
            );
          }
        } catch (error) {
          console.error("Message send error:", error);
          socket.emit("error", {
            message: error.message || "Failed to send message",
          });
        }
      }
    );

    socket.on(
      "message updated",
      async ({ message, to, from, conversationId }) => {
        try {
          const toId = parseInt(to, 10);
          const fromId = parseInt(from, 10);
          const convId = parseInt(conversationId, 10);
          if (!message || isNaN(toId) || isNaN(fromId) || isNaN(convId)) {
            throw new Error("Invalid message update fields");
          }

          const formattedMessage = {
            ...message,
            id: String(message.id),
            sender: { ...message.sender, id: String(message.sender.id) },
            conversationId: String(convId),
            isEdited: message.isEdited,
          };

          const conversation = await prisma.conversation.findUnique({
            where: { id: convId },
            include: { participant1: true, participant2: true },
          });
          if (!conversation) {
            throw new Error("Conversation not found");
          }

          const recipientId =
            fromId === conversation.participant1Id
              ? conversation.participant2Id
              : conversation.participant1Id;
          const recipientSocketId = userSocketMap.get(recipientId);
          const senderSocketId = userSocketMap.get(fromId);

          if (recipientSocketId) {
            io.to(recipientSocketId).emit("message updated", formattedMessage);
          }
          if (senderSocketId) {
            io.to(senderSocketId).emit("message updated", formattedMessage);
          }
        } catch (error) {
          console.error("Message update error:", error);
          socket.emit("error", {
            message: error.message || "Failed to update message",
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

        const normalizedConversation = {
          ...conversation,
          id: String(conversation.id),
          participant1: {
            ...conversation.participant1,
            id: String(conversation.participant1.id),
          },
          participant2: {
            ...conversation.participant2,
            id: String(conversation.participant2.id),
          },
          messages: conversation.messages.map((msg) => ({
            ...msg,
            id: String(msg.id),
            sender: { ...msg.sender, id: String(msg.sender.id) },
            isEdited: msg.isEdited,
          })),
        };

        const socket1Id = userSocketMap.get(conversation.participant1Id);
        const socket2Id = userSocketMap.get(conversation.participant2Id);
        if (socket1Id) {
          io.to(socket1Id).emit("conversation updated", normalizedConversation);
        }
        if (socket2Id) {
          io.to(socket2Id).emit("conversation updated", normalizedConversation);
        }

        console.log(`Conversation ${conversationId} opened, unread reset`);
      } catch (error) {
        console.error("Conversation opened error:", error);
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
