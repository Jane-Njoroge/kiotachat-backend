import userService from "./user.service.js";
import prisma from "../prisma.js";
import { getIo, userSocketMap } from "../socket/socket.service.js";

const userController = {
  async register(req, res) {
    try {
      const result = await userService.registerUser(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async login(req, res) {
    try {
      const result = await userService.loginUser(
        req.body.email,
        req.body.password
      );
      res.json(result);
    } catch (error) {
      console.error("login error:", error.message);
      res.status(401).json({ message: error.message });
    }
  },

  async generateOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const result = await userService.generateUserOtp(email);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async verifyOtp(req, res) {
    try {
      const result = await userService.verifyUserOtp(
        req.body.email,
        req.body.otp
      );
      res.json({ ...result, userId: result.userId });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async getUsers(req, res) {
    try {
      const role = req.query.role;
      const users = await userService.getAllUsers(role);
      res.json(users);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          role: true,
        },
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to fetch user" });
    }
  },

  async getAdminId(req, res) {
    try {
      const admin = await prisma.user.findFirst({
        where: { role: { equals: "ADMIN", mode: "insensitive" } },
        select: { id: true },
      });
      res.json({ adminId: admin?.id });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async createConversation(req, res) {
    try {
      let { participant1Id, participant2Id } = req.body;
      console.log("createConversation called with:", {
        participant1Id,
        participant2Id,
        body: req.body,
      });

      // Validate input
      if (!participant1Id || !participant2Id) {
        console.log("Missing participant1Id or participant2Id:", {
          participant1Id,
          participant2Id,
        });
        return res
          .status(400)
          .json({ message: "participant1Id and participant2Id are required" });
      }

      // Parse IDs as integers
      participant1Id = parseInt(participant1Id, 10);
      participant2Id = parseInt(participant2Id, 10);

      // Validate parsed IDs
      if (isNaN(participant1Id) || isNaN(participant2Id)) {
        console.log("Invalid participant1Id or participant2Id after parsing:", {
          participant1Id,
          participant2Id,
        });
        return res
          .status(400)
          .json({ message: "Invalid participant1Id or participant2Id" });
      }

      // Prevent self-conversation
      if (participant1Id === participant2Id) {
        console.log("Cannot create conversation with same user:", {
          participant1Id,
          participant2Id,
        });
        return res
          .status(400)
          .json({ message: "Cannot create conversation with yourself" });
      }

      // Fetch participants
      const participant1 = await prisma.user.findUnique({
        where: { id: participant1Id },
        select: { id: true, fullName: true, email: true, role: true },
      });
      const participant2 = await prisma.user.findUnique({
        where: { id: participant2Id },
        select: { id: true, fullName: true, email: true, role: true },
      });

      if (!participant1) {
        console.log(
          `Participant not found for participant1Id: ${participant1Id}`
        );
        return res.status(404).json({ message: "Participant 1 not found" });
      }
      if (!participant2) {
        console.log(
          `Participant not found for participant2Id: ${participant2Id}`
        );
        return res.status(404).json({ message: "Participant 2 not found" });
      }

      // Check for existing conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { participant1Id, participant2Id },
            { participant1Id: participant2Id, participant2Id: participant1Id },
          ],
        },
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
          },
        },
      });

      if (!conversation) {
        console.log("Creating new conversation for:", {
          participant1Id,
          participant2Id,
        });
        conversation = await prisma.conversation.create({
          data: {
            participant1Id,
            participant2Id,
            unread: 0,
          },
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
            },
          },
        });
      } else {
        console.log("Found existing conversation:", conversation.id);
      }

      // Emit conversation update via socket
      const io = getIo();
      const socket1Id = userSocketMap.get(participant1Id);
      const socket2Id = userSocketMap.get(participant2Id);
      if (socket1Id) {
        io.to(socket1Id).emit("conversation updated", conversation);
      }
      if (socket2Id) {
        io.to(socket2Id).emit("conversation updated", conversation);
      }

      res.status(200).json(conversation);
    } catch (error) {
      console.error("createConversation error:", error.message, error.stack);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  },

  async getConversations(req, res) {
    try {
      const userId = parseInt(req.query.userId, 10);
      const role = req.cookies.userRole || req.query.role;
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid userId" });
      }
      const conversations = await userService.getConversations(userId, role);
      res.json(conversations);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async getMessages(req, res) {
    try {
      const { conversationId } = req.query;
      const messages = await userService.getMessages(
        parseInt(conversationId, 10)
      );
      res.json(messages);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async searchUsers(req, res) {
    try {
      const { query, excludeUserId } = req.query;
      if (!query) {
        return res
          .status(400)
          .json({ message: "Query parameter 'query' is required" });
      }
      const results = await userService.searchUsers(query, excludeUserId);
      res.json(results);
    } catch (error) {
      console.error("searchUsers error:", error);
      res.status(400).json({ message: error.message || "Bad Request" });
    }
  },

  async markConversationRead(req, res) {
    try {
      const { id } = req.params;
      const conversationId = parseInt(id, 10);
      if (isNaN(conversationId)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { unread: 0 },
      });
      res.status(200).json({ message: "Conversation marked as read" });
    } catch (error) {
      console.error("Mark conversation read error:", error);
      res.status(500).json({ message: "Failed to mark conversation as read" });
    }
  },

  async searchConversations(req, res) {
    try {
      const { query, userId, role } = req.query;
      const parsedUserId = parseInt(userId, 10);
      if (isNaN(parsedUserId)) {
        return res.status(400).json({ message: "Invalid userId" });
      }
      const results = await userService.searchConversations(
        query,
        parsedUserId,
        role
      );
      res.json(results);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};

export default userController;
