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
import userRepository from "./user.repository.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../notifications/nodemailer.js";

const secretKey = process.env.JWT_SECRET || "your-secret-key-for-jwt";
const userService = {
  async registerUser({ fullName, email, phoneNumber, password }) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log("Registering user with data:", {
        fullName,
        email,
        phoneNumber,
      });
      const user = await userRepository.createUser({
        fullName,
        email,
        phoneNumber,
        password: hashedPassword,
      });
      console.log("User created successfully:", user);

      const token = jwt.sign({ userId: user.id }, secretKey, {
        expiresIn: "1h",
      });
      return { userId: user.id, token };
    } catch (error) {
      if (error.code === "P2002") {
        throw new Error("Email already exists");
      }
      throw error;
    }
  },

  async loginUser(email, password) {
    try {
      const user = await userRepository.findUserByEmail(email);
      if (!user) {
        console.log("User not found with email:", email);
        throw new Error("User not found");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error("Invalid credentials");
      }

      const token = jwt.sign({ userId: user.id }, secretKey, {
        expiresIn: "1h",
      });

      const { otp, expiresAt } = generateOtp();
      await userRepository.saveOtp(user.id, otp, expiresAt);
      await sendOtp(email, otp);

      return { token, message: "OTP sent successfully" };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async generateUserOtp(email) {
    try {
      const user = await userRepository.findUserByEmail(email);
      if (!user) {
        throw new Error("User not found");
      }

      const { otp, expiresAt } = generateOtp();
      await userRepository.saveOtp(user.id, otp, expiresAt);
      await sendOtp(email, otp);

      return { message: "OTP sent successfully" };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async verifyUserOtp(email, otp) {
    const user = await userRepository.findUserByEmail(email);

    if (!user) {
      throw new Error("User not found");
    }

    const otpRecord = await userRepository.findOtp(user.id, otp);

    if (!otpRecord) {
      throw new Error("Invalid OTP");
    }

    const now = new Date();
    if (now > otpRecord.expiresAt) {
      throw new Error("OTP has expired");
    }

    await userRepository.deleteOtp(otpRecord.id);
  },
};

export default userService;
