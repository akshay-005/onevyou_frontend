import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [fund, setFund] = useState(null);
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const ADMIN_PASS = "onevyou@2025"; // 👈 change this to anything private

  // Handle password check
  const handleLogin = () => {
    if (password === ADMIN_PASS) {
      setAuthorized(true);
      loadFund();
    } else {
      alert("Wrong password ❌");
    }
  };

  const loadFund = async () => {
    try {
      const res = await fetch("https://onevyou.onrender.com/api/admin/platform-transactions");
      const data = await res.json();
      setFund(data);
    } catch (err) {
      console.error("Error fetching fund:", err);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return alert("Enter valid amount");
    const res = await fetch("https://onevyou.onrender.com/api/admin/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    alert(data.message || "Withdrawal done!");
    loadFund();
    setWithdrawAmount("");
  };

  if (!authorized) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-4">🔒 Admin Login</h2>
        <input
          type="password"
          placeholder="Enter admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border px-3 py-2 rounded"
        />
        <button
          onClick={handleLogin}
          className="ml-3 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Enter
        </button>
      </div>
    );
  }

  if (!fund) return <p className="p-10">Loading fund data...</p>;

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">💼 Platform Dashboard</h1>
      <div className="border p-4 rounded mb-6">
        <p>Total Commission: <strong>₹{fund.totalCommission}</strong></p>
        <p>Available Balance: <strong>₹{fund.availableBalance}</strong></p>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold mb-2">Withdraw Platform Funds</h3>
        <input
          type="number"
          placeholder="Enter amount"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          className="border px-3 py-2 rounded mr-2"
        />
        <button
          onClick={handleWithdraw}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Withdraw
        </button>
      </div>

      <h3 className="font-semibold mb-2">Transaction History</h3>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="p-2">Type</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Description</th>
            <th className="p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {fund.transactions?.map((t, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{t.type}</td>
              <td className="p-2">₹{t.amount}</td>
              <td className="p-2">{t.description}</td>
              <td className="p-2">
                {new Date(t.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
