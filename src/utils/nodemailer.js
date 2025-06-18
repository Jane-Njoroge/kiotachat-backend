// import axios from "axios";
// import nodemailer from "nodemailer";

// export const sendOtp = async (email, otp, retries = 1) => {
//   if (!email || !/\S+@\S+\.\S+/.test(email)) {
//     throw new Error("Invalid email address");
//   }

//   // Try external API first
//   for (let attempt = 1; attempt <= retries + 1; attempt++) {
//     try {
//       const data = {
//         to: email,
//         subject: "Your OTP",
//         text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
//       };

//       console.log(`Attempt ${attempt} to send OTP via API:`, data);

//       const response = await axios.post(
//         "https://fms-backend-staging.staging.kiotapay.co.ke/api/v1/emails/send",
//         data,
//         {
//           headers: {
//             Authorization: `Bearer ${process.env.EMAIL_API_TOKEN}`,
//             "Content-Type": "application/json",
//           },
//           timeout: 5000, // 5s timeout
//         }
//       );

//       console.log("API response:", response.data);
//       if (response.data.message) {
//         console.log("OTP email sent successfully via API");
//         return response.data;
//       }
//     } catch (apiError) {
//       console.error(
//         `API email error (attempt ${attempt}):`,
//         apiError.response?.data || apiError.message
//       );
//       if (attempt > retries) {
//         break; // Proceed to SMTP fallback
//       }
//     }
//   }

//   // Fallback to SMTP
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: parseInt(process.env.SMTP_PORT, 10),
//       secure: process.env.SMTP_PORT === "465",
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     const mailOptions = {
//       from: `"Kiotapay" <${process.env.SMTP_USER}>`,
//       to: email,
//       subject: "Your OTP",
//       text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
//     };

//     console.log("Attempting to send OTP via SMTP:", mailOptions);
//     const info = await transporter.sendMail(mailOptions);
//     console.log("SMTP email sent:", info.response);
//     return { message: "OTP sent successfully via SMTP" };
//   } catch (smtpError) {
//     console.error("SMTP email error:", smtpError);
//     throw new Error("Failed to send OTP email: " + smtpError.message);
//   }
// };

// import axios from "axios";
// import nodemailer from "nodemailer";

// export const sendOtp = async (email, otp, retries = 1) => {
//   if (!email || !/\S+@\S+\.\S+/.test(email)) {
//     throw new Error("Invalid email address");
//   }

//   // Try external API first
//   for (let attempt = 1; attempt <= retries + 1; attempt++) {
//     try {
//       const data = {
//         to: email,
//         subject: "Your OTP",
//         text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
//       };

//       console.log(`Attempt ${attempt} to send OTP via API:`, { to: email });
//       const response = await axios.post(
//         "https://fms-backend-staging.staging.kiotapay.co.ke/api/v1/emails/send",
//         data,
//         {
//           headers: {
//             Authorization: `Bearer ${process.env.EMAIL_API_TOKEN}`,
//             "Content-Type": "application/json",
//           },
//           timeout: 5000,
//         }
//       );

//       console.log("API response:", response.data);
//       if (response.data.message) {
//         console.log("OTP email sent successfully via API");
//         return response.data;
//       }
//     } catch (apiError) {
//       console.error(
//         `API email error (attempt ${attempt}):`,
//         apiError.response?.data || apiError.message
//       );
//       if (attempt > retries) {
//         break;
//       }
//     }
//   }

//   // Fallback to SMTP
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST || "smtp.gmail.com",
//       port: parseInt(process.env.SMTP_PORT || "587", 10),
//       secure: false, // Use TLS for port 587
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//       logger: true, // Enable logging for debugging
//       debug: true, // Include debug output
//     });

//     const mailOptions = {
//       from: `"Kiotachat" <${process.env.SMTP_USER}>`,
//       to: email,
//       subject: "Your OTP",
//       text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
//     };

//     console.log("Attempting to send OTP via SMTP:", {
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       user: process.env.SMTP_USER,
//     });
//     const info = await transporter.sendMail(mailOptions);
//     console.log("SMTP email sent:", info.response);
//     return { message: "OTP sent successfully via SMTP" };
//   } catch (smtpError) {
//     console.error("SMTP email error:", {
//       message: smtpError.message,
//       code: smtpError.code,
//       response: smtpError.response,
//     });
//     throw new Error("Failed to send OTP email: " + smtpError.message);
//   }
// };

import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendOtp = async (email, otp) => {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error("Invalid email address");
  }

  const msg = {
    to: email,
    from: "your-verified-sender@yourdomain.com",
    subject: "Your OTP",
    text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
  };

  try {
    console.log("Attempting to send OTP via SendGrid:", { to: email });
    await sgMail.send(msg);
    console.log("OTP email sent via SendGrid");
    return { message: "OTP sent successfully via SendGrid" };
  } catch (error) {
    console.error("SendGrid error:", {
      message: error.message,
      response: error.response?.body,
    });
    throw new Error("Failed to send OTP email: " + error.message);
  }
};
