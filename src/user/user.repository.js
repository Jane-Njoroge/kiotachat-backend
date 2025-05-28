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

  async createChat(participant1Id, participant2Id) {
    const conversation = await prisma.conversation.create({
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
    return {
      ...conversation,
      id: String(conversation.id),
      participant1: {
        ...conversation.participant1,
        id: String(conversation.participant1.id),
      },
      participant2: {
        ...conversation.participant2,
        id: String(conversation.participant2.id),
      },
      messages: conversation.messages.map((msg) => ({
        ...msg,
        id: String(msg.id),
        sender: { ...msg.sender, id: String(msg.sender.id) },
      })),
    };
  },

  async getAllUsers(role) {
    return await prisma.user.findMany({
      where: role ? { role: { equals: role, mode: "insensitive" } } : {},
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

  // async getChatByUserId(userId) {
  //   const conversations = await prisma.conversation.findMany({
  //     where: {
  //       OR: [
  //         { participant1Id: parseInt(userId, 10) },
  //         { participant2Id: parseInt(userId, 10) },
  //       ],
  //     },
  //     include: {
  //       participant1: {
  //         select: { id: true, fullName: true, email: true, role: true },
  //       },
  //       participant2: {
  //         select: { id: true, fullName: true, email: true, role: true },
  //       },
  //       messages: {
  //         include: {
  //           sender: {
  //             select: { id: true, fullName: true, email: true, role: true },
  //           },
  //         },
  //         orderBy: { createdAt: "desc" },
  //         take: 1,
  //       },
  //     },
  //     orderBy: { updatedAt: "desc" },
  //   });
  //   return conversations.map((conv) => ({
  //     ...conv,
  //     id: String(conv.id),
  //     participant1: { ...conv.participant1, id: String(conv.participant1.id) },
  //     participant2: { ...conv.participant2, id: String(conv.participant2.id) },
  //     messages: conv.messages.map((msg) => ({
  //       ...msg,
  //       id: String(msg.id),
  //       sender: { ...msg.sender, id: String(msg.sender.id) },
  //     })),
  //   }));
  // },
  async getChatByUserId(userId) {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: parseInt(userId, 10) },
          { participant2Id: parseInt(userId, 10) },
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
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return conversations.map((conv) => ({
      ...conv,
      id: String(conv.id),
      participant1: { ...conv.participant1, id: String(conv.participant1.id) },
      participant2: { ...conv.participant2, id: String(conv.participant2.id) },
      messages: conv.messages.map((msg) => ({
        ...msg,
        id: String(msg.id),
        sender: { ...msg.sender, id: String(msg.sender.id) },
      })),
    }));
  },
  async getMessages(conversationId) {
    const parsedConversationId = parseInt(conversationId, 10);
    if (isNaN(parsedConversationId)) {
      throw new Error("Valid conversationId is required");
    }
    const messages = await prisma.message.findMany({
      where: { conversationId: parsedConversationId },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return messages.map((msg) => ({
      ...msg,
      id: String(msg.id),
      sender: { ...msg.sender, id: String(msg.sender.id) },
    }));
  },
  async markConversationAsRead(conversationId) {
    const parsedConversationId = parseInt(conversationId, 10);
    if (isNaN(parsedConversationId)) {
      throw new Error("Valid conversationId is required");
    }
    return await prisma.conversation.update({
      where: { id: parsedConversationId },
      data: { unread: 0 },
    });
  },

  async searchUsers(query, excludeUserId, role) {
    let excludeId = parseInt(excludeUserId, 10);
    if (isNaN(excludeId)) excludeId = undefined;

    return await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          excludeId ? { id: { not: excludeId } } : {},
          role ? { role: { equals: role, mode: "insensitive" } } : {},
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
    if (!userId) throw new Error("Missing required parameters");

    const whereClause = {
      OR: [
        {
          messages: {
            some: { content: { contains: query, mode: "insensitive" } },
          },
        },
        {
          participant1: {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        },
        {
          participant2: {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      ],
      AND: [
        {
          OR: [
            { participant1Id: parseInt(userId, 10) },
            { participant2Id: parseInt(userId, 10) },
          ],
        },
      ],
    };

    return await prisma.conversation.findMany({
      where: whereClause,
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
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  },
};

export default userRepository;
