import { Server } from "socket.io";
import prisma from "../prisma.js";

let io;
const userSocketMap = new Map();

export const initializeSocket = (server) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || "https://kiotapay.co.ke",
    "https://kiotachat-frontend.vercel.app",
    "http://localhost:3000",
  ];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        console.log(`Socket.IO CORS origin check: ${origin}`);
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, origin || "*");
        } else {
          console.error(`Socket.IO CORS rejected: ${origin}`);
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
    },
  });

  io.on("connection", (socket) => {
    console.log(
      "New connection:",
      socket.id,
      "Headers:",
      socket.handshake.headers
    );
    socket.on("register", ({ userId, role }) => {
      if (!userId || isNaN(parseInt(userId, 10))) {
        console.error("Invalid userId during registration:", userId);
        socket.emit("error", { message: "Invalid userId" });
        return;
      }
      console.log(`Registering user with userId ${userId}, role ${role}`);
      // Clear any existing userId for this socket
      for (const [existingUserId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(existingUserId);
          console.log(
            `Cleared previous userId ${existingUserId} for socket ${socket.id}`
          );
        }
      }
      userSocketMap.set(parseInt(userId, 10), socket.id);
    });

    socket.on(
      "private message",
      async ({
        content,
        to,
        from,
        conversationId,
        fileUrl,
        fileType,
        fileSize,
        fileName,
      }) => {
        try {
          const toId = parseInt(to, 10);
          const fromId = parseInt(from, 10);
          const convId = conversationId
            ? parseInt(conversationId, 10)
            : undefined;

          if (!content && !fileUrl) {
            throw new Error("Message content or file is required");
          }
          if (isNaN(toId) || isNaN(fromId)) {
            throw new Error("Invalid sender or recipient ID");
          }

          // Validate sender and recipient exist
          const sender = await prisma.user.findUnique({
            where: { id: fromId },
          });
          const recipient = await prisma.user.findUnique({
            where: { id: toId },
          });
          if (!sender || !recipient) {
            throw new Error("Sender or recipient not found");
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

          const messageData = {
            content: content || "File message",
            senderId: fromId,
            conversationId: conversation.id,
            messageType: fileUrl ? fileType?.split("/")[0] || "file" : "text",
          };

          if (fileUrl) {
            messageData.fileUrl = fileUrl;
            messageData.fileType = fileType;
            messageData.fileSize = fileSize;
            messageData.fileName = fileName;
          }

          const message = await prisma.message.create({
            data: messageData,
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
            isDeleted: message.isDeleted,
            messageType: message.messageType,
            fileUrl: message.fileUrl,
            fileType: message.fileType,
            fileSize: message.fileSize,
            fileName: message.fileName,
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
                where: { isDeleted: false },
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
              sender: {
                ...msg.sender,
                id: String(msg.sender.id),
              },
              isEdited: msg.isEdited,
              isDeleted: msg.isDeleted,
              messageType: msg.messageType,
              fileUrl: msg.fileUrl,
              fileType: msg.fileType,
              fileSize: msg.fileSize,
              fileName: msg.fileName,
            })),
          };

          const socket1Id = userSocketMap.get(
            updatedConversation.participant1.id
          );
          const socket2Id = userSocketMap.get(
            updatedConversation.participant2.id
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
      async ({ messageId, content, from, conversationId, to }) => {
        try {
          const parsedMessageId = parseInt(messageId, 10);
          const fromId = parseInt(from, 10);
          const toId = parseInt(to, 10);
          const convId = parseInt(conversationId, 10);

          if (
            isNaN(parsedMessageId) ||
            isNaN(fromId) ||
            isNaN(toId) ||
            isNaN(convId) ||
            !content.trim()
          ) {
            throw new Error("Invalid message update fields");
          }

          const conversation = await prisma.conversation.findUnique({
            where: { id: convId },
            include: { participant1: true, participant2: true },
          });
          if (!conversation) {
            throw new Error("Conversation not found");
          }

          // Fetch sender details
          const sender = await prisma.user.findUnique({
            where: { id: fromId },
            select: { id: true, fullName: true, email: true, role: true },
          });
          if (!sender) {
            throw new Error("Sender not found");
          }

          const formattedMessage = {
            id: String(parsedMessageId),
            content,
            sender: {
              ...sender,
              id: String(sender.id),
            },
            conversationId: String(convId),
            isEdited: true,
            isDeleted: false,
            createdAt: new Date().toISOString(),
          };

          const recipientId =
            fromId === conversation.participant1.id
              ? conversation.participant2.id
              : conversation.participant1.id;
          const recipientSocketId = userSocketMap.get(recipientId);
          const senderSocketId = userSocketMap.get(fromId);

          if (recipientSocketId) {
            io.to(recipientSocketId).emit("message updated", formattedMessage);
          }
          if (senderSocketId) {
            io.to(senderSocketId).emit("message updated", formattedMessage);
          }
        } catch (error) {
          console.error("Update message error:", error);
          socket.emit("error", {
            message: error.message || "Failed to update message",
          });
        }
      }
    );

    socket.on(
      "message deleted",
      async ({ messageId, from, to, conversationId }) => {
        try {
          const parsedMessageId = parseInt(messageId, 10);
          const fromId = parseInt(from, 10);
          const toId = parseInt(to, 10);
          const convId = parseInt(conversationId, 10);

          if (
            isNaN(parsedMessageId) ||
            isNaN(fromId) ||
            isNaN(toId) ||
            isNaN(convId)
          ) {
            throw new Error("Invalid message deletion fields");
          }

          const conversation = await prisma.conversation.findUnique({
            where: { id: convId },
            include: { participant1: true, participant2: true },
          });
          if (!conversation) {
            throw new Error("Conversation not found");
          }

          const deletedMessage = {
            id: String(parsedMessageId),
            conversationId: String(convId),
            isDeleted: true,
          };

          const recipientId =
            fromId === conversation.participant1.id
              ? conversation.participant2.id
              : conversation.participant1.id;
          const recipientSocketId = userSocketMap.get(recipientId);
          const senderSocketId = userSocketMap.get(fromId);

          if (recipientSocketId) {
            io.to(recipientSocketId).emit("message deleted", deletedMessage);
          }
          if (senderSocketId) {
            io.to(senderSocketId).emit("message deleted", deletedMessage);
          }
        } catch (error) {
          console.error("Delete message error:", error);
          socket.emit("error", {
            message: error.message || "Failed to delete message",
          });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
    });
  });
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};

export { userSocketMap };
