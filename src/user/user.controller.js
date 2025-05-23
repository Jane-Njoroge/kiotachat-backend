import { generateOtp } from "../utils/generateOtp.js";
import userService from "./user.service.js";

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
        return res.status(400).json({ message: "Email is requires" });
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
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }
      const result = await userService.verifyUserOtp(email, otp);
      //set cookies for security enhancement
      res.cookie("userId", result.userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: "/",
      });
      res.cookie("userRole", result.role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: "/",
      });
      res.json(result);
    } catch (error) {
      console.error("OTP verification error:", error);
      res
        .status(400)
        .json({ message: error.message || "OTP verification failed" });
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
  async updateMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.userId; // From middleware
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
      res.json(message);
    } catch (error) {
      console.error("update message error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to update message" });
    }
  },
  // async updateMessage(req, res) {
  //   try {
  //     const { messageId } = req.params;
  //     const { content } = req.body;
  //     const userId = req.userId; //UserId from middleware
  //     console.log("PUT /messages/:messageId received:", {
  //       messageId,
  //       content,
  //       userId, // Undefined!
  //       body: req.body,
  //       headers: req.headers,
  //     });
  //     // const userId = req.userId;
  //     if (!messageId || !content || isNaN(parseInt(messageId, 10))) {
  //       console.log("Validation failed:", { messageId, content, userId });
  //       return res
  //         .status(400)
  //         .json({ message: "Valid messageId and content are required" });
  //     }
  //     const message = await userService.updateMessage(
  //       messageId,
  //       content,
  //       userId // Undefined!
  //     );
  //     res.json(message);
  //   } catch (error) {
  //     console.error("update message error:", error);
  //     res
  //       .status(400)
  //       .json({ message: error.message || "Failed to update message" });
  //   }
  // },

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
      const { conversationId } = req.params;
      if (!conversationId || isNaN(parseInt(conversationId, 10))) {
        return res
          .status(400)
          .json({ message: "Valid conversationId is required" });
      }
      await userService.markConversationAsRead(conversationId);
      res.json({ message: "Conversation marked as read" });
    } catch (error) {
      console.error("Mark conversation as read error:", error);
      res.status(400).json({
        message: error.message || "Failed to mark conversation as read",
      });
    }
  },
};

export default userController;
