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
    return await prisma.otp.create({
      data: {
        userId,
        otp,
        expiresAt,
      },
    });
  },

  async findOtp(userId, otp) {
    return await prisma.otp.findFirst({
      where: {
        userId,
        otp,
      },
    });
  },

  async deleteOtp(otpId) {
    return await prisma.otp.delete({ where: { id: otpId } });
  },
};

export default userRepository;
