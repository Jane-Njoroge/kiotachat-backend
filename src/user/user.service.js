import { getIo, userSocketMap } from "../socket/socket.service.js";
import bcrypt from "bcrypt";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../utils/nodemailer.js";
import userRepository from "./user.repository.js";
import prisma from "../prisma.js";
const userService = {
  async registerUser({ fullName, email, phoneNumber, password }) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("We need a valid email address.");
    }
    if (!/^\+?\d{4,15}$/.test(phoneNumber)) {
      throw new Error("Your phone number needs to be 4-15 digits.");
    }
    if (!password || /\s/.test(password)) {
      throw new Error("Your password can’t be empty or have spaces.");
    }

    const existingUser = await userRepository.findUserByEmail(email);
    if (existingUser)
      throw new Error("This email’s already taken. Please login.");

    console.time("bcryptHash");
    const hashedPassword = await bcrypt.hash(password, 8);
    console.timeEnd("bcryptHash");

    const user = await userRepository.createUser({
      fullName,
      email,
      phoneNumber,
      password: hashedPassword,
    });
    // const hashedPassword = await bcrypt.hash(password, 10);
    // const user = await userRepository.createUser({
    //   fullName,
    //   email,
    //   phoneNumber,
    //   password: hashedPassword,
    // });

    return { message: "Account created successfully!", userId: user.id };
  },

  async loginUser(email, password) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("We need a valid email address.");
    }

    const user = await userRepository.findUserByEmail(email);
    if (!user)
      throw new Error("No account found with this email. Please sign up.");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Incorrect password. Please try again.");

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await userRepository.saveOtp(user.id, otp, expiresAt);
    await sendOtp(email, otp);

    return { message: "OTP sent to your email. Check your inbox!" };
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
    console.log("Verifying OTP for user:", {
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
    });

    const latestOtp = await userRepository.findLatestOtp(user.id);
    if (!latestOtp || latestOtp.otp !== otp) {
      console.log("OTP mismatch:", { provided: otp, stored: latestOtp?.otp });
      throw new Error("Invalid OTP");
    }
    if (new Date() > latestOtp.expiresAt) {
      await userRepository.deleteOtp(latestOtp.id);
      console.log("OTP expired:", { expiresAt: latestOtp.expiresAt });
      throw new Error("OTP has expired");
    }

    await userRepository.deleteOtp(latestOtp.id);

    return {
      message: "OTP verified successfully",
      role: user.role.toUpperCase(),
      userId: user.id,
      fullName: user.fullName,
    };
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

  async sendFileMessage({
    userId,
    toId,
    conversationId,
    fileUrl,
    fileType,
    fileSize,
    fileName,
    tempId,
  }) {
    const fromId = parseInt(userId, 10);
    const recipientId = parseInt(toId, 10);
    const convId = conversationId ? parseInt(conversationId, 10) : undefined;

    if (isNaN(fromId) || isNaN(recipientId)) {
      throw new Error("Invalid sender or recipient ID");
    }

    const sender = await prisma.user.findUnique({
      where: { id: fromId },
    });
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (!sender || !recipient) {
      throw new Error("Sender or recipient not found");
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { id: convId },
          { participant1Id: fromId, participant2Id: recipientId },
          { participant1Id: recipientId, participant2Id: fromId },
        ],
      },
      include: { participant1: true, participant2: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1Id: fromId,
          participant2Id: recipientId,
          unread: 1,
        },
        include: { participant1: true, participant2: true },
      });
    }

    const message = await prisma.message.create({
      data: {
        content: "File message",
        senderId: fromId,
        conversationId: conversation.id,
        messageType: fileType.split("/")[0] || "file",
        fileUrl,
        fileType,
        fileSize,
        fileName,
      },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    const io = getIo();
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
      tempId,
    };

    const recipientSocketId = userSocketMap.get(recipientId);
    const senderSocketId = userSocketMap.get(fromId);

    if (recipientSocketId) {
      io.to(recipientSocketId).emit("private message", formattedMessage);
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { unread: { increment: 1 } },
      });
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("private message", formattedMessage);
    }

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
              select: { id: true, fullName: true, email: true, role: true },
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

    return formattedMessage;
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
    if (!sender) {
      throw new Error("Sender not found");
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
      if (recipientId === parsedSenderId) {
        continue; // Skip forwarding to self
      }

      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
      });
      if (!recipient) {
        continue; // Skip invalid recipients
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

      const messageData = {
        content: `Forwarded: ${content}`,
        senderId: parsedSenderId,
        conversationId,
        originalMessageId: parsedMessageId,
        isForwarded: true,
      };

      if (originalMessage.fileUrl) {
        messageData.messageType = originalMessage.messageType;
        messageData.fileUrl = originalMessage.fileUrl;
        messageData.fileType = originalMessage.fileType;
        messageData.fileSize = originalMessage.fileSize;
        messageData.fileName = originalMessage.fileName;
      }

      const forwardedMessage = await prisma.message.create({
        data: messageData,
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
        messageType: forwardedMessage.messageType,
        fileUrl: forwardedMessage.fileUrl,
        fileType: forwardedMessage.fileType,
        fileSize: forwardedMessage.fileSize,
        fileName: forwardedMessage.fileName,
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
