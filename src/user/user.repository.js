import prisma from "../prisma.js";

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
    return await prisma.oTP.create({ data: { userId, otp, expiresAt } });
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

  async createChat(userId, adminId) {
    return await prisma.conversation.create({
      data: { userId, adminId },
    });
  },

  async getAllUsers(role) {
    return await prisma.user.findMany({
      where: role ? { role } : {},
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
        user: { select: { id: true, fullName: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  },

  async getChatByUserId(userId) {
    return await prisma.conversation.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  },

  async getMessages(conversationId) {
    return await prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, fullName: true } } },
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
          { id: { not: excludeUserId } },
          { role: "USER" },
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
    if (!userId || !role) throw new Error("Missing required parameters");

    const whereClause = {
      OR: [
        {
          messages: {
            some: { content: { contains: query, mode: "insensitive" } },
          },
        },
        {
          user: {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      ],
    };

    if (role === "USER") whereClause.userId = userId;
    else if (role === "ADMIN") whereClause.adminId = userId;

    return await prisma.conversation.findMany({
      where: whereClause,
      include: {
        user: true,
        messages: { take: 1, orderBy: { createdAt: "desc" } },
      },
    });
  },
};

export default userRepository;
