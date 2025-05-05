import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userController from "./src/user/user.controller.js";
import { initializeSocket } from "./src/socket/socket.service.js";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);
app.use(express.json());
app.use(cookieParser());

app.post("/register", userController.register);
app.post("/login", userController.login);
app.post("/generate-otp", userController.generateOtp);
app.post("/verify-otp", userController.verifyOtp);
// app.get("/conversations", userController.getConversations);
app.get("/messages", userController.getMessages);
app.get("/users", userController.getUsers);
app.post("/conversations", userController.createConversation);
app.get("/admin-id", userController.getAdminId);

// const express = require("express");
// const userController = require("./src/user/user.controller.js");
// const app = express();
// app.use(express.json());
// app.use("/api", userController);
const port = process.env.PORT || 5002;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

initializeSocket(server);
