// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import userController from "./src/user/user.controller.js";
// import { initializeSocket } from "./src/socket/socket.service.js";
// import cookieParser from "cookie-parser";
// import http from "http";

// dotenv.config();

// const app = express();
// const server = http.createServer(app);

// initializeSocket(server);

// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
//   console.log(`Incoming request: ${req.method} ${req.url}`);
//   next();
// });

// app.post("/register", userController.register);
// app.post("/login", userController.login);
// app.post("/generate-otp", userController.generateOtp);
// app.post("/verify-otp", userController.verifyOtp);

// app.get("/conversations", userController.getConversations);
// app.post("/conversations", (req, res, next) => {
//   console.log("POST /conversations hit with body:", req.body);
//   userController.createConversation(req, res, next);
// });

// app.get("/messages", userController.getMessages);
// const authenticate = async (req, res, next) => {
//   let userId =
//     req.cookies.userId ||
//     req.headers["x-user-id"] ||
//     req.body.userId ||
//     req.query.userId; // Add query as fallback
//   if (!userId || isNaN(parseInt(userId, 10))) {
//     console.log("Authentication failed: No valid userId found", {
//       cookies: req.cookies,
//       headers: req.headers,
//       body: req.body,
//       query: req.query,
//     });
//     return res.status(401).json({ message: "Authentication required" });
//   }
//   req.userId = parseInt(userId, 10);
//   console.log("Authenticated userId:", req.userId, "for request:", {
//     method: req.method,
//     url: req.url,
//   });
//   next();
// };
// // const authenticate = async (req, res, next) => {
// //   const userId = req.cookies.userId || req.headers["x-user-id"];
// //   if (!userId || isNaN(parseInt(userId, 10))) {
// //     return res.status(401).json({ message: "Authentication required" });
// //   }
// //   req.userId = parseInt(userId, 10);
// //   next();
// // };
// app.put("/messages/:messageId", authenticate, userController.updateMessage);

// app.get("/users", userController.getUsers);
// // app.get("/admin-id", userController.getAdminId);
// // app.get("/users/:id", userController.getUserById);

// app.get("/search/conversations", userController.searchConversations);
// app.get("/search/users", userController.searchUsers);

// app.post("/conversations/:id/read", userController.markConversationAsRead);

// app.use((req, res) => {
//   console.log(`Route not found: ${req.method} ${req.url}`);
//   res.status(404).json({ message: "Route not found" });
// });

// const port = process.env.PORT || 5002;
// server.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userController from "./src/user/user.controller.js";
import { initializeSocket } from "./src/socket/socket.service.js";
import cookieParser from "cookie-parser";
import http from "http";

dotenv.config();

const app = express();
const server = http.createServer(app);

initializeSocket(server);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

app.use((req, res, next) => {
  console.log(
    `Incoming request: ${req.method} ${req.url}, Cookies:`,
    req.cookies
  );
  next();
});

app.post("/register", userController.register);
app.post("/login", userController.login);
app.post("/generate-otp", userController.generateOtp);
app.post("/verify-otp", userController.verifyOtp);

app.get("/conversations", userController.getConversations);
app.post("/conversations", (req, res, next) => {
  console.log(
    "POST /conversations hit with body:",
    req.body,
    "Cookies:",
    req.cookies
  );
  userController.createConversation(req, res, next);
});

app.get("/messages", userController.getMessages);

const authenticate = async (req, res, next) => {
  let userId =
    req.cookies.userId ||
    req.headers["x-user-id"] ||
    req.body.userId ||
    req.query.userId;
  console.log(
    "Authenticate middleware - userId:",
    userId,
    "Cookies:",
    req.cookies
  );
  if (!userId || isNaN(parseInt(userId, 10))) {
    console.log("Authentication failed: No valid userId found", {
      cookies: req.cookies,
      headers: req.headers,
      body: req.body,
      query: req.query,
    });
    return res.status(401).json({ message: "Authentication required" });
  }
  req.userId = parseInt(userId, 10);
  console.log("Authenticated userId:", req.userId, "for request:", {
    method: req.method,
    url: req.url,
  });
  next();
};

app.put("/messages/:messageId", authenticate, userController.updateMessage);

app.get("/users", userController.getUsers);
app.get("/search/conversations", userController.searchConversations);
app.get("/search/users", userController.searchUsers);
app.post("/conversations/:id/read", userController.markConversationAsRead);

app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ message: "Route not found" });
});

const port = process.env.PORT || 5002;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
