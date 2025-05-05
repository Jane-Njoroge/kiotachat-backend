import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const userRepository = {
  async createUser({ fullName, email, phoneNumber, password }) {
    return await prisma.user.create({
      data: { fullName, email, phoneNumber, password },
    });
  },

  async findUserByEmail(email) {
    return await prisma.user.findUnique({ where: { email } });
  },

  async saveOtp(userId, otp, expiresAt) {
    return await prisma.oTP.create({
      data: { userId, otp, expiresAt },
    });
  },

  async findLatestOtp(userId) {
    return await prisma.oTP.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async deleteOtp(otpId) {
    return await prisma.oTP.delete({ where: { id: otpId } });
  },

  async createChat(userId) {
    return await prisma.conversation.create({
      data: {
        userId,
      },
    });
  },

  async getAllUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getAllChats() {
    return await prisma.conversation.findMany({
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get the latest message
        },
      },
    });
  },

  async getChatByUserId(userId) {
    return await prisma.conversation.findMany({
      where: { userId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  },

  async getMessages(conversationId) {
    return await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async searchUsers(query, excludeUserId) {
    return await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          { id: { not: excludeUserId } }, // Exclude the requesting user
          { role: "USER" }, // Only return non-admin users for admin searches
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
      },
    });
  },

  async searchConversations(query, userId, role) {
    const whereClause = {
      OR: [
        {
          messages: {
            some: {
              content: { contains: query, mode: "insensitive" },
            },
          },
        },
      ],
    };

    if (role === "USER") {
      whereClause.OR.push({
        userId: userId, // User can only see their own conversations
      });
    } else if (role === "ADMIN") {
      whereClause.OR.push({
        adminId: userId, // Admin can only see their own conversations
      });
    }

    return await prisma.conversation.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
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
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  },
};

export default userRepository;
