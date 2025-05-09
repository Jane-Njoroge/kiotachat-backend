import bcrypt from "bcrypt";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../utils/nodemailer.js";
import userRepository from "./user.repository.js";

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

  async createConversation(userId, adminId) {
    return await userRepository.createChat(userId, adminId);
  },

  async getConversations(userId, role) {
    if (role === "ADMIN") {
      return await userRepository.getAllChats();
    } else {
      return await userRepository.getChatByUserId(userId);
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
};

export default userService;
