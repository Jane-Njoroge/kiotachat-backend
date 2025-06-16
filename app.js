import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userController from "./src/user/user.controller.js";
import { initializeSocket } from "./src/socket/socket.service.js";
import cookieParser from "cookie-parser";
import http from "http";
import prisma from "./src/prisma.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

initializeSocket(server);
const allowedOrigins = [
  process.env.FRONTEND_URL || "https://kiotapay.co.ke",
  "https://kiotachat-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log(`CORS origin check: ${origin}`);
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://localhost")
      ) {
        callback(null, origin || "https://kiotachat-frontend.vercel.app");
      } else {
        console.error(`CORS rejected: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
    exposedHeaders: ["Set-Cookie"],
  })
);

app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Ensure Uploads directory exists
const uploadsDir = path.join(__dirname, "Uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(UploadsDir, { recursive: true });
  fs.chmodSync(UploadsDir, 0o755);
}

app.use("/Uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Align with frontend (5MB)
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
});

app.use((req, res, next) => {
  console.log(
    `Incoming request: ${req.method} ${req.url}, Origin: ${req.headers.origin}, Cookies:`,
    req.cookies,
    `Headers:`,
    { "x-user-id": req.headers["x-user-id"] || "none" }
  );
  next();
});

app.post("/register", userController.register);
app.post("/login", userController.login);
app.post("/generate-otp", userController.generateOtp);
app.post("/verify-otp", userController.verifyOtp);
app.post("/clear-cookies", (req, res) => {
  res.clearCookie("userId", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: "lax",
    path: "/",
  });
  res.clearCookie("userRole", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Cookies cleared" });
});

app.get("/me", async (req, res) => {
  console.log("/me request received:", {
    cookies: req.cookies,
    headers: req.headers,
    origin: req.headers.origin,
    userIdCookie: req.cookies.userId,
    xUserIdHeader: req.headers["x-user-id"],
  });

  const userId = parseInt(req.cookies.userId || req.headers["x-user-id"], 10);
  if (!userId || isNaN(userId)) {
    console.log("/me: Invalid or missing userId", {
      userId,
      cookies: req.cookies,
      headers: req.headers,
    });
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, fullName: true, email: true },
    });

    if (!user) {
      console.log("/me: User not found", { userId });
      return res.status(404).json({ message: "User not found" });
    }

    console.log("/me: User fetched successfully", {
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
    });

    res.json({
      userId: String(user.id),
      role: user.role.toUpperCase(),
      fullName: user.fullName,
      email: user.email,
    });
  } catch (error) {
    console.error("/me: Error fetching user", {
      userId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Failed to fetch user data" });
  }
});

app.get("/conversations", userController.getConversations);
app.post("/conversations", userController.createConversation);
app.get("/messages", userController.getMessages);
app.post("/upload-file", upload.single("file"), userController.uploadFile);
app.post("/messages/upload", upload.single("file"), userController.uploadFile);

const authenticate = async (req, res, next) => {
  const userId = parseInt(req.cookies.userId || req.headers["x-user-id"], 10);
  if (!userId || isNaN(userId)) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  req.userId = userId;
  req.userRole = user.role.toUpperCase();
  next();
};

app.put("/messages/:messageId", authenticate, userController.updateMessage);
app.delete("/messages/:messageId", authenticate, userController.deleteMessage);
app.get("/admins", userController.getAdmins);
app.get("/users/admins", userController.getAdmins);
app.post("/messages/forward", authenticate, userController.forwardMessage);
app.get("/users", userController.getUsers);
app.get("/search/conversations", userController.searchConversations);
app.get("/search/users", userController.searchUsers);
app.post("/conversations/:id/read", userController.markConversationAsRead);

app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ message: "Route not found" });
});

const port = process.env.PORT || 5002;
server.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  try {
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_user_email ON "User" (email);`;
    console.log("Index created on User.email");
  } catch (error) {
    console.error("Failed to create index:", error);
  }
});
