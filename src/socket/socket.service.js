// import { Server } from "socket.io";
// import prisma from "../prisma.js";

// let io;
// const userSocketMap = new Map();

// export const initializeSocket = (server) => {
//   io = new Server(server, {
//     cors: {
//       origin: process.env.FRONTEND_URL || "http://localhost:3000",
//       methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//       credentials: true,
//       allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
//     },
//   });

//   io.on("connection", (socket) => {
//     console.log(
//       "New connection:",
//       socket.id,
//       "Headers:",
//       socket.handshake.headers
//     );
//     socket.on("register", ({ userId, role }) => {
//       if (!userId || isNaN(parseInt(userId, 10))) {
//         console.error("Invalid userId during registration:", userId);
//         socket.emit("error", { message: "Invalid userId" });
//         return;
//       }
//       console.log(`Registering user with userId ${userId}, role ${role}`);
//       userSocketMap.set(parseInt(userId, 10), socket.id);
//     });

//     socket.on(
//       "private message",
//       async ({ content, to, from, conversationId }) => {
//         try {
//           const toId = parseInt(to, 10);
//           const fromId = parseInt(from, 10);
//           const convId = conversationId
//             ? parseInt(conversationId, 10)
//             : undefined;

//           if (!content || isNaN(toId) || isNaN(fromId)) {
//             throw new Error("Missing or invalid message fields");
//           }

//           let conversation = await prisma.conversation.findFirst({
//             where: {
//               OR: [
//                 { id: convId },
//                 { participant1Id: fromId, participant2Id: toId },
//                 { participant1Id: toId, participant2Id: fromId },
//               ],
//             },
//             include: { participant1: true, participant2: true },
//           });

//           if (!conversation) {
//             conversation = await prisma.conversation.create({
//               data: {
//                 participant1Id: fromId,
//                 participant2Id: toId,
//                 unread: 1,
//               },
//               include: { participant1: true, participant2: true },
//             });
//           }

//           const message = await prisma.message.create({
//             data: {
//               content,
//               senderId: fromId,
//               conversationId: conversation.id,
//             },
//             include: {
//               sender: {
//                 select: { id: true, fullName: true, email: true, role: true },
//               },
//             },
//           });

//           const formattedMessage = {
//             id: String(message.id),
//             content: message.content,
//             sender: {
//               ...message.sender,
//               id: String(message.sender.id),
//             },
//             createdAt: message.createdAt.toISOString(),
//             conversationId: String(conversation.id),
//             isEdited: message.isEdited,
//             isDeleted: message.isDeleted,
//           };

//           const recipientId =
//             fromId === conversation.participant1Id
//               ? conversation.participant2Id
//               : conversation.participant1Id;
//           const recipientSocketId = userSocketMap.get(recipientId);

//           if (recipientSocketId) {
//             io.to(recipientSocketId).emit("private message", formattedMessage);
//           } else {
//             await prisma.conversation.update({
//               where: { id: conversation.id },
//               data: { unread: { increment: 1 } },
//             });
//           }
//           socket.emit("private message", formattedMessage);

//           const updatedConversation = await prisma.conversation.findUnique({
//             where: { id: conversation.id },
//             include: {
//               participant1: {
//                 select: { id: true, fullName: true, email: true, role: true },
//               },
//               participant2: {
//                 select: { id: true, fullName: true, email: true, role: true },
//               },
//               messages: {
//                 where: { isDeleted: false },
//                 include: {
//                   sender: {
//                     select: {
//                       id: true,
//                       fullName: true,
//                       email: true,
//                       role: true,
//                     },
//                   },
//                 },
//                 orderBy: { createdAt: "desc" },
//                 take: 1,
//               },
//             },
//           });

//           if (!updatedConversation) {
//             throw new Error("Failed to fetch updated conversation");
//           }

//           const normalizedConversation = {
//             ...updatedConversation,
//             id: String(updatedConversation.id),
//             participant1: {
//               ...updatedConversation.participant1,
//               id: String(updatedConversation.participant1.id),
//             },
//             participant2: {
//               ...updatedConversation.participant2,
//               id: String(updatedConversation.participant2.id),
//             },
//             messages: updatedConversation.messages.map((msg) => ({
//               ...msg,
//               id: String(msg.id),
//               sender: { ...msg.sender, id: String(msg.sender.id) },
//               isEdited: msg.isEdited,
//               isDeleted: msg.isDeleted,
//             })),
//           };

//           const socket1Id = userSocketMap.get(
//             updatedConversation.participant1Id
//           );
//           const socket2Id = userSocketMap.get(
//             updatedConversation.participant2Id
//           );
//           if (socket1Id) {
//             io.to(socket1Id).emit(
//               "conversation updated",
//               normalizedConversation
//             );
//           }
//           if (socket2Id) {
//             io.to(socket2Id).emit(
//               "conversation updated",
//               normalizedConversation
//             );
//           }
//         } catch (error) {
//           console.error("Message send error:", error);
//           socket.emit("error", {
//             message: error.message || "Failed to send message",
//           });
//         }
//       }
//     );

//     socket.on(
//       "message updated",
//       async ({ message, to, from, conversationId }) => {
//         try {
//           const toId = parseInt(to, 10);
//           const fromId = parseInt(from, 10);
//           const convId = parseInt(conversationId, 10);
//           if (!message || isNaN(toId) || isNaN(fromId) || isNaN(convId)) {
//             throw new Error("Invalid message update fields");
//           }

//           const formattedMessage = {
//             ...message,
//             id: String(message.id),
//             sender: { ...message.sender, id: String(message.sender.id) },
//             conversationId: String(convId),
//             isEdited: true, // Ensure isEdited is set
//             isDeleted: message.isDeleted || false,
//           };

//           const conversation = await prisma.conversation.findUnique({
//             where: { id: convId },
//             include: { participant1: true, participant2: true },
//           });
//           if (!conversation) {
//             throw new Error("Conversation not found");
//           }

//           const recipientId =
//             fromId === conversation.participant1Id
//               ? conversation.participant2Id
//               : conversation.participant1Id;
//           const recipientSocketId = userSocketMap.get(recipientId);
//           const senderSocketId = userSocketMap.get(fromId);

//           console.log(
//             `Emitting message updated: messageId=${message.id}, conversationId=${convId}`
//           );
//           if (recipientSocketId) {
//             io.to(recipientSocketId).emit("message updated", formattedMessage);
//             console.log(`Sent to recipient socketId=${recipientSocketId}`);
//           }
//           if (senderSocketId) {
//             io.to(senderSocketId).emit("message updated", formattedMessage);
//             console.log(`Sent to sender socketId=${senderSocketId}`);
//           }
//         } catch (error) {
//           console.error("Message update error:", error);
//           socket.emit("error", {
//             message: error.message || "Failed to update message",
//           });
//         }
//       }
//     );

//     socket.on("message deleted", async ({ messageId, conversationId }) => {
//       try {
//         const convId = parseInt(conversationId, 10);
//         if (!messageId || isNaN(parseInt(messageId, 10)) || isNaN(convId)) {
//           throw new Error("Valid messageId and conversationId are required");
//         }

//         const conversation = await prisma.conversation.findUnique({
//           where: { id: convId },
//           include: { participant1: true, participant2: true },
//         });
//         if (!conversation) {
//           throw new Error("Conversation not found");
//         }

//         const deletedMessage = {
//           id: String(messageId),
//           conversationId: String(convId),
//           isDeleted: true,
//         };

//         const socket1Id = userSocketMap.get(conversation.participant1Id);
//         const socket2Id = userSocketMap.get(conversation.participant2Id);

//         console.log(
//           `Emitting message deleted event: messageId=${messageId}, conversationId=${convId}`
//         );
//         console.log(
//           `Participant 1 socketId: ${socket1Id}, Participant 2 socketId: ${socket2Id}`
//         );

//         if (socket1Id) {
//           io.to(socket1Id).emit("message deleted", deletedMessage);
//           console.log(
//             `Sent message deleted to participant1Id=${conversation.participant1Id}, socketId=${socket1Id}`
//           );
//         } else {
//           console.warn(
//             `No socket found for participant1Id=${conversation.participant1Id}`
//           );
//         }
//         if (socket2Id) {
//           io.to(socket2Id).emit("message deleted", deletedMessage);
//           console.log(
//             `Sent message deleted to participant2Id=${conversation.participant2Id}, socketId=${socket2Id}`
//           );
//         } else {
//           console.warn(
//             `No socket found for participant2Id=${conversation.participant2Id}`
//           );
//         }
//       } catch (error) {
//         console.error("Message delete error:", error);
//         socket.emit("error", {
//           message: error.message || "Failed to delete message",
//         });
//       }
//     });
//     socket.on("conversation opened", async ({ conversationId }) => {
//       try {
//         if (!conversationId || isNaN(parseInt(conversationId, 10))) {
//           throw new Error("Valid conversationId is required");
//         }
//         const conversation = await prisma.conversation.update({
//           where: { id: parseInt(conversationId, 10) },
//           data: { unread: 0 },
//           include: {
//             participant1: {
//               select: { id: true, fullName: true, email: true, role: true },
//             },
//             participant2: {
//               select: { id: true, fullName: true, email: true, role: true },
//             },
//             messages: {
//               where: { isDeleted: false },
//               include: {
//                 sender: {
//                   select: { id: true, fullName: true, email: true, role: true },
//                 },
//               },
//               orderBy: { createdAt: "desc" },
//               take: 1,
//             },
//           },
//         });

//         const normalizedConversation = {
//           ...conversation,
//           id: String(conversation.id),
//           participant1: {
//             ...conversation.participant1,
//             id: String(conversation.participant1.id),
//           },
//           participant2: {
//             ...conversation.participant2,
//             id: String(conversation.participant2.id),
//           },
//           messages: conversation.messages.map((msg) => ({
//             ...msg,
//             id: String(msg.id),
//             sender: { ...msg.sender, id: String(msg.sender.id) },
//             isEdited: msg.isEdited,
//             isDeleted: msg.isDeleted,
//           })),
//         };

//         const socket1Id = userSocketMap.get(conversation.participant1Id);
//         const socket2Id = userSocketMap.get(conversation.participant2Id);
//         if (socket1Id) {
//           io.to(socket1Id).emit("conversation updated", normalizedConversation);
//         }
//         if (socket2Id) {
//           io.to(socket2Id).emit("conversation updated", normalizedConversation);
//         }

//         console.log(`Conversation ${conversationId} opened, unread reset`);
//       } catch (error) {
//         console.error("Conversation opened error:", error);
//         socket.emit("error", {
//           message: error.message || "Failed to update conversation",
//         });
//       }
//     });

//     socket.on("disconnect", () => {
//       [...userSocketMap.entries()].forEach(([key, value]) => {
//         if (value === socket.id) userSocketMap.delete(key);
//       });
//       console.log("Disconnected:", socket.id);
//     });
//   });
// };

// export const getIo = () => io;
// export { userSocketMap };
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
            isDeleted: message.isDeleted,
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
              sender: {
                ...msg.sender,
                id: String(msg.sender.id),
              },
              isEdited: msg.isEdited,
              isDeleted: msg.isDeleted,
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
            createdAt: new Date().toISOString(), // Use current time or fetch original message's createdAt if needed
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
