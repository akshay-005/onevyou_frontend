import { useState } from "react";

function OtpForm() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [otp, setOtp] = useState("");

  const handleSendOtp = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:3001/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, userName: name })
      });
      const data = await res.json();
      if (data.success) {
        setOtp(data.otp); // save OTP for testing
        setMessage("OTP sent successfully!");
      } else {
        setMessage("Failed to send OTP: " + data.error);
      }
    } catch (err) {
      setMessage("Error sending OTP: " + err.message);
    }
  };

  return (
    <div>
      <form onSubmit={handleSendOtp}>
        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Phone number with country code (e.g. +919876543210)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <button type="submit">Send OTP</button>
      </form>
      {message && <p>{message}</p>}
      {otp && <p>Test OTP (for dev only): {otp}</p>}
    </div>
  );
}

export default OtpForm;
