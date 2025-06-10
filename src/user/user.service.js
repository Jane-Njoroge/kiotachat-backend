import { getIo, userSocketMap } from "../socket/socket.service.js";
import bcrypt from "bcrypt";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../utils/nodemailer.js";
import userRepository from "./user.repository.js";
import prisma from "../prisma.js";

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
      fullName: user.fullName,
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
      fullName: user.fullName,
    };
  },

  async getAllUsers(role) {
    return await userRepository.getAllUsers(role);
  },

  async getAdmins(excludeUserId) {
    const parsedExcludeUserId = parseInt(excludeUserId, 10);
    if (isNaN(parsedExcludeUserId)) {
      throw new Error("Valid excludeUserId is required");
    }
    const admins = await userRepository.getAllUsers("ADMIN");
    return admins
      .filter((user) => user.id !== parsedExcludeUserId)
      .map((user) => ({
        ...user,
        id: String(user.id),
      }));
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
          where: { isDeleted: false },
          include: {
            sender: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (existingConversation) {
      return {
        ...existingConversation,
        id: String(existingConversation.id),
        participant1: {
          ...existingConversation.participant1,
          id: String(existingConversation.participant1.id),
        },
        participant2: {
          ...existingConversation.participant2,
          id: String(existingConversation.participant2.id),
        },
        messages: existingConversation.messages.map((msg) => ({
          ...msg,
          id: String(msg.id),
          sender: { ...msg.sender, id: String(msg.sender.id) },
          isEdited: msg.isEdited,
          isDeleted: msg.isDeleted,
          isForwarded: msg.isForwarded || false,
        })),
      };
    }

    return await userRepository.createChat(
      parsedParticipant1Id,
      parsedParticipant2Id
    );
  },

  async updateMessage(messageId, content, userId) {
    console.log("updateMessage called:", { messageId, content, userId });

    const parsedMessageId = parseInt(messageId, 10);
    const parsedUserId = parseInt(userId, 10);

    if (isNaN(parsedMessageId) || isNaN(parsedUserId) || !content.trim()) {
      throw new Error("Valid messageId, userId, and content are required");
    }

    const message = await prisma.message.findUnique({
      where: { id: parsedMessageId },
      include: { sender: true, conversation: true },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
    const isAdmin = user?.role === "ADMIN";

    const updatedMessage = await prisma.message.update({
      where: { id: parsedMessageId },
      data: { content, isEdited: true },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    const io = getIo();
    const conversation = await prisma.conversation.findUnique({
      where: { id: updatedMessage.conversationId },
      include: { participant1: true, participant2: true },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const recipientId =
      parsedUserId === conversation.participant1Id
        ? conversation.participant2Id
        : conversation.participant1Id;

    const recipientSocketId = userSocketMap.get(recipientId);
    const senderSocketId = userSocketMap.get(parsedUserId);

    const formattedMessage = {
      ...updatedMessage,
      id: String(updatedMessage.id),
      sender: {
        ...updatedMessage.sender,
        id: String(updatedMessage.sender.id),
      },
      conversationId: String(updatedMessage.conversationId),
      isEdited: updatedMessage.isEdited,
      isDeleted: updatedMessage.isDeleted,
      isForwarded: updatedMessage.isForwarded || false,
      createdAt: updatedMessage.createdAt.toISOString(),
    };

    console.log("Emitting message updated:", {
      formattedMessage,
      recipientSocketId,
      senderSocketId,
    });

    if (recipientSocketId) {
      io.to(recipientSocketId).emit("message updated", formattedMessage);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("message updated", formattedMessage);
    }

    return formattedMessage;
  },

  async forwardMessage(messageId, senderId, recipientIds, content) {
    const parsedMessageId = parseInt(messageId, 10);
    const parsedSenderId = parseInt(senderId, 10);
    if (
      isNaN(parsedMessageId) ||
      isNaN(parsedSenderId) ||
      !recipientIds.length ||
      !content.trim()
    ) {
      throw new Error(
        "Valid messageId, senderId, recipientIds, and content are required"
      );
    }

    const sender = await prisma.user.findUnique({
      where: { id: parsedSenderId },
    });
    if (!sender || sender.role !== "ADMIN") {
      throw new Error("Only admins can forward messages");
    }

    const originalMessage = await prisma.message.findUnique({
      where: { id: parsedMessageId },
      include: { conversation: true },
    });
    if (!originalMessage) {
      throw new Error("Original message not found");
    }

    if (originalMessage.senderId !== parsedSenderId) {
      throw new Error("You can only forward your own messages");
    }

    const forwardedMessages = [];
    for (const recipientId of recipientIds.map((id) => parseInt(id, 10))) {
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
      });
      if (!recipient || recipient.role !== "ADMIN") {
        continue; // Skip non-admin recipients
      }

      const existingConversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { participant1Id: parsedSenderId, participant2Id: recipientId },
            { participant1Id: recipientId, participant2Id: parsedSenderId },
          ],
        },
        include: { participant1: true, participant2: true },
      });

      let conversationId;
      if (!existingConversation) {
        const newConversation = await prisma.conversation.create({
          data: {
            participant1Id: parsedSenderId,
            participant2Id: recipientId,
            unread: 1,
          },
        });
        conversationId = newConversation.id;
      } else {
        conversationId = existingConversation.id;
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { unread: { increment: 1 } },
        });
      }

      const forwardedMessage = await prisma.message.create({
        data: {
          content: `Forwarded: ${content}`,
          senderId: parsedSenderId,
          conversationId,
          originalMessageId: parsedMessageId,
          isForwarded: true,
        },
        include: {
          sender: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      });

      forwardedMessages.push({
        ...forwardedMessage,
        id: String(forwardedMessage.id),
        sender: {
          ...forwardedMessage.sender,
          id: String(forwardedMessage.sender.id),
        },
        conversationId: String(forwardedMessage.conversationId),
        originalMessageId: String(forwardedMessage.originalMessageId),
        isEdited: forwardedMessage.isEdited,
        isDeleted: forwardedMessage.isDeleted,
        isForwarded: forwardedMessage.isForwarded,
      });
    }

    return forwardedMessages;
  },

  async deleteMessage(messageId, userId) {
    console.log("deleteMessage called:", { messageId, userId });

    const parsedMessageId = parseInt(messageId, 10);
    const parsedUserId = parseInt(userId, 10);

    if (isNaN(parsedMessageId) || isNaN(parsedUserId)) {
      throw new Error("Valid messageId and userId are required");
    }

    const message = await prisma.message.findUnique({
      where: { id: parsedMessageId },
      include: {
        sender: true,
        conversation: {
          include: { participant1: true, participant2: true },
        },
      },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
    const isAdmin = user?.role === "ADMIN";
    const isParticipant =
      message.conversation.participant1Id === parsedUserId ||
      message.conversation.participant2Id === parsedUserId;

    if (!isParticipant) {
      throw new Error("You are not a participant in this conversation");
    }

    if (!isAdmin && message.senderId !== parsedUserId) {
      throw new Error("You can only delete your own messages");
    }

    const updatedMessage = await prisma.message.update({
      where: { id: parsedMessageId },
      data: { isDeleted: true },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    const io = getIo();
    const deletedMessage = {
      id: String(updatedMessage.id),
      conversationId: String(updatedMessage.conversationId),
      isDeleted: updatedMessage.isDeleted,
    };

    const recipientId =
      parsedUserId === message.conversation.participant1Id
        ? message.conversation.participant2Id
        : message.conversation.participant1Id;

    const recipientSocketId = userSocketMap.get(recipientId);
    const senderSocketId = userSocketMap.get(parsedUserId);

    console.log("Emitting message deleted:", {
      deletedMessage,
      recipientSocketId,
      senderSocketId,
    });

    if (recipientSocketId) {
      io.to(recipientSocketId).emit("message deleted", deletedMessage);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("message deleted", deletedMessage);
    }

    return deletedMessage;
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
          isEdited: msg.isEdited,
          isDeleted: msg.isDeleted,
          isForwarded: msg.isForwarded || false,
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
