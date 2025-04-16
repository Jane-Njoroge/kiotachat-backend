import userService from "./user.service.js";

const userController = {
  async register(req, res) {
    try {
      const result = await userService.registerUser(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async login(req, res) {
    try {
      const result = await userService.loginUser(
        req.body.email,
        req.body.password
      );
      res.json(result); // Includes OTP for frontend display
    } catch (error) {
      res.status(401).json({ message: error.message });
    }
  },
  async generateOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const result = await userService.generateUserOtp(email);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  async verifyOtp(req, res) {
    try {
      const result = await userService.verifyUserOtp(
        req.body.email,
        req.body.otp
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};

export default userController;
