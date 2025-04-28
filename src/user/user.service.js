import bcrypt from "bcrypt";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../notifications/nodemailer.js";
import userRepository from "./user.repository.js";
import { Prisma } from "@prisma/client";

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
    console.log("DEV OTP:,");
    return { message: "proceed to OTP entry" };
    // return { message: "OTP sent to email", userId: user.id };
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
    return await Prisma.user.findMany({
      where: role ? { role } : {},
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
      ordeBy: { createdAt: "desc" },
    });
  },

  async createConversation(userId) {
    return await userRepository.createChat(userId);
  },

  async getConversations(userId, role) {
    if (role === "ADMIN") {
      return await userRepository.getAllChats();
    } else {
      return await userRepository.getChatByUserId(userId);
    }
  },
  async getMessages(conversationId) {
    return await Prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: true,
        conversation: {
          include: {
            user: true,
          },
        },
      },
    });
  },
};

export default userService;
