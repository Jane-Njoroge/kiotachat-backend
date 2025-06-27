// import { generateOtp } from "../utils/generateOtp.js";
// import userService from "./user.service.js";
// import { getIo, userSocketMap } from "../socket/socket.service.js";
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// import prisma from "../prisma.js";

// const s3Client = new S3Client({
//   credentials: {
//     accessKeyId: process.env.ACCESS_ID,
//     secretAccessKey: process.env.AWS_SECRET_KEY,
//   },
// });

// const userController = {
//   async register(req, res) {
//     try {
//       const { fullName, email, phoneNumber, password } = req.body;
//       if (!fullName || !email || !phoneNumber || !password) {
//         return res.status(400).json({ message: "All fields are required" });
//       }
//       const result = await userService.registerUser({
//         fullName,
//         email,
//         phoneNumber,
//         password,
//       });
//       res.status(201).json(result);
//     } catch (error) {
//       console.error("Registration error:", error);
//       res.status(400).json({ message: error.message || "Registration failed" });
//     }
//   },

//   async login(req, res) {
//     console.time("login");
//     try {
//       const { email, password } = req.body;
//       console.log("Login attempt:", { email });
//       if (!email || !password) {
//         return res
//           .status(400)
//           .json({ message: "Email and password are required" });
//       }
//       const result = await userService.loginUser(email, password);
//       console.timeEnd("login");
//       res.json(result);
//     } catch (error) {
//       console.error("Login error:", {
//         message: error.message,
//         stack: error.stack,
//         email: req.body.email,
//       });
//       console.timeEnd("login");
//       res.status(400).json({ message: error.message || "Login failed" });
//     }
//   },

//   async generateOtp(req, res) {
//     try {
//       const { email } = req.body;
//       if (!email) {
//         return res.status(400).json({ message: "Email is required" });
//       }
//       const result = await userService.generateUserOtp(email);
//       res.json(result);
//     } catch (error) {
//       console.error("Generate OTP error:", error);
//       res
//         .status(400)
//         .json({ message: error.message || "Failed to generate OTP" });
//     }
//   },

//   async verifyOtp(req, res) {
//     const { email, otp } = req.body;
//     try {
//       console.log("Verify OTP request:", {
//         email,
//         otp,
//         cookies: req.cookies,
//         headers: req.headers,
//       });
//       if (!email || !otp) {
//         return res.status(400).json({ message: "Email and OTP are required" });
//       }
//       const user = await prisma.user.findUnique({ where: { email } });
//       if (!user) {
//         console.log("User not found for email:", email);
//         return res.status(404).json({ message: "User not found" });
//       }
//       console.log("Found user:", { userId: user.id, role: user.role });
//       const result = await userService.verifyUserOtp(email, otp);

//       res.clearCookie("userId", {
//         httpOnly: true,
//         secure: true,
//         sameSite: "none",
//         path: "/",
//       });
//       res.clearCookie("userRole", {
//         httpOnly: true,
//         secure: true,
//         sameSite: "none",
//         path: "/",
//       });

//       res.cookie("userId", result.userId.toString(), {
//         httpOnly: true,
//         secure: true,
//         sameSite: "none",
//         path: "/",
//         maxAge: 24 * 60 * 60 * 1000,
//       });
//       res.cookie("userRole", result.role, {
//         httpOnly: true,
//         secure: true,
//         sameSite: "none",
//         path: "/",
//         maxAge: 24 * 60 * 60 * 1000,
//       });
//       console.log("Cookies set:", {
//         userId: result.userId,
//         userRole: result.role,
//         secure: true,
//         sameSite: "none",
//       });
//       res.json({
//         message: "OTP verified successfully",
//         userId: String(result.userId),
//         fullName: result.fullName,
//         role: result.role,
//         email: user.email,
//       });
//     } catch (error) {
//       console.error("OTP verification error:", {
//         message: error.message,
//         stack: error.stack,
//         email,
//         otp,
//       });
//       res.status(400).json({ message: error.message || "Invalid OTP" });
//     }
//   },
//   async uploadFile(req, res) {
//     try {
//       console.log("Upload file request:", {
//         body: req.body,
//         cookies: req.cookies,
//         headers: req.headers,
//         file: req.file,
//       });

//       const userId = parseInt(
//         req.cookies.userId || req.headers["x-user-id"],
//         10
//       );
//       if (!userId || isNaN(userId)) {
//         console.log("Invalid userId:", { userId });
//         return res.status(401).json({ message: "Authentication required" });
//       }

//       const user = await prisma.user.findUnique({ where: { id: userId } });
//       if (!user) {
//         console.log("User not found:", { userId });
//         return res.status(401).json({ message: "User not found" });
//       }

//       if (!req.file) {
//         console.log("No file provided in request");
//         return res.status(400).json({ message: "No file uploaded" });
//       }

//       const { to, conversationId } = req.body;
//       const toId = parseInt(to, 10);
//       const convId = conversationId ? parseInt(conversationId, 10) : undefined;

//       if (!toId || isNaN(toId)) {
//         console.log("Invalid recipient ID:", { to });
//         return res.status(400).json({ message: "Recipient ID is required" });
//       }

//       const recipient = await prisma.user.findUnique({ where: { id: toId } });
//       if (!recipient) {
//         console.log("Recipient not found:", { toId });
//         return res.status(400).json({ message: "Recipient not found" });
//       }

//       const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//       const fileKey = `uploads/${uniqueSuffix}-${req.file.originalname}`;
//       const uploadParams = {
//         Bucket: process.env.AWS_S3_BUCKET_NAME || process.env.BUCKET_NAME,
//         Key: fileKey,
//         Body: req.file.buffer,
//         ContentType: req.file.mimetype,
//         ACL: "public-read",
//       };

//       await s3Client.send(new PutObjectCommand(uploadParams));
//       const fileUrl = `https://${uploadParams.Bucket}.s3.amazonaws.com/${fileKey}`;
//       const fileType = req.file.mimetype;
//       const fileSize = req.file.size;
//       const fileName = req.file.originalname;

//       console.log("Sending file message:", {
//         userId,
//         toId,
//         conversationId: convId,
//         fileUrl,
//         fileType,
//         fileSize,
//         fileName,
//       });

//       const message = await userService.sendFileMessage({
//         userId,
//         toId,
//         conversationId: convId,
//         fileUrl,
//         fileType,
//         fileSize,
//         fileName,
//       });

//       const io = getIo();
//       io.to(String(convId)).emit("private message", message);

//       res.status(201).json({
//         message: "File uploaded successfully",
//         data: message,
//       });
//     } catch (error) {
//       console.error("File upload error:", {
//         message: error.message,
//         stack: error.stack,
//         body: req.body,
//         cookies: req.cookies,
//       });
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to upload file" });
//     }
//   },

//   async getUsers(req, res) {
//     try {
//       const { role } = req.query;
//       const users = await userService.getAllUsers(role);
//       res.json(users);
//     } catch (error) {
//       console.error("Get users error:", error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to fetch users" });
//     }
//   },

//   async getAdmins(req, res) {
//     try {
//       const { excludeUserId } = req.query;
//       if (!excludeUserId || isNaN(parseInt(excludeUserId, 10))) {
//         return res
//           .status(400)
//           .json({ message: "Valid excludeUserId is required" });
//       }
//       const admins = await userService.getAdmins(excludeUserId);
//       res.json(admins);
//     } catch (error) {
//       console.error("Get admins error:", error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to fetch admins" });
//     }
//   },

//   async createConversation(req, res) {
//     try {
//       const { participant1Id, participant2Id } = req.body;
//       console.log("POST /conversations received:", {
//         participant1Id,
//         participant2Id,
//       });
//       if (!participant1Id || !participant2Id) {
//         return res
//           .status(400)
//           .json({ message: "Both participant IDs are required" });
//       }
//       if (
//         isNaN(parseInt(participant1Id, 10)) ||
//         isNaN(parseInt(participant2Id, 10))
//       ) {
//         return res
//           .status(400)
//           .json({ message: "Participant IDs must be valid numbers" });
//       }
//       const conversation = await userService.createConversation(
//         participant1Id,
//         participant2Id
//       );
//       res.status(201).json(conversation);
//     } catch (error) {
//       console.error("Create conversation error:", error);
//       res
//         .status(400)
//         .json({ message: error.message || "Failed to create conversation" });
//     }
//   },

//   async forwardMessage(req, res) {
//     try {
//       const { messageId, recipientIds, content } = req.body;
//       const userId = req.userId;
//       if (!userId || isNaN(parseInt(userId, 10))) {
//         return res.status(401).json({ message: "Authentication required" });
//       }
//       if (
//         !messageId ||
//         !recipientIds ||
//         !Array.isArray(recipientIds) ||
//         !recipientIds.length ||
//         !content
//       ) {
//         return res.status(400).json({
//           message:
//             "Valid messageId, recipientIds (non-empty array), and content are required",
//         });
//       }
//       if (recipientIds.includes(String(userId))) {
//         return res
//           .status(400)
//           .json({ message: "Cannot forward message to yourself" });
//       }
//       const forwardedMessages = await userService.forwardMessage(
//         messageId,
//         userId,
//         recipientIds,
//         content
//       );

//       const io = getIo();
//       for (const message of forwardedMessages) {
//         const conversation = await prisma.conversation.findUnique({
//           where: { id: parseInt(message.conversationId, 10) },
//           include: { participant1: true, participant2: true },
//         });
//         if (conversation) {
//           const recipientId =
//             parseInt(userId, 10) === conversation.participant1Id
//               ? conversation.participant2Id
//               : conversation.participant1Id;
//           const recipientSocketId = userSocketMap.get(recipientId);
//           const senderSocketId = userSocketMap.get(parseInt(userId, 10));

//           if (recipientSocketId) {
//             io.to(recipientSocketId).emit("private message", message);
//           }
//           if (senderSocketId) {
//             io.to(senderSocketId).emit("private message", message);
//           }

//           const updatedConversation = await prisma.conversation.findUnique({
//             where: { id: parseInt(message.conversationId, 10) },
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
//               },
//             },
//           });

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
//               messageType: msg.messageType,
//               fileUrl: msg.fileUrl,
//               fileType: msg.fileType,
//               fileSize: msg.fileSize,
//               fileName: msg.fileName,
//               isForwarded: msg.isForwarded,
//             })),
//           };

//           if (recipientSocketId) {
//             io.to(recipientSocketId).emit(
//               "conversation updated",
//               normalizedConversation
//             );
//           }
//           if (senderSocketId) {
//             io.to(senderSocketId).emit(
//               "conversation updated",
//               normalizedConversation
//             );
//           }
//         }
//       }

//       res.json({
//         message: "Message forwarded successfully",
//         forwardedMessages,
//       });
//     } catch (error) {
//       console.error("Forward message error:", error);
//       res
//         .status(400)
//         .json({ message: error.message || "Failed to forward message" });
//     }
//   },

//   async updateMessage(req, res) {
//     try {
//       const { messageId } = req.params;
//       const { content } = req.body;
//       const userId = req.userId;
//       console.log("PUT /messages/:messageId received:", {
//         messageId,
//         content,
//         userId,
//         body: req.body,
//         headers: req.headers,
//         cookies: req.cookies,
//       });
//       if (!userId || isNaN(parseInt(userId, 10))) {
//         console.log("Missing or invalid userId:", { userId });
//         return res.status(401).json({ message: "Authentication required" });
//       }
//       if (!messageId || !content || isNaN(parseInt(messageId, 10))) {
//         console.log("Validation failed:", { messageId, content, userId });
//         return res
//           .status(400)
//           .json({ message: "Valid messageId and content are required" });
//       }
//       const message = await userService.updateMessage(
//         messageId,
//         content,
//         userId
//       );

//       const io = getIo();
//       const conversation = await prisma.conversation.findUnique({
//         where: { id: parseInt(message.conversationId, 10) },
//         include: { participant1: true, participant2: true },
//       });
//       if (conversation) {
//         const recipientId =
//           parseInt(userId, 10) === conversation.participant1Id
//             ? conversation.participant2Id
//             : conversation.participant1Id;
//         const recipientSocketId = userSocketMap.get(recipientId);
//         const senderSocketId = userSocketMap.get(parseInt(userId, 10));

//         if (recipientSocketId) {
//           io.to(recipientSocketId).emit("message updated", message);
//         }
//         if (senderSocketId) {
//           io.to(senderSocketId).emit("message updated", message);
//         }
//       }

//       res.json(message);
//     } catch (error) {
//       console.error("Update message error:", error);
//       res
//         .status(400)
//         .json({ message: error.message || "Failed to update message" });
//     }
//   },

//   async deleteMessage(req, res) {
//     try {
//       const { messageId } = req.params;
//       const userId = req.userId;
//       console.log("DELETE /messages/:messageId received:", {
//         messageId,
//         userId,
//         headers: req.headers,
//         cookies: req.cookies,
//       });
//       if (!userId || isNaN(parseInt(userId, 10))) {
//         console.log("Missing or invalid userId:", { userId });
//         return res.status(401).json({ message: "Authentication required" });
//       }
//       if (!messageId || isNaN(parseInt(messageId, 10))) {
//         console.log("Validation failed:", { messageId, userId });
//         return res.status(400).json({ message: "Valid messageId is required" });
//       }
//       const message = await userService.deleteMessage(messageId, userId);

//       const io = getIo();
//       const conversation = await prisma.conversation.findUnique({
//         where: { id: parseInt(message.conversationId, 10) },
//         include: { participant1: true, participant2: true },
//       });
//       if (conversation) {
//         const recipientId =
//           parseInt(userId, 10) === conversation.participant1Id
//             ? conversation.participant2Id
//             : conversation.participant1Id;
//         const recipientSocketId = userSocketMap.get(recipientId);
//         const senderSocketId = userSocketMap.get(parseInt(userId, 10));

//         const deletedMessage = {
//           id: String(message.id),
//           conversationId: String(message.conversationId),
//           isDeleted: message.isDeleted,
//         };

//         if (recipientSocketId) {
//           io.to(recipientSocketId).emit("message deleted", deletedMessage);
//         }
//         if (senderSocketId) {
//           io.to(senderSocketId).emit("message deleted", deletedMessage);
//         }
//       }

//       res.json({ message: "Message deleted successfully" });
//     } catch (error) {
//       console.error("Delete message error:", error);
//       res
//         .status(400)
//         .json({ message: error.message || "Failed to delete message" });
//     }
//   },

//   async getConversations(req, res) {
//     try {
//       const { userId, role, tab } = req.query;
//       console.log("Fetching conversations for:", { userId, role, tab });

//       if (!userId) {
//         return res.status(400).json({ message: "userId is required" });
//       }
//       const parsedUserId = parseInt(userId, 10);
//       if (isNaN(parsedUserId)) {
//         return res
//           .status(400)
//           .json({ message: "userId must be a valid number" });
//       }
//       if (!role || !["ADMIN", "USER"].includes(role.toUpperCase())) {
//         return res
//           .status(400)
//           .json({ message: "Valid role (ADMIN or USER) is required" });
//       }
//       if (
//         role.toUpperCase() === "USER" &&
//         tab &&
//         !["all", "unread"].includes(tab.toLowerCase())
//       ) {
//         return res
//           .status(400)
//           .json({ message: "Invalid tab parameter. Use 'all' or 'unread'" });
//       }

//       const conversations = await userService.getConversations(
//         parsedUserId,
//         role,
//         tab
//       );
//       res.json(conversations || []);
//     } catch (error) {
//       console.error("Get conversations error:", error);
//       res
//         .status(400)
//         .json({ message: error.message || "Failed to fetch conversations" });
//     }
//   },

//   async searchConversations(req, res) {
//     try {
//       const { query, userId, role } = req.query;
//       if (!query || !userId || !role) {
//         return res
//           .status(400)
//           .json({ message: "Query, userId, and role are required" });
//       }
//       const conversations = await userService.searchConversations(
//         query,
//         userId,
//         role
//       );
//       res.json(conversations);
//     } catch (error) {
//       console.error("Search conversations error:", error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to search conversations" });
//     }
//   },

//   async searchUsers(req, res) {
//     try {
//       const { query, excludeUserId } = req.query;
//       if (!query) {
//         return res.status(400).json({ message: "Query is required" });
//       }
//       const users = await userService.searchUsers(query, excludeUserId);
//       res.json(users);
//     } catch (error) {
//       console.error("Search users error:", error);
//       res
//         .state(500)
//         .json({ message: error.message || "Failed to search users" });
//     }
//   },

//   async getMessages(req, res) {
//     try {
//       const { conversationId } = req.query;
//       if (!conversationId || isNaN(parseInt(conversationId, 10))) {
//         return res
//           .status(400)
//           .json({ message: "Valid conversationId is required" });
//       }
//       const messages = await userService.getMessages(conversationId);
//       res.json(messages);
//     } catch (error) {
//       console.error("Get messages error:", error);
//       res
//         .status(400)
//         .json({ message: error.message || "Failed to fetch messages" });
//     }
//   },

//   async markConversationAsRead(req, res) {
//     try {
//       const { id } = req.params;
//       console.log("Mark as read request:", {
//         id,
//         type: typeof id,
//         body: req.body,
//         headers: req.headers,
//       });
//       if (!id) throw new Error("Conversation ID is required");
//       const conversationId = parseInt(id, 10);
//       if (isNaN(conversationId)) throw new Error("Invalid conversationId");
//       const userId = parseInt(
//         req.userId || req.body.userId || req.headers["x-user-id"],
//         10
//       );
//       if (isNaN(userId)) throw new Error("Invalid userId");
//       const conversation = await prisma.conversation.findUnique({
//         where: { id: conversationId },
//       });
//       if (!conversation) throw new Error("Conversation not found");
//       if (
//         conversation.participant1Id !== userId &&
//         conversation.participant2Id !== userId
//       ) {
//         throw new Error("Unauthorized to mark this conversation as read");
//       }
//       await prisma.conversation.update({
//         where: { id: conversationId },
//         data: { unread: 0 },
//       });
//       res.status(200).json({ message: "Conversation marked as read" });
//     } catch (error) {
//       console.error("Error marking conversation as read:", error);
//       res.status(400).json({
//         message: error.message || "Failed to mark conversation as read",
//       });
//     }
//   },

//   async testEmailApi(req, res) {
//     try {
//       const response = await axios.post(
//         "https://fms-backend-staging.kiotapay.co.ke/api/v1/emails/send",
//         {
//           to: "test@example.com",
//           subject: "Test Email",
//           text: "This is a test email.",
//         },
//         {
//           headers: {
//             Authorization: "Bearer ${process.env.EMAIL_API_TOKEN}",
//             "Content-Type": "application/json",
//           },
//           timeout: 60000,
//         }
//       );
//       response.json({ message: "API email sent", response: response.data });
//     } catch (error) {
//       res.status(500).json({
//         message: "API email failed",
//         error: error.response?.data || error.message,
//       });
//     }
//   },
// };

// export default userController;

import { generateOtp } from "../utils/generateOtp.js";
import userService from "./user.service.js";
import { getIo, userSocketMap } from "../socket/socket.service.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import prisma from "../prisma.js";

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const userController = {
  async register(req, res) {
    try {
      const { fullName, email, phoneNumber, password } = req.body;
      if (!fullName || !email || !phoneNumber || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }
      const result = await userService.registerUser({
        fullName,
        email,
        phoneNumber,
        password,
      });
      res.status(201).json(result);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  },

  async login(req, res) {
    console.time("login");
    try {
      const { email, password } = req.body;
      console.log("Login attempt:", { email });
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }
      const result = await userService.loginUser(email, password);
      console.timeEnd("login");
      res.json(result);
    } catch (error) {
      console.error("Login error:", {
        message: error.message,
        stack: error.stack,
        email: req.body.email,
      });
      console.timeEnd("login");
      res.status(400).json({ message: error.message || "Login failed" });
    }
  },

  async generateOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const result = await userService.generateUserOtp(email);
      res.json(result);
    } catch (error) {
      console.error("Generate OTP error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to generate OTP" });
    }
  },

  async verifyOtp(req, res) {
    const { email, otp } = req.body;
    try {
      console.log("Verify OTP request:", {
        email,
        otp,
        cookies: req.cookies,
        headers: req.headers,
      });
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log("User not found for email:", email);
        return res.status(404).json({ message: "User not found" });
      }
      console.log("Found user:", { userId: user.id, role: user.role });
      const result = await userService.verifyUserOtp(email, otp);

      res.clearCookie("userId", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      });
      res.clearCookie("userRole", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      });

      res.cookie("userId", result.userId.toString(), {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.cookie("userRole", result.role, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000,
      });
      console.log("Cookies set:", {
        userId: result.userId,
        userRole: result.role,
        secure: true,
        sameSite: "none",
      });
      res.json({
        message: "OTP verified successfully",
        userId: String(result.userId),
        fullName: result.fullName,
        role: result.role,
        email: user.email,
      });
    } catch (error) {
      console.error("OTP verification error:", {
        message: error.message,
        stack: error.stack,
        email,
        otp,
      });
      res.status(400).json({ message: error.message || "Invalid OTP" });
    }
  },

  async uploadFile(req, res) {
    try {
      console.log("Upload file request:", {
        body: req.body,
        cookies: req.cookies,
        headers: req.headers,
        file: req.file,
      });

      const userId = parseInt(
        req.cookies.userId || req.headers["x-user-id"],
        10
      );
      if (!userId || isNaN(userId)) {
        console.log("Invalid userId:", { userId });
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.log("User not found:", { userId });
        return res.status(401).json({ message: "User not found" });
      }

      if (!req.file) {
        console.log("No file provided in request");
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { to, conversationId } = req.body;
      const toId = parseInt(to, 10);
      const convId = conversationId ? parseInt(conversationId, 10) : undefined;

      if (!toId || isNaN(toId)) {
        console.log("Invalid recipient ID:", { to });
        return res.status(400).json({ message: "Recipient ID is required" });
      }

      const recipient = await prisma.user.findUnique({ where: { id: toId } });
      if (!recipient) {
        console.log("Recipient not found:", { toId });
        return res.status(400).json({ message: "Recipient not found" });
      }

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileKey = `uploads/${uniqueSuffix}-${req.file.originalname}`;
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME || process.env.BUCKET_NAME,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: "public-read",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      const fileUrl = `https://${uploadParams.Bucket}.s3.amazonaws.com/${fileKey}`;
      const fileType = req.file.mimetype;
      const fileSize = req.file.size;
      const fileName = req.file.originalname;

      console.log("Sending file message:", {
        userId,
        toId,
        conversationId: convId,
        fileUrl,
        fileType,
        fileSize,
        fileName,
      });

      const message = await userService.sendFileMessage({
        userId,
        toId,
        conversationId: convId,
        fileUrl,
        fileType,
        fileSize,
        fileName,
      });

      const io = getIo();
      io.to(String(convId)).emit("private message", message);

      res.status(201).json({
        message: "File uploaded successfully",
        data: message,
      });
    } catch (error) {
      console.error("File upload error:", {
        message: error.message,
        stack: error.stack,
        body: req.body,
        cookies: req.cookies,
      });
      res
        .status(500)
        .json({ message: error.message || "Failed to upload file" });
    }
  },

  async getUsers(req, res) {
    try {
      const { role } = req.query;
      const users = await userService.getAllUsers(role);
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to fetch users" });
    }
  },

  async getAdmins(req, res) {
    try {
      const { excludeUserId } = req.query;
      if (!excludeUserId || isNaN(parseInt(excludeUserId, 10))) {
        return res
          .status(400)
          .json({ message: "Valid excludeUserId is required" });
      }
      const admins = await userService.getAdmins(excludeUserId);
      res.json(admins);
    } catch (error) {
      console.error("Get admins error:", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to fetch admins" });
    }
  },

  async createConversation(req, res) {
    try {
      const { participant1Id, participant2Id } = req.body;
      console.log("POST /conversations received:", {
        participant1Id,
        participant2Id,
      });
      if (!participant1Id || !participant2Id) {
        return res
          .status(400)
          .json({ message: "Both participant IDs are required" });
      }
      if (
        isNaN(parseInt(participant1Id, 10)) ||
        isNaN(parseInt(participant2Id, 10))
      ) {
        return res
          .status(400)
          .json({ message: "Participant IDs must be valid numbers" });
      }
      const conversation = await userService.createConversation(
        participant1Id,
        participant2Id
      );
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Create conversation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create conversation" });
    }
  },

  async forwardMessage(req, res) {
    try {
      const { messageId, recipientIds, content } = req.body;
      const userId = req.userId;
      if (!userId || isNaN(parseInt(userId, 10))) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (
        !messageId ||
        !recipientIds ||
        !Array.isArray(recipientIds) ||
        !recipientIds.length ||
        !content
      ) {
        return res.status(400).json({
          message:
            "Valid messageId, recipientIds (non-empty array), and content are required",
        });
      }
      if (recipientIds.includes(String(userId))) {
        return res
          .status(400)
          .json({ message: "Cannot forward message to yourself" });
      }
      const forwardedMessages = await userService.forwardMessage(
        messageId,
        userId,
        recipientIds,
        content
      );

      const io = getIo();
      for (const message of forwardedMessages) {
        const conversation = await prisma.conversation.findUnique({
          where: { id: parseInt(message.conversationId, 10) },
          include: { participant1: true, participant2: true },
        });
        if (conversation) {
          const recipientId =
            parseInt(userId, 10) === conversation.participant1Id
              ? conversation.participant2Id
              : conversation.participant1Id;
          const recipientSocketId = userSocketMap.get(recipientId);
          const senderSocketId = userSocketMap.get(parseInt(userId, 10));

          if (recipientSocketId) {
            io.to(recipientSocketId).emit("private message", message);
          }
          if (senderSocketId) {
            io.to(senderSocketId).emit("private message", message);
          }

          const updatedConversation = await prisma.conversation.findUnique({
            where: { id: parseInt(message.conversationId, 10) },
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
              isDeleted: msg.isDeleted,
              messageType: msg.messageType,
              fileUrl: msg.fileUrl,
              fileType: msg.fileType,
              fileSize: msg.fileSize,
              fileName: msg.fileName,
              isForwarded: msg.isForwarded,
            })),
          };

          if (recipientSocketId) {
            io.to(recipientSocketId).emit(
              "conversation updated",
              normalizedConversation
            );
          }
          if (senderSocketId) {
            io.to(senderSocketId).emit(
              "conversation updated",
              normalizedConversation
            );
          }
        }
      }

      res.json({
        message: "Message forwarded successfully",
        forwardedMessages,
      });
    } catch (error) {
      console.error("Forward message error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to forward message" });
    }
  },

  async updateMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.userId;
      console.log("PUT /messages/:messageId received:", {
        messageId,
        content,
        userId,
        body: req.body,
        headers: req.headers,
        cookies: req.cookies,
      });
      if (!userId || isNaN(parseInt(userId, 10))) {
        console.log("Missing or invalid userId:", { userId });
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!messageId || !content || isNaN(parseInt(messageId, 10))) {
        console.log("Validation failed:", { messageId, content, userId });
        return res
          .status(400)
          .json({ message: "Valid messageId and content are required" });
      }
      const message = await userService.updateMessage(
        messageId,
        content,
        userId
      );

      const io = getIo();
      const conversation = await prisma.conversation.findUnique({
        where: { id: parseInt(message.conversationId, 10) },
        include: { participant1: true, participant2: true },
      });
      if (conversation) {
        const recipientId =
          parseInt(userId, 10) === conversation.participant1Id
            ? conversation.participant2Id
            : conversation.participant1Id;
        const recipientSocketId = userSocketMap.get(recipientId);
        const senderSocketId = userSocketMap.get(parseInt(userId, 10));

        if (recipientSocketId) {
          io.to(recipientSocketId).emit("message updated", message);
        }
        if (senderSocketId) {
          io.to(senderSocketId).emit("message updated", message);
        }
      }

      res.json(message);
    } catch (error) {
      console.error("Update message error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to update message" });
    }
  },

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.userId;
      console.log("DELETE /messages/:messageId received:", {
        messageId,
        userId,
        headers: req.headers,
        cookies: req.cookies,
      });
      if (!userId || isNaN(parseInt(userId, 10))) {
        console.log("Missing or invalid userId:", { userId });
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!messageId || isNaN(parseInt(messageId, 10))) {
        console.log("Validation failed:", { messageId, userId });
        return res.status(400).json({ message: "Valid messageId is required" });
      }
      const message = await userService.deleteMessage(messageId, userId);

      const io = getIo();
      const conversation = await prisma.conversation.findUnique({
        where: { id: parseInt(message.conversationId, 10) },
        include: { participant1: true, participant2: true },
      });
      if (conversation) {
        const recipientId =
          parseInt(userId, 10) === conversation.participant1Id
            ? conversation.participant2Id
            : conversation.participant1Id;
        const recipientSocketId = userSocketMap.get(recipientId);
        const senderSocketId = userSocketMap.get(parseInt(userId, 10));

        const deletedMessage = {
          id: String(message.id),
          conversationId: String(message.conversationId),
          isDeleted: message.isDeleted,
        };

        if (recipientSocketId) {
          io.to(recipientSocketId).emit("message deleted", deletedMessage);
        }
        if (senderSocketId) {
          io.to(senderSocketId).emit("message deleted", deletedMessage);
        }
      }

      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error("Delete message error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to delete message" });
    }
  },

  async getConversations(req, res) {
    try {
      const { userId, role, tab } = req.query;
      console.log("Fetching conversations for:", { userId, role, tab });

      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
      const parsedUserId = parseInt(userId, 10);
      if (isNaN(parsedUserId)) {
        return res
          .status(400)
          .json({ message: "userId must be a valid number" });
      }
      if (!role || !["ADMIN", "USER"].includes(role.toUpperCase())) {
        return res
          .status(400)
          .json({ message: "Valid role (ADMIN or USER) is required" });
      }
      if (
        role.toUpperCase() === "USER" &&
        tab &&
        !["all", "unread"].includes(tab.toLowerCase())
      ) {
        return res
          .status(400)
          .json({ message: "Invalid tab parameter. Use 'all' or 'unread'" });
      }

      const conversations = await userService.getConversations(
        parsedUserId,
        role,
        tab
      );
      res.json(conversations || []);
    } catch (error) {
      console.error("Get conversations error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to fetch conversations" });
    }
  },

  async searchConversations(req, res) {
    try {
      const { query, userId, role } = req.query;
      if (!query || !userId || !role) {
        return res
          .status(400)
          .json({ message: "Query, userId, and role are required" });
      }
      const conversations = await userService.searchConversations(
        query,
        userId,
        role
      );
      res.json(conversations);
    } catch (error) {
      console.error("Search conversations error:", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to search conversations" });
    }
  },

  async searchUsers(req, res) {
    try {
      const { query, excludeUserId } = req.query;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }
      const users = await userService.searchUsers(query, excludeUserId);
      res.json(users);
    } catch (error) {
      console.error("Search users error:", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to search users" });
    }
  },

  async getMessages(req, res) {
    try {
      const { conversationId } = req.query;
      if (!conversationId || isNaN(parseInt(conversationId, 10))) {
        return res
          .status(400)
          .json({ message: "Valid conversationId is required" });
      }
      const messages = await userService.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to fetch messages" });
    }
  },

  async markConversationAsRead(req, res) {
    try {
      const { id } = req.params;
      console.log("Mark as read request:", {
        id,
        type: typeof id,
        body: req.body,
        headers: req.headers,
      });
      if (!id) throw new Error("Conversation ID is required");
      const conversationId = parseInt(id, 10);
      if (isNaN(conversationId)) throw new Error("Invalid conversationId");
      const userId = parseInt(
        req.userId || req.body.userId || req.headers["x-user-id"],
        10
      );
      if (isNaN(userId)) throw new Error("Invalid userId");
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation) throw new Error("Conversation not found");
      if (
        conversation.participant1Id !== userId &&
        conversation.participant2Id !== userId
      ) {
        throw new Error("Unauthorized to mark this conversation as read");
      }
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { unread: 0 },
      });
      res.status(200).json({ message: "Conversation marked as read" });
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      res.status(400).json({
        message: error.message || "Failed to mark conversation as read",
      });
    }
  },

  async broadcastMessage(req, res) {
    try {
      const { content } = req.body;
      const userId = req.userId;
      console.log("POST /messages/broadcast received:", {
        content,
        userId,
        body: req.body,
        headers: req.headers,
        cookies: req.cookies,
      });

      if (!userId || isNaN(parseInt(userId, 10))) {
        console.log("Missing or invalid userId:", { userId });
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!content || !content.trim()) {
        console.log("Validation failed:", { content, userId });
        return res
          .status(400)
          .json({ message: "Content is required for broadcast" });
      }

      const broadcastMessages = await userService.broadcastMessage(
        userId,
        content
      );
      res.status(200).json({
        message: "Broadcast sent successfully",
        broadcastMessages,
      });
    } catch (error) {
      console.error("Broadcast message error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to send broadcast" });
    }
  },

  async testEmailApi(req, res) {
    try {
      const response = await axios.post(
        "https://fms-backend-staging.kiotapay.co.ke/api/v1/emails/send",
        {
          to: "test@example.com",
          subject: "Test Email",
          text: "This is a test email.",
        },
        {
          headers: {
            Authorization: "Bearer ${process.env.EMAIL_API_TOKEN}",
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );
      res.json({ message: "API email sent", response: response.data });
    } catch (error) {
      res.status(500).json({
        message: "API email failed",
        error: error.response?.data || error.message,
      });
    }
  },
};

export default userController;
