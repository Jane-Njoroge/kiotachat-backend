// // import express from "express";
// // const { PrismaClient } = require("@prisma/client");
// // const bcrypt = require("bcrypt");
// // const jwt = require("jsonwebtoken");
// // // const nodemailer = require("nodemailer");
// // const dotenv = require("dotenv");
// // import { generateUserOtp } from "./src/user/user.service.js";
// // // import { generateUserOtp } from "./src/user/user.service.js";
// // // import { sendOtp } from "./src/utils/nodemailer";
// // dotenv.config();

// // const app = express();
// // app.use(express.json());

// // const prisma = new PrismaClient();
// // const secretKey = process.env.JWT_SECRET || "your-secret-key-for-jwt"; // Fallback for dev

// // // const sendOtp = async (email, otp) => {
// // //   try {
// // //     const transporter = nodemailer.createTransport({
// // //       host: process.env.SMTP_HOST || "smtp.gmail.com",
// // //       port: 465,
// // //       secure: true,
// // //       auth: {
// // //         user: process.env.SMTP_USER,
// // //         pass: process.env.SMTP_PASS,
// // //       },
// // //     });

// // //     console.log(process.env.SMTP_PASS, "Password+++++++");
// // //     console.log(process.env.SMTP_USER, "user+++++++");

// // //     const mailOptions = {
// // //       from: process.env.SMTP_USER,
// // //       to: "muriukijames33@gmail.com",
// // //       subject: "Your OTP",
// // //       text: `Your OTP is: ${otp}. It expires in 45 seconds.`,
// // //     };

// // //     console.log(mailOptions, "Here is the mail options");

// // //     const info = await transporter.sendMail(mailOptions);
// // //   } catch (e) {
// // //     console.log("Here is the error", e);
// // //     throw e;
// // //   }
// // // };

// app.post("/register", async (req, res) => {
//   try {
//     const { fullName, email, phoneNumber, password } = req.body;

//     if (!fullName || !email || !phoneNumber || !password) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await prisma.user.create({
//       data: {
//         fullName,
//         email,
//         phoneNumber,
//         password: hashedPassword,
//       },
//     });

//     res.json({ message: "User created successfully", userId: user.id });
//   } catch (error) {
//     if (error instanceof Prisma.PrismaClientKnownRequestError) {
//       if (error.code === "P2002") {
//         return res.status(409).json({ message: "Email already exists" });
//       }
//     }
//     console.error(error);
//     res.status(500).json({ message: "Failed to create user" });
//   }
// });

//  app.post("/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "Email and password are required" });
//     }

//     const user = await prisma.user.findUnique({ where: { email } });

//     if (!user) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     const isValidPassword = await bcrypt.compare(password, user.password);

//     if (!isValidPassword) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: "1h" });

//     res.json({ token });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Failed to login" });
//   }
// });

// // app.post("/generate-otp", async (req, res) => {
// //   return await generateUserOtp(req, res);
// // });

// // app.post("/verify-otp", async (req, res) => {
// //   try {
// //     const { email, otp } = req.body;

// //     if (!email || !otp) {
// //       return res.status(400).json({ message: "Email and OTP are required" });
// //     }

// //     const user = await prisma.user.findUnique({ where: { email } });

// //     if (!user) {
// //       return res.status(404).json({ message: "User not found" });
// //     }

// //     const otpRecord = await prisma.otp.findFirst({
// //       where: {
// //         userId: user.id,
// //         otp,
// //       },
// //     });

// //     if (!otpRecord) {
// //       return res.status(401).json({ message: "Invalid OTP" });
// //     }

// //     const now = new Date();
// //     if (now > otpRecord.expiresAt) {
// //       return res.status(401).json({ message: "OTP has expired" });
// //     }
// //     await prisma.otp.delete({ where: { id: otpRecord.id } });

// //     res.json({ message: "OTP verified successfully" });
// //   } catch (error) {
// //     console.error(error);
// //     res.status(500).json({ message: "Failed to verify OTP" });
// //   }
// // });

// // const port = process.env.PORT || 5000;
// // app.listen(port, () => {
// //   console.log(`Server listening on port ${port}`);
// // });

// import express from "express";
// import { generateUserOtp } from "./src/user/user.service.js";

// const app = express();

// app.use(express.json()); // Required to parse req.body

// app.post("/generate-otp", generateUserOtp); // Mount the route handler

// app.listen(3000, () => console.log("Server running on port 3000"));

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userController from "./src/user/user.controller.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
console.log("userController:", userController);

app.post("/register", userController.register);
app.post("/login", userController.login);
app.post("/generate-otp", userController.generateOtp);
app.post("/verify-otp", userController.verifyOtp);

const port = process.env.PORT || 5002;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
