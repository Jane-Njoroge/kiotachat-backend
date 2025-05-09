import userService from "./user.service.js";
import prisma from "../prisma.js";

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

  async getAdminId(req, res) {
    try {
      const admin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      res.json({ adminId: admin?.id });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async createConversation(req, res) {
    try {
      const { userId, adminId } = req.body;
      const conversation = await userService.createConversation(
        userId,
        adminId
      );
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async getConversations(req, res) {
    try {
      const userId = req.query.userId;
      const role = req.cookies.userRole || req.query.role; // Adjust as per your auth
      const conversations = await userService.getConversations(userId, role);
      res.json(conversations);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async getMessages(req, res) {
    try {
      const { conversationId } = req.query;
      const messages = await userService.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async searchUsers(req, res) {
    try {
      const { query, excludeUserId } = req.query;
      const results = await userService.searchUsers(query, excludeUserId);
      res.json(results);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async searchConversations(req, res) {
    try {
      const { query, userId, role } = req.query;
      const results = await userService.searchConversations(
        query,
        userId,
        role
      );
      res.json(results);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};

export default userController;
