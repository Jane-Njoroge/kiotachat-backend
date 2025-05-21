import bcrypt from "bcrypt";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../utils/nodemailer.js";
import userRepository from "./user.repository.js";
import prisma from "../prisma.js";
//import { register } from "module";

const userService = {
  async registerUser({ fullName, email, phoneNumber, password }) {
    const existingUser = await userRepository.findUserByEmail(email);
    if (existingUser) throw new Error("User already exists. Please login");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userRepository.createUser({
      fullName,
      email,
      phoneNumber,
      password: hashedPassword,
    });

    return { message: "Registration successful", userId: user.id };
  },

  async loginUser(email, password) {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await userRepository.saveOtp(user.id, otp, expiresAt);
    await sendOtp(email, otp);

    return { message: "proceed to OTP entry" };
  },

  async generateUserOtp(email) {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new Error("User not found");

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await userRepository.saveOtp(user.id, otp, expiresAt);
    await sendOtp(email, otp);

    return { message: "OTP sent successfully" };
  },

  async verifyUserOtp(email, otp) {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new Error("User not found");
    console.log("verifying OTP for user:", {
      userId: user.id,
      role: user.role,
    });

    const latestOtp = await userRepository.findLatestOtp(user.id);
    if (!latestOtp || latestOtp.otp !== otp) throw new Error("Invalid OTP");
    if (new Date() > latestOtp.expiresAt) {
      await userRepository.deleteOtp(latestOtp.id);
      throw new Error("OTP has expired");
    }

    await userRepository.deleteOtp(latestOtp.id);

    return {
      message: "OTP verified successfully",
      role: user.role,
      userId: user.id,
    };
  },

  async getAllUsers(role) {
    return await userRepository.getAllUsers(role);
  },

  async createConversation(participant1Id, participant2Id) {
    const parsedParticipant1Id = parseInt(participant1Id, 10);
    const parsedParticipant2Id = parseInt(participant2Id, 10);

    if (
      isNaN(parsedParticipant1Id) ||
      isNaN(parsedParticipant2Id) ||
      parsedParticipant1Id === parsedParticipant2Id
    ) {
      throw new Error("Valid and distinct participant IDs are required");
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          {
            participant1Id: parsedParticipant1Id,
            participant2Id: parsedParticipant2Id,
          },
          {
            participant1Id: parsedParticipant2Id,
            participant2Id: parsedParticipant1Id,
          },
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

    if (existingConversation) {
      return existingConversation;
    }

    return await userRepository.createChat(
      parsedParticipant1Id,
      parsedParticipant2Id
    );
  },
  async updateMessage(messageId, content, userId) {
    const parsedMessageId = parseInt(messageId, 10);
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedMessageId) || isNaN(parsedUserId) || !content.trim()) {
      throw new Error("Valid messageId, userId, and content are required");
    }

    const message = await prisma.message.findUnique({
      where: { id: parsedMessageId },
      include: { sender: true },
    });
    if (!message) {
      throw new Error("Message not found");
    }
    if (message.senderId !== parsedUserId) {
      throw new Error("You can only edit your own messages");
    }

    const updatedMessage = await prisma.message.update({
      where: { id: parsedMessageId },
      data: { content },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    return {
      ...updatedMessage,
      id: String(updatedMessage.id),
      sender: {
        ...updatedMessage.sender,
        id: String(updatedMessage.sender.id),
      },
      conversationId: String(updatedMessage.conversationId),
    };
  },
  async getConversations(userId, role, tab) {
    try {
      const parsedUserId = parseInt(userId, 10);
      if (isNaN(parsedUserId)) {
        throw new Error("Valid userId is required");
      }
      if (!role || !["ADMIN", "USER"].includes(role.toUpperCase())) {
        throw new Error("Valid role (ADMIN or USER) is required");
      }
      let conversations = await userRepository.getChatByUserId(parsedUserId);
      if (role.toUpperCase() === "USER" && tab) {
        if (tab.toLowerCase() === "unread") {
          conversations = conversations.filter((conv) => conv.unread > 0);
        }
      }
      return conversations.map((conv) => ({
        ...conv,
        id: String(conv.id),
        participant1: {
          ...conv.participant1,
          id: String(conv.participant1.id),
        },
        participant2: {
          ...conv.participant2,
          id: String(conv.participant2.id),
        },
        messages: conv.messages.map((msg) => ({
          ...msg,
          id: String(msg.id),
          sender: { ...msg.sender, id: String(msg.sender.id) },
        })),
      }));
    } catch (error) {
      console.error("Error in getConversations:", error);
      throw new Error(error.message || "Failed to fetch conversations");
    }
  },
  async searchConversations(query, userId, role) {
    return await userRepository.searchConversations(query, userId, role);
  },

  async searchUsers(query, excludeUserId) {
    return await userRepository.searchUsers(query, excludeUserId);
  },

  async getMessages(conversationId) {
    return await userRepository.getMessages(conversationId);
  },

  async markConversationAsRead(conversationId) {
    return await userRepository.markConversationAsRead(conversationId);
  },
};

export default userService;
