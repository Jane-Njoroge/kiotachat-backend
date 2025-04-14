import userService from "./user.service.js";

const userController = {
  async register(req, res) {
    try {
      const { fullName, email, phoneNumber, password } = req.body;

      if (
        !fullName?.trim() ||
        !email?.trim() ||
        !phoneNumber?.trim() ||
        !password?.trim()
      ) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const userId = await userService.registerUser({
        fullName,
        email,
        phoneNumber,
        password,
      });

      res.json({ message: "User created successfully", userId });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ message: "Email already exists" });
      }
      console.error(error);
      res.status(500).json({ message: "Failed to create user" });
    }
  },

  //   async login(req, res) {
  //     try {
  //       const { email, password } = req.body;

  //       if (!email || !password) {
  //         return res
  //           .status(400)
  //           .json({ message: "Email and password are required" });
  //       }

  //       const token = await userService.loginUser(email, password);

  //       res.json({ token });
  //     } catch (error) {
  //       console.error(error);
  //       res.status(500).json({ message: error.message || "Failed to login" });
  //     }
  //   },
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      const result = await userService.loginUser(email, password);
      if (result) {
        res.status(200).json(result); // Includes token, OTP, and success message
      } else {
        res.status(500).json({ message: "Failed to login" });
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.message) {
        res.status(401).json({ message: error.message });
      } else {
        res.status(500).json({ message: "An unexpected error occurred" });
      }
    }
  },

  async generateOtp(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      await userService.generateUserOtp(email);

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to generate OTP" });
    }
  },

  async verifyOtp(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      await userService.verifyUserOtp(email, otp);

      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: error.message || "Failed to verify OTP" });
    }
  },
};

export default userController;
