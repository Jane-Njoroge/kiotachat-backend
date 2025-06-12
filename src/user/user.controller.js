import { generateOtp } from "../utils/generateOtp.js";
import userService from "./user.service.js";
import { getIo, userSocketMap } from "../socket/socket.service.js";
import prisma from "../prisma.js";

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
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }
      const result = await userService.loginUser(email, password);
      res.json(result);
    } catch (error) {
      console.error("Login error:", error);
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
      // Validate OTP (e.g., check against stored OTP in database)
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Clear OTP after verification
      await prisma.user.update({ where: { email }, data: { otp: null } });

      // Set cookies
      res.cookie("userId", user.id.toString(), {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });
      res.cookie("userRole", user.role, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });

      res.json({
        message: "OTP verified successfully",
        fullName: user.fullName,
        role: user.role, // Ensure this is "ADMIN" or "USER"
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ message: "Server error" });
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
        !content
      ) {
        return res.status(400).json({
          message: "Valid messageId, recipientIds, and content are required",
        });
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

          // Emit conversation updated event
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

  // async markConversationAsRead(req, res) {
  //   try {
  //     const { conversationId } = req.params;
  //     if (!conversationId || isNaN(parseInt(conversationId, 10))) {
  //       return res
  //         .status(400)
  //         .json({ message: "Valid conversationId is required" });
  //     }
  //     await userService.markConversationAsRead(conversationId);
  //     res.json({ message: "Conversation marked as read" });
  //   } catch (error) {
  //     console.error("Mark conversation as read error:", error);
  //     res.status(400).json({
  //       message: error.message || "Failed to mark conversation as read",
  //     });
  //   }
  // },
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
};

export default userController;
