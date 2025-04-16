import nodemailer from "nodemailer";

export const sendOtp = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"NoReply" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ OTP sent to:", email);
  } catch (error) {
    console.error("❌ Failed to send OTP:", error.message);
    throw new Error("OTP sending failed");
  }
};
