import axios from "axios";
import nodemailer from "nodemailer";

export const sendOtp = async (email, otp, retries = 1) => {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error("Invalid email address");
  }

  // Try external API first
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const data = {
        to: email,
        subject: "Your OTP",
        text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
      };

      console.log(`Attempt ${attempt} to send OTP via API:`, data);

      const response = await axios.post(
        // "https://fms-backend-staging.staging.kiotapay.co.ke/api/v1/emails/send",
        "https://fmsapi.kiotapay.co/api/v1/emails/send",
        data,
        {
          headers: {
            Authorization: `Bearer ${process.env.EMAIL_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("API response:", response.data);
      if (response.data.message) {
        console.log("OTP email sent successfully via API");
        return response.data;
      }
    } catch (apiError) {
      console.error(
        `API email error (attempt ${attempt}):`,
        apiError.response?.data || apiError.message
      );
      if (attempt > retries) {
        break; // Proceed to SMTP fallback
      }
    }
  }

  // Fallback to SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Kiotapay" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP",
      text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
    };

    console.log("Attempting to send OTP via SMTP:", mailOptions);
    const info = await transporter.sendMail(mailOptions);
    console.log("SMTP email sent:", info.response);
    return { message: "OTP sent successfully via SMTP" };
  } catch (smtpError) {
    console.error("SMTP email error:", smtpError);
    throw new Error("Failed to send OTP email: " + smtpError.message);
  }
};
