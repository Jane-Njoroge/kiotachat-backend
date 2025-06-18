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

import axios from "axios";
import nodemailer from "nodemailer";
import { Queue, Worker } from "bullmq";

// Initialize BullMQ queue
const emailQueue = new Queue("email-queue", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// Function to send OTP
export const sendOtp = async (email, otp, retries = 2) => {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    console.error("Invalid email address provided:", email);
    throw new Error("Invalid email address");
  }

  const jobData = {
    email,
    otp,
    subject: "Your Kiotapay OTP",
    text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
    retries,
  };

  try {
    const job = await emailQueue.add("send-otp", jobData, {
      jobId: `otp-${email}-${Date.now()}`, // Unique job ID
    });
    console.log("OTP email job queued:", { jobId: job.id, email });
    return { message: "OTP email queued successfully" };
  } catch (queueError) {
    console.error("Failed to queue OTP email:", queueError.message);
    throw new Error("Failed to queue OTP email");
  }
};

// Worker to process email queue
const worker = new Worker(
  "email-queue",
  async (job) => {
    const { email, otp, subject, text, retries } = job.data;
    console.log("Processing email job:", { jobId: job.id, email });

    // Try external API first
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const response = await axios.post(
          "https://fms-backend-staging.staging.kiotapay.co.ke/api/v1/emails/send",
          { to: email, subject, text },
          {
            headers: {
              Authorization: `Bearer ${process.env.EMAIL_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            timeout: 3000, // Reduced timeout for faster failover
          }
        );
        console.log("OTP email sent via API:", {
          jobId: job.id,
          response: response.data,
        });
        return response.data;
      } catch (apiError) {
        console.error(`API email error (attempt ${attempt}/${retries + 1}):`, {
          message: apiError.message,
          response: apiError.response?.data,
        });
        if (attempt > retries) {
          console.log("Exhausted API retries, falling back to SMTP");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }

    // Fallback to SMTP
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const mailOptions = {
          from: `"Kiotapay" <${process.env.SMTP_USER}>`,
          to: email,
          subject,
          text,
        };

        console.log(
          `Attempting SMTP send (attempt ${attempt}/${retries + 1}):`,
          { email }
        );
        const info = await transporter.sendMail(mailOptions);
        console.log("SMTP email sent:", {
          jobId: job.id,
          response: info.response,
        });
        return {
          message: "OTP sent successfully via SMTP",
          info: info.response,
        };
      } catch (smtpError) {
        console.error(
          `SMTP email error (attempt ${attempt}/${retries + 1}):`,
          smtpError.message
        );
        if (attempt > retries) {
          throw new Error("Failed to send OTP email via SMTP");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }

    throw new Error("Failed to send OTP email after all retries");
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
    },
  }
);

// Handle worker errors
worker.on("failed", (job, err) => {
  console.error("Email job failed:", {
    jobId: job?.id,
    email: job?.data?.email,
    error: err.message,
  });
});

worker.on("completed", (job) => {
  console.log("Email job completed:", { jobId: job.id, email: job.data.email });
});
