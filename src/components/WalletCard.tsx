import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Wallet, IndianRupee, TrendingUp, Clock, Download, CreditCard, Smartphone, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/utils/api";
import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/utils/socket";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WalletCard() {
  const { toast } = useToast();
  const socket = useSocket();
  
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("upi");
  const [showBankSetup, setShowBankSetup] = useState(false);
  const [withdrawalEligibility, setWithdrawalEligibility] = useState({
    canWithdraw: false,
    reason: "",
    nextEligibleDate: null,
    minAmount: 500
  });
  const [bankDetails, setBankDetails] = useState({
    accountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    bankName: "",
    upiId: "",
  });

  const fetchWallet = async () => {
    try {
      const res = await api.getWalletBalance();
      if (res.success) {
        setWallet(res.wallet);
      }
    } catch (err) {
      console.error("Fetch wallet error:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await api.getWalletTransactions();
      if (res.success) {
        setTransactions(res.transactions || []);
        checkWithdrawalEligibility(res.transactions);
      }
    } catch (err) {
      console.error("Fetch transactions error:", err);
    }
  };

  // ✅ Check withdrawal eligibility based on ₹500/7-day rule
  const checkWithdrawalEligibility = (txns) => {
    const lastCredit = txns
      .filter(t => t.type === "credit" && t.status === "completed")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    if (!lastCredit) {
      setWithdrawalEligibility({
        canWithdraw: false,
        reason: "No earnings yet",
        nextEligibleDate: null,
        minAmount: 500
      });
      return;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastCreditDate = new Date(lastCredit.createdAt);
    const eligibleByDays = lastCreditDate < sevenDaysAgo;
    
    const daysRemaining = eligibleByDays 
      ? 0 
      : Math.ceil((7 - (Date.now() - lastCreditDate.getTime()) / (24 * 60 * 60 * 1000)));

    setWithdrawalEligibility({
      canWithdraw: eligibleByDays,
      reason: eligibleByDays 
        ? "You can withdraw any amount" 
        : `Wait ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''} or withdraw ₹500+`,
      nextEligibleDate: eligibleByDays ? null : new Date(lastCreditDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      minAmount: eligibleByDays ? 1 : 500
    });
  };

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
    
    // Listen for wallet updates
    if (socket) {
      socket.on("wallet:updated", (data) => {
        console.log("💰 Wallet updated event received:", data);
        
        // ✅ Force immediate refresh
        setTimeout(() => {
          fetchWallet();
          fetchTransactions();
        }, 500);
        
        if (data.isRefund) {
          toast({
            title: "💸 Instant Refund Received",
            description: `₹${data.amount} added to your wallet. ${data.message || data.reason}`,
            duration: 5000,
          });
        } else {
          toast({
            title: "💰 Earnings Credited!",
            description: `You earned ₹${data.amount} from your last call! Balance: ₹${data.newBalance}`,
            duration: 5000,
          });
        }
      });

      // ✅ Also listen for dashboard refresh trigger
      socket.on("refresh-dashboard", () => {
        console.log("🔄 Dashboard refresh triggered");
        fetchWallet();
        fetchTransactions();
      });
    }
    
    return () => {
      if (socket) {
        socket.off("wallet:updated");
        socket.off("refresh-dashboard");
      }
    };
  }, [socket]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // ✅ Check eligibility rules
    if (!withdrawalEligibility.canWithdraw && amount < 500) {
      toast({
        title: "Withdrawal Not Eligible",
        description: withdrawalEligibility.reason,
        variant: "destructive",
      });
      return;
    }
    
    if (amount > wallet.availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough balance to withdraw this amount",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const res = await api.requestWithdrawal(amount, withdrawMethod);
      
      if (res.success) {
        toast({
          title: "✅ Withdrawal Requested",
          description: res.message,
        });
        setShowWithdraw(false);
        setWithdrawAmount("");
        fetchWallet();
        fetchTransactions();
      } else {
        toast({
          title: "Withdrawal Failed",
          description: res.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Withdrawal error:", err);
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleSaveBankDetails = async () => {
    try {
      const res = await api.updateBankDetails(bankDetails);
      
      if (res.success) {
        toast({
          title: "✅ Bank Details Saved",
          description: "Your bank details have been updated",
        });
        setShowBankSetup(false);
      } else {
        toast({
          title: "Error",
          description: res.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Save bank details error:", err);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case "credit":
        return "💰";
      case "refund":
        return "💸";
      case "withdrawal":
        return "📤";
      case "pending":
        return "⏳";
      default:
        return "💳";
    }
  };

  if (!wallet) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading wallet...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> My Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Available Balance */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                  <IndianRupee className="h-6 w-6" />
                  {wallet.availableBalance.toFixed(0)}
                </p>
                
                {/* ✅ Show withdrawal eligibility info */}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Min. withdrawal: ₹{withdrawalEligibility.minAmount}
                  </p>
                  {!withdrawalEligibility.canWithdraw && withdrawalEligibility.nextEligibleDate && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Full access: {formatDate(withdrawalEligibility.nextEligibleDate)}
                    </p>
                  )}
                  {withdrawalEligibility.canWithdraw && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ You can withdraw any amount
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setShowWithdraw(true)}
                  disabled={wallet.availableBalance <= 0}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Withdraw
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBankSetup(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Bank Details
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-blue-600" />
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <p className="text-lg font-bold text-blue-600 flex items-center gap-0.5">
                <IndianRupee className="h-4 w-4" />
                {wallet.pendingBalance.toFixed(0)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </div>
              <p className="text-lg font-bold text-purple-600 flex items-center gap-0.5">
                <IndianRupee className="h-4 w-4" />
                {wallet.totalEarned.toFixed(0)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Download className="h-4 w-4 text-orange-600" />
                <p className="text-xs text-muted-foreground">Withdrawn</p>
              </div>
              <p className="text-lg font-bold text-orange-600 flex items-center gap-0.5">
                <IndianRupee className="h-4 w-4" />
                {wallet.totalWithdrawn.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="pt-2">
            <h4 className="text-sm font-semibold mb-3">Recent Transactions</h4>
            <ScrollArea className="h-[200px] pr-4">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No transactions yet
                </p>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 10).map((txn, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getTransactionIcon(txn.type)}</span>
                        <div>
                          <p className="text-sm font-medium">
                            {txn.description || txn.type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(txn.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            txn.type === "credit" || txn.type === "refund"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {txn.type === "credit" || txn.type === "refund" ? "+" : "-"}₹
                          {Math.abs(txn.amount).toFixed(0)}
                        </p>
                        <Badge
                          variant={
                            txn.status === "completed"
                              ? "default"
                              : txn.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {txn.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>
              {withdrawalEligibility.canWithdraw 
                ? "You can withdraw any amount"
                : `Minimum: ₹${withdrawalEligibility.minAmount} or wait ${withdrawalEligibility.reason}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* ✅ Eligibility Alert */}
            {!withdrawalEligibility.canWithdraw && (
              <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-900 dark:text-orange-100">
                  <strong>Withdrawal Rules:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Withdraw ₹500+ anytime</li>
                    <li>OR wait 7 days after last earning to withdraw any amount</li>
                  </ul>
                  {withdrawalEligibility.nextEligibleDate && (
                    <p className="mt-2 font-medium">
                      Next eligible: {formatDate(withdrawalEligibility.nextEligibleDate)}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="pl-10"
                  min={withdrawalEligibility.minAmount}
                  max={wallet.availableBalance}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Available: ₹{wallet.availableBalance.toFixed(0)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Withdrawal Method</Label>
              <Tabs value={withdrawMethod} onValueChange={setWithdrawMethod}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upi">
                    <Smartphone className="h-4 w-4 mr-2" />
                    UPI
                  </TabsTrigger>
                  <TabsTrigger value="bank">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Bank Transfer
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                💡 Withdrawals are processed within 2-3 business days. You'll receive a notification once completed.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowWithdraw(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount ||
                parseFloat(withdrawAmount) <= 0 ||
                parseFloat(withdrawAmount) > wallet.availableBalance ||
                (!withdrawalEligibility.canWithdraw && parseFloat(withdrawAmount) < 500)
              }
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Confirm Withdrawal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Details Dialog */}
      <Dialog open={showBankSetup} onOpenChange={setShowBankSetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bank Account Details</DialogTitle>
            <DialogDescription>
              Add your bank details for withdrawals
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="bank" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bank">Bank Account</TabsTrigger>
              <TabsTrigger value="upi">UPI</TabsTrigger>
            </TabsList>

            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Account Holder Name</Label>
                <Input
                  placeholder="Enter account holder name"
                  value={bankDetails.accountHolderName}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, accountHolderName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  placeholder="Enter account number"
                  value={bankDetails.accountNumber}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input
                  placeholder="Enter IFSC code"
                  value={bankDetails.ifscCode}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  placeholder="Enter bank name"
                  value={bankDetails.bankName}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, bankName: e.target.value })
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="upi" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>UPI ID</Label>
                <Input
                  placeholder="yourname@upi"
                  value={bankDetails.upiId}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, upiId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Enter your UPI ID (e.g., 9876543210@paytm)
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={handleSaveBankDetails} className="w-full">
            Save Details
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}