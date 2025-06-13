// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import userController from "./src/user/user.controller.js";
// import { initializeSocket } from "./src/socket/socket.service.js";
// import cookieParser from "cookie-parser";
// import http from "http";
// import prisma from "./src/prisma.js";

// dotenv.config();

// const app = express();
// const server = http.createServer(app);

// initializeSocket(server);
// const allowedOrigins = [
//   process.env.FRONTEND_URL || "https://kiotapay.co.ke",
//   "https://kiotachat-frontend.vercel.app",
//   "http://localhost:3000",
// ];

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     credentials: true,
//     allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
//     exposedHeaders: ["Set-Cookie"],
//   })
// );

// app.options("*", cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

// app.use((req, res, next) => {
//   console.log(
//     `Incoming request: ${req.method} ${req.url}, Origin: ${req.headers.origin}, Cookies:`,
//     req.cookies
//   );
//   next();
// });

// app.post("/register", userController.register);
// app.post("/login", userController.login);
// app.post("/generate-otp", userController.generateOtp);
// app.post("/verify-otp", userController.verifyOtp);
// app.post("/clear-cookies", (req, res) => {
//   res.clearCookie("userId", {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "none",
//     path: "/",
//   });
//   res.clearCookie("userRole", {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "none",
//     path: "/",
//   });
//   res.json({ message: "Cookies cleared" });
// });

// app.get("/me", async (req, res) => {
//   const userId = parseInt(req.cookies.userId, 10);
//   if (!userId || isNaN(userId)) {
//     return res.status(401).json({ message: "Authentication required" });
//   }
//   try {
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { id: true, role: true, fullName: true },
//     });
//     if (!user) {
//       return res.status(401).json({ message: "User not found" });
//     }
//     res.json({
//       userId: String(user.id),
//       role: user.role.toUpperCase(),
//       fullName: user.fullName,
//     });
//   } catch (error) {
//     console.error("Get user error:", error);
//     res.status(500).json({ message: "Failed to fetch user" });
//   }
// });

// app.get("/conversations", userController.getConversations);
// app.post("/conversations", userController.createConversation);
// app.get("/messages", userController.getMessages);

// const authenticate = async (req, res, next) => {
//   const userId = parseInt(req.cookies.userId || req.headers["x-user-id"], 10);
//   if (!userId || isNaN(userId)) {
//     return res.status(401).json({ message: "Authentication required" });
//   }
//   const user = await prisma.user.findUnique({
//     where: { id: userId },
//     select: { id: true, role: true },
//   });
//   if (!user) {
//     return res.status(401).json({ message: "User not found" });
//   }
//   req.userId = userId;
//   req.userRole = user.role.toUpperCase();
//   next();
// };

// app.put("/messages/:messageId", authenticate, userController.updateMessage);
// app.delete("/messages/:messageId", authenticate, userController.deleteMessage);
// app.get("/admins", userController.getAdmins);
// app.get("/users/admins", userController.getAdmins);
// app.post("/messages/forward", authenticate, userController.forwardMessage);
// app.get("/users", userController.getUsers);
// app.get("/search/conversations", userController.searchConversations);
// app.get("/search/users", userController.searchUsers);
// app.post("/conversations/:id/read", userController.markConversationAsRead);

// app.use((req, res, next) => {
//   console.log(
//     `Request: ${req.method} ${req.url}, Origin: ${req.headers.origin}, Headers:`,
//     req.headers,
//     `Cookies:`,
//     req.cookies
//   );
//   next();
// });

// app.use((req, res) => {
//   console.log(`Route not found: ${req.method} ${req.url}`);
//   res.status(404).json({ message: "Route not found" });
// });

// const port = process.env.PORT || 5002;
// server.listen(port, async () => {
//   console.log(`Server running on port ${port}`);

//   try {
//     await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_user_email ON "User" (email);`;
//     console.log("Index created on User.email");
//   } catch (error) {
//     console.error("Failed to create index:", error);
//   }
// });

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userController from "./src/user/user.controller.js";
import { initializeSocket } from "./src/socket/socket.service.js";
import cookieParser from "cookie-parser";
import http from "http";
import prisma from "./src/prisma.js";
import multer from "multer"; // Added for file uploads
import path from "path"; // Added for file path handling
import { fileURLToPath } from "url"; // Added for __dirname equivalent

dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

initializeSocket(server);
const allowedOrigins = [
  process.env.FRONTEND_URL || "https://kiotapay.co.ke",
  "https://kiotachat-frontend.vercel.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads")); // Store in ./uploads
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPEG, GIF, or PDF files are allowed"));
    }
  },
});

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  console.log(
    `Incoming request: ${req.method} ${req.url}, Origin: ${req.headers.origin}, Cookies:`,
    req.cookies
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    path: "/",
  });
  res.clearCookie("userRole", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    path: "/",
  });
  res.json({ message: "Cookies cleared" });
});

app.get("/me", async (req, res) => {
  const userId = parseInt(req.cookies.userId, 10);
  if (!userId || isNaN(userId)) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, fullName: true },
    });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({
      userId: String(user.id),
      role: user.role.toUpperCase(),
      fullName: user.fullName,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

app.get("/conversations", userController.getConversations);
app.post("/conversations", userController.createConversation);
app.get("/messages", userController.getMessages);

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

app.post(
  "/messages/upload",
  authenticate,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.filename
      }`;
      res.json({ fileUrl });
    } catch (error) {
      console.error("File upload error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to upload file" });
    }
  }
);

app.put("/messages/:messageId", authenticate, userController.updateMessage);
app.delete("/messages/:messageId", authenticate, userController.deleteMessage);
app.get("/admins", userController.getAdmins);
app.get("/users/admins", userController.getAdmins);
app.post("/messages/forward", authenticate, userController.forwardMessage);
app.get("/users", userController.getUsers);
app.get("/search/conversations", userController.searchConversations);
app.get("/search/users", userController.searchUsers);
app.post("/conversations/:id/read", userController.markConversationAsRead);

app.use((req, res, next) => {
  console.log(
    `Request: ${req.method} ${req.url}, Origin: ${req.headers.origin}, Headers:`,
    req.headers,
    `Cookies:`,
    req.cookies
  );
  next();
});

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
