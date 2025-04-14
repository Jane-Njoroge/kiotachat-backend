// import nodemailer from "nodemailer";

// export const sendOtp = async (email, otp) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST || "smtp.gmail.com",
//       port: 465,
//       secure: true,
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     console.log(process.env.SMTP_PASS, "Password+++++++");
//     console.log(process.env.SMTP_USER, "user+++++++");

//     const mailOptions = {
//       from: process.env.SMTP_USER,
//       to: "muriukijames33@gmail.com",
//       subject: "Your OTP",
//       text: `Your OTP is: ${otp}. It expires in 45 seconds.`,
//     };

//     console.log(mailOptions, "Here is the mail options");

//     const info = await transporter.sendMail(mailOptions);
//   } catch (e) {
//     console.log("Here is the error", e);
//     throw e;
//   }
// };
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
      from: process.env.SMTP_USER,
      to: email,
      subject: "Your OTP",
      text: `Your OTP is: ${otp}. It expires in 45 seconds.`,
    };

    await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully");
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};
