// import axios from "axios";

// export const sendOtp = async (email, otp) => {
//   if (!email || !/\S+@\S+\.\S+/.test(email)) {
//     throw new Error("Invalid email address");
//   }
//   try {
//     const data = {
//       to: email,
//       subject: "your otp",
//       text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
//     };

//     console.log("Sending OTP email with:", data);

//     const response = await axios.post(
//       "https://fms-backend-staging.staging.kiotapay.co.ke/api/v1/emails/send",
//       data,
//       {
//         headers: {
//           Authorization: `Bearer YOUR_API_TOKEN`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("Response from API:", response.data);

//     if (response.data.message) {
//       console.log("OTP email sent successfully");
//       return response.data;
//     } else {
//       throw new Error(
//         "Failed to send OTP email: " +
//           (response.data.message || "No error message provided")
//       );
//     }
//   } catch (error) {
//     if (error.response) {
//       console.error("Error response data:", error.response.data);
//       console.error("Error response status:", error.response.status);
//       console.error("Error response headers:", error.response.headers);
//     } else if (error.request) {
//       console.error("No response received:", error.request);
//     } else {
//       console.error("Error setting up request:", error.message);
//     }
//     throw new Error("Failed to send OTP email: " + error.message);
//   }
// };
import axios from "axios";
import nodemailer from "nodemailer";

export const sendOtp = async (email, otp) => {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error("Invalid email address");
  }

  // Try external API first
  try {
    const data = {
      to: email,
      subject: "Your OTP",
      text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
    };

    console.log("Attempting to send OTP via API:", data);

    const response = await axios.post(
      "https://fms-backend-staging.staging.kiotapay.co.ke/api/v1/emails/send",
      data,
      {
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("API response:", response.data);
    if (response.data.message) {
      console.log("OTP email sent successfully via API");
      return response.data;
    }
  } catch (apiError) {
    console.error(
      "API email error:",
      apiError.response?.data || apiError.message
    );

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
  }
};
