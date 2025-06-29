// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import userController from "./src/user/user.controller.js";
// import { initializeSocket } from "./src/socket/socket.service.js";
// import cookieParser from "cookie-parser";
// import http from "http";
// import prisma from "./src/prisma.js";
// import multer from "multer";
// import path from "path";
// import { fileURLToPath } from "url";
// import fs from "fs";

// dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const uploadDir = path.join(__dirname, "Uploads");
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
//   console.log("Created Uploads directory:", uploadDir);
// }

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
//       console.log(`CORS check for origin: ${origin}`);
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, origin || "https://kiotachat-frontend.vercel.app");
//       } else {
//         console.error(`CORS rejected: ${origin}`);
//         callback(new Error(`Origin ${origin} not allowed by CORS`));
//       }
//     },
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     credentials: true,
//     allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
//     exposedHeaders: ["Set-Cookie", "x-user-id"],
//   })
// );

// app.options("*", cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

// app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

// const handleMulterError = (err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     console.error("Multer error:", err);
//     return res
//       .status(400)
//       .json({ message: `File upload error: ${err.message}` });
//   } else if (err) {
//     console.error("File upload error:", err);
//     return res
//       .status(400)
//       .json({ message: `File upload error: ${err.message}` });
//   }
//   next();
// };

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, path.join(__dirname, "Uploads"));
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + "-" + file.originalname);
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // Reduced to 5MB to match frontend
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       "image/jpeg",
//       "image/png",
//       "image/gif", // Added GIF to match frontend
//       "application/pdf",
//     ];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error("Invalid file type. Allowed: JPEG, PNG, GIF, PDF"), false);
//     }
//   },
// });

// app.use((req, res, next) => {
//   console.log(
//     `Incoming request: ${req.method} ${req.url}, Origin: ${req.headers.origin}, Cookies:`,
//     req.cookies
//   );
//   next();
// });

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

// const restrictToAdmin = (req, res, next) => {
//   if (req.userRole !== "ADMIN") {
//     return res.status(403).json({ message: "Admin access required" });
//   }
//   next();
// };

// app.post("/register", userController.register);
// app.post("/login", userController.login);
// app.post("/generate-otp", userController.generateOtp);
// app.post("/verify-otp", userController.verifyOtp);
// app.post("/clear-cookies", (req, res) => {
//   res.clearCookie("userId", {
//     httpOnly: true,
//     secure: true,
//     sameSite: "none",
//     path: "/",
//   });
//   res.clearCookie("userRole", {
//     httpOnly: true,
//     secure: true,
//     sameSite: "none",
//     path: "/",
//   });
//   res.json({ message: "Cookies cleared" });
// });

// app.get("/me", async (req, res) => {
//   console.log("/me request received:", {
//     cookies: req.cookies,
//     headers: req.headers,
//     origin: req.headers.origin,
//   });

//   const userId = parseInt(req.cookies.userId, 10);
//   if (!userId || isNaN(userId)) {
//     console.log("/me: Invalid or missing userId", {
//       userId,
//       cookies: req.cookies,
//     });
//     return res.status(401).json({ message: "Authentication required" });
//   }

//   try {
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { id: true, role: true, fullName: true, email: true },
//     });

//     if (!user) {
//       console.log("/me: User not found", { userId });
//       return res.status(404).json({ message: "User not found" });
//     }

//     console.log("/me: User fetched successfully", {
//       userId: user.id,
//       role: user.role,
//       fullName: user.fullName,
//       email: user.email,
//     });

//     res.json({
//       userId: String(user.id),
//       role: user.role.toUpperCase(),
//       fullName: user.fullName,
//       email: user.email,
//     });
//   } catch (error) {
//     console.error("/me: Error fetching user", {
//       userId,
//       error: error.message,
//       stack: error.stack,
//     });
//     res.status(500).json({ message: "Failed to fetch user data" });
//   }
// });

// app.get("/conversations", userController.getConversations);
// app.post("/conversations", userController.createConversation);
// app.get("/messages", userController.getMessages);
// app.post(
//   "/upload-file",
//   upload.single("file"),
//   handleMulterError,
//   userController.uploadFile
// );
// app.post(
//   "/messages/upload",
//   upload.single("file"),
//   handleMulterError,
//   userController.uploadFile
// );
// app.put("/messages/:messageId", authenticate, userController.updateMessage);
// app.delete("/messages/:messageId", authenticate, userController.deleteMessage);
// app.get("/admins", userController.getAdmins);
// app.get("/users/admins", userController.getAdmins);
// app.post("/messages/forward", authenticate, userController.forwardMessage);
// app.get("/users", userController.getUsers);
// app.get("/search/conversations", userController.searchConversations);
// app.get("/search/users", userController.searchUsers);
// app.post("/conversations/:id/read", userController.markConversationAsRead);
// app.post(
//   "/messages/broadcast",
//   authenticate,
//   restrictToAdmin,
//   userController.broadcastMessage
// );

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
//     await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_otp_userid ON "OTP" (userId);`;
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
import multer from "multer";

dotenv.config();

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
      console.log(`CORS check for origin: ${origin}`);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || "https://kiotachat-frontend.vercel.app");
      } else {
        console.error(`CORS rejected: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
    exposedHeaders: ["Set-Cookie", "x-user-id"],
  })
);

app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err);
    return res
      .status(400)
      .json({ message: `File upload error: ${err.message}` });
  } else if (err) {
    console.error("File upload error:", err);
    return res
      .status(400)
      .json({ message: `File upload error: ${err.message}` });
  }
  next();
};

const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for S3 uploads
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: JPEG, PNG, GIF, PDF"), false);
    }
  },
});

app.use((req, res, next) => {
  console.log(
    `Incoming request: ${req.method} ${req.url}, Origin: ${req.headers.origin}, Cookies:`,
    req.cookies
  );
  // Set timeout for file upload requests
  if (
    req.url.includes("/upload-file") ||
    req.url.includes("/messages/upload")
  ) {
    req.setTimeout(30000); // 30 seconds timeout
  }
  next();
});

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

const restrictToAdmin = (req, res, next) => {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

app.post("/register", userController.register);
app.post("/login", userController.login);
app.post("/generate-otp", userController.generateOtp);
app.post("/verify-otp", userController.verifyOtp);
app.post("/clear-cookies", (req, res) => {
  res.clearCookie("userId", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  res.clearCookie("userRole", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  res.json({ message: "Cookies cleared" });
});

app.get("/me", async (req, res) => {
  console.log("/me request received:", {
    cookies: req.cookies,
    headers: req.headers,
    origin: req.headers.origin,
  });

  const userId = parseInt(req.cookies.userId, 10);
  if (!userId || isNaN(userId)) {
    console.log("/me: Invalid or missing userId", {
      userId,
      cookies: req.cookies,
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
app.post(
  "/upload-file",
  authenticate,
  upload.single("file"),
  handleMulterError,
  userController.uploadFile
);
app.post(
  "/messages/upload",
  authenticate,
  upload.single("file"),
  handleMulterError,
  userController.uploadFile
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
app.post(
  "/messages/broadcast",
  authenticate,
  restrictToAdmin,
  userController.broadcastMessage
);

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
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_otp_userid ON "OTP" (userId);`;
    console.log("Index created on User.email");
  } catch (error) {
    console.error("Failed to create index:", error);
  }
});
