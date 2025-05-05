// import nodemailer from "nodemailer";

// export const sendOtp = async (email, otp) => {
//   console.log(`OTP for ${email}: ${otp}`);

//   if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
//     throw new Error(
//       "SMTP_USER and SMTP_PASS environment variables must be set."
//     );
//   }

//   try {
//     // Log credentials safely (mask password)
//     console.log("Using SMTP credentials:", {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS
//         ? "***" + process.env.SMTP_PASS.slice(-3)
//         : "undefined",
//     });

//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST || "smtp.gmail.com",
//       port: process.env.SMTP_PORT || 465,
//       secure: true,
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     const mailOptions = {
//       from: process.env.SMTP_USER,
//       to: email,
//       subject: "Your OTP",
//       text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
//     };

//     await transporter.sendMail(mailOptions);
//     console.log("OTP email sent successfully");
//   } catch (error) {
//     console.error("Error sending OTP email:", error);
//     throw new Error("Failed to send OTP email: " + error.message);
//   }
// };
