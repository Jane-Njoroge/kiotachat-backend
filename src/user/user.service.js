// import { PrismaClient } from "@prisma/client";
// import { sendOtp } from "../utils/nodemailer.js"; // Added .js
// import { generateOtp } from "../utils/generateOtp.js"; // Added .js
// import {
//   createUser,
//   findUserByEmail,
//   findOtpByUserIdAndOtp,
//   deleteOtp,
// } from "./user.repository.js";

// const prisma = new PrismaClient();

// export const generateUserOtp = async (req, res) => {
//   try {
//     const { email } = req.body;
//     console.log("Received email:", email);

//     if (!email) {
//       return res.status(400).json({ message: "Email is required" });
//     }

//     const user = await prisma.user.findUnique({ where: { email } });
//     console.log("Found user:", user);

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const otp = generateOtp();
//     console.log("Generated OTP:", otp);

//     const expiresAt = new Date(Date.now() + 45 * 1000); // 45 seconds
//     console.log("Expires at:", expiresAt);

//     const userId = user.id;
//     console.log("User ID:", userId);

//     const createdOtp = await prisma.otp.create({
//       // Fixed model name to "otp" (adjust to match your schema)
//       data: {
//         userId,
//         otp,
//         expiresAt,
//       },
//     });
//     console.log("OTP saved to database:", createdOtp);

//     await sendOtp(email, otp);
//     console.log("OTP sent via email");

//     res.json({ message: "OTP sent successfully" });
//   } catch (error) {
//     console.error("Error in /generate-otp:", error);
//     res.status(500).json({ message: "Failed to send OTP" });
//   }
// };

// export const registerUser = async ({
//   fullName,
//   email,
//   phoneNumber,
//   password,
// }) => {
//   const hashedPassword = await bcrypt.hash(password, 10);
//   try {
//     const user = await createUser({
//       fullName,
//       email,
//       phoneNumber,
//       password: hashedPassword,
//     });
//     return user.id;
//   } catch (error) {
//     if (error.code === "P2002") {
//       throw new Error("Email already exists");
//     }
//     throw error;
//   }
// };

// export const loginUser = async (email, password) => {
//   const user = await findUserByEmail(email);
//   if (!user) {
//     throw new Error("Invalid credentials");
//   }

//   const isValidPassword = await bcrypt.compare(password, user.password);
//   if (!isValidPassword) {
//     throw new Error("Invalid credentials");
//   }

//   return jwt.sign({ userId: user.id }, secretKey, { expiresIn: "1h" });
// };

// export const verifyUserOtp = async (email, otp) => {
//   const user = await findUserByEmail(email);
//   if (!user) {
//     throw new Error("User not found");
//   }

//   const otpRecord = await findOtpByUserIdAndOtp(user.id, otp);
//   if (!otpRecord) {
//     throw new Error("Invalid OTP");
//   }

//   const now = new Date();
//   if (now > otpRecord.expiresAt) {
//     await deleteOtp(otpRecord.id);
//     throw new Error("OTP has expired");
//   }

//   await deleteOtp(otpRecord.id);
// };

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../notifications/nodemailer.js";
import userRepository from "./user.repository.js";

const secretKey = process.env.JWT_SECRET || "your-secret-key";

const userService = {
  async registerUser({ fullName, email, phoneNumber, password }) {
    const existingUser = await userRepository.findUserByEmail(email);
    if (existingUser) throw new Error("Email already in use");

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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await userRepository.saveOtp(user.id, otp, expiresAt);
    await sendOtp(email, otp);

    return { message: "OTP sent to email" };
  },

  async generateUserOtp(email) {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new Error("User not found");

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await userRepository.saveOtp(user.id, otp, expiresAt);
    await sendOtp(email, otp);

    return { message: "OTP sent successfully" };
  },

  async verifyUserOtp(email, otp) {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new Error("User not found");

    const otpRecord = await userRepository.findLatestOtp(user.id);
    if (!otpRecord || otpRecord.otp !== otp) throw new Error("Invalid OTP");

    if (new Date() > otpRecord.expiresAt) {
      await userRepository.deleteOtp(otpRecord.id);
      throw new Error("OTP has expired");
    }

    await userRepository.deleteOtp(otpRecord.id);

    const token = jwt.sign({ userId: user.id }, secretKey, {
      expiresIn: "1h",
    });

    return { message: "OTP verified", token };
  },
};

export default userService;
