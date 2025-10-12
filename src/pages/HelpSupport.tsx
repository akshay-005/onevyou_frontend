import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Phone, Mail, MessageCircle, CreditCard, Shield, Users, HelpCircle, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HelpSupport() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 hover:bg-primary/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              Help & Support
            </h1>
            <p className="text-muted-foreground">Everything you need to know about using ONEVYOU</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <h4 className="font-semibold text-foreground">Sign Up Options:</h4>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Register quickly using Google, Apple, Email, or Phone Number.</li>
                    <li>Verify your email or phone for secure account activation.</li>
                    <li>Minimum age requirements apply (13+ or as per local law).</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  How 1v1 Video Calls Work
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>After login, fans can browse celebrities who are online.</li>
                  <li>Click on the "Connect" button to request a 1v1 call.</li>
                  <li>Payments are processed upfront; all calls are paid and commission applies.</li>
                  <li>Once payment completes, the call initiates automatically or schedules for the set time.</li>
                  <li>Celebrities accept and engage fans live in video sessions.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Account Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Update your profile details anytime in "Account Settings."</li>
                  <li>Change payment methods or update contact info as needed.</li>
                  <li>Forgot password? Use "Reset Password" on login page.</li>
                  <li>Want to deactivate? Contact support for assistance.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payments & Refunds
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Payments are made securely through trusted gateways.</li>
                  <li>You'll see all fees upfront before completing payment.</li>
                  <li>Refund requests must be made within 48 hours and are subject to review.</li>
                  <li>Failed payments can be retried immediately in your account.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Community Guidelines Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>No nudity, harassment, hate speech, or illegal content permitted.</li>
                  <li>Do not record or share calls without all parties' consent.</li>
                  <li>Respect others—abuse results in suspension or ban.</li>
                  <li>Report violations with the built-in "Report" button.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Privacy & Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>We protect your data per our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.</li>
                  <li>Personal information is encrypted and never sold.</li>
                  <li>Manage your privacy settings and data preferences in your account.</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-xl border-border/50 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I schedule a call with a celebrity?</AccordionTrigger>
                  <AccordionContent>
                    Browse available celebrities, select one, choose your preferred time slot, and complete the payment. 
                    The call will be scheduled automatically once payment is confirmed.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>What happens if a celebrity cancels?</AccordionTrigger>
                  <AccordionContent>
                    If a celebrity cancels, you'll receive a full refund automatically within 3-5 business days. 
                    You'll also be notified via email and in-app notification.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Can I record the video call?</AccordionTrigger>
                  <AccordionContent>
                    Recording calls without explicit consent from all parties is strictly prohibited and may result in 
                    account suspension. Always ask for permission before recording.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I become a celebrity on the platform?</AccordionTrigger>
                  <AccordionContent>
                    Click on "Become a Teacher" on the homepage, complete the application form with your credentials, 
                    and our team will review your application within 48-72 hours.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                  <AccordionTrigger>What payment methods are accepted?</AccordionTrigger>
                  <AccordionContent>
                    We accept all major credit/debit cards, PayPal, and digital wallets like Apple Pay and Google Pay. 
                    All transactions are secured with industry-standard encryption.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-primary/20 bg-gradient-to-r from-card to-secondary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Reporting Issues & Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use our Support Form or email us for any problems.
                </p>
                <div className="flex flex-col gap-2">
                  <a 
                    href="mailto:jigilonevyou@gmail.com" 
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    jigilonevyou@gmail.com
                  </a>
                  <p className="text-sm text-muted-foreground">
                    <strong>Typical response time:</strong> 24-48 hours
                  </p>
                  <p className="text-sm text-destructive">
                    For urgent safety or harassment issues, contact us immediately.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}