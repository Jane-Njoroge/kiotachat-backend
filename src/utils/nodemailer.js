import axios from "axios";

export const sendOtp = async (email, otp) => {
  try {
    const data = {
      to: email,
      subject: "your otp",
      text: `Your OTP is: ${otp}. It expires in 300 seconds.`,
    };

    console.log("Sending OTP email with:", data);

    const response = await axios.post(
      "https://fms-backend-staging.staging.kiotapay.co.ke/api/v1/emails/send",
      data
    );

    console.log("Response from API:", response.data);

    if (response.data.message) {
      console.log("OTP email sent successfully");
      return response.data;
    } else {
      throw new Error(
        "Failed to send OTP email: " +
          (response.data.message || "No error message provided")
      );
    }
  } catch (error) {
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    throw new Error("Failed to send OTP email: " + error.message);
  }
};
