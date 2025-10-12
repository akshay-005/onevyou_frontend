import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Terms() {
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

        <Card className="max-w-4xl mx-auto shadow-xl border-border/50 bg-card/95 backdrop-blur">
          <div className="p-8">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              Terms and Conditions
            </h1>
            <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-8 text-foreground/90">
                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">1. Acceptance of Terms</h2>
                  <p className="leading-relaxed">
                    By accessing or using the platform, users agree to these Terms and Conditions and our Privacy Policy. 
                    If they disagree, they may not use the service.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">2. Eligibility & Age Restrictions</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Minimum age: 13 (or higher if required by law in a user's jurisdiction).</li>
                    <li>If under 18, parental/guardian consent is required.</li>
                    <li>Children's use (including under COPPA, if US-based) is strictly forbidden unless compliant with the law.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">3. Account Registration & Security</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Users must provide accurate and current information.</li>
                    <li>Users are responsible for confidentiality and activity on their account.</li>
                    <li>The platform may require additional verification (e.g., ID, phone number) to prevent fake accounts or illegal activities.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">4. Paid Interactions & Payment Terms</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Fans must pay for all fan-celebrity interactions, including 1:1 calls, group sessions, content, or messaging.</li>
                    <li>Prices and commission/service charges are disclosed before purchase.</li>
                    <li>Refunds, where applicable, follow the Refund Policy.</li>
                    <li>Users must use only legitimate payment methods. Fraudulent activity results in account suspension.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">5. User Conduct & Prohibited Content</h2>
                  <p className="mb-3">
                    <strong>Explicitly prohibited:</strong> Nudity, pornography, sexually explicit behavior, obscene material, 
                    hate speech, harassment, threats, child exploitation, violence, self-harm encouragement, illegal activities, 
                    or intellectual property infringement.
                  </p>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Recording, sharing, or distributing calls/content without the written consent of all parties is forbidden.</li>
                    <li>Users may not attempt to circumvent platform moderation or security controls.</li>
                    <li>Abusive users will be suspended or banned, with severe violations reported to relevant authorities as required by law.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">6. Content Moderation & Reporting</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Content and interactions may be monitored and moderated for user safety and law compliance.</li>
                    <li>Users can and should report policy violations within the app; prompt platform action will follow, as required by law.</li>
                    <li>Content violating laws or platform policies will be deleted and preserved for evidence if legally required.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">7. Grievance Redressal & Dispute Resolution</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>A grievance mechanism is provided for user complaints (contact our support details below).</li>
                    <li>Disputes unresolved by support may proceed to arbitration or mediation as per the governing law clause.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">8. Intellectual Property</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Platform content, including user-generated material, is protected by copyright/trademark law.</li>
                    <li>Celebrity-owned content rights are retained, but commercial use by fans is strictly forbidden except by written contract.</li>
                    <li>Copyright/IP Takedown: The process for reporting and removing infringing material is available on request.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">9. Limitation of Liability & Disclaimers</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>The platform does not guarantee that all interactions are lawful or safe.</li>
                    <li>We are not liable for user-generated content or any damages except as required by applicable law.</li>
                    <li>Service is provided "as is"; use at your own risk.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">10. Governing Law & Jurisdiction</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Laws of the company's registered country apply. For users based in the EU/US/India, local statutory protections also apply.</li>
                    <li>Jurisdiction, unless required otherwise, is the company's principal business location.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">11. Terms Updates & Contact</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>We may update these terms; continued use means acceptance.</li>
                    <li>Contact: <a href="mailto:jigilonevyou@gmail.com" className="text-primary hover:underline">jigilonevyou@gmail.com</a></li>
                  </ul>
                </section>
              </div>
            </ScrollArea>
          </div>
        </Card>
      </div>
    </div>
  );
}