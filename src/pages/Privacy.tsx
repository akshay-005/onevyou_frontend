import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
              Privacy Policy
            </h1>
            <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-8 text-foreground/90">
                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">1. What Data We Collect</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li><strong>Personal Data:</strong> Name, email, age, phone, payment info.</li>
                    <li><strong>Usage Data:</strong> Device info, IP, cookies, usage analytics.</li>
                    <li>Call/interactions meta-data for security and moderation (calls are not recorded unless required for investigation).</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">2. Why and How We Use Data</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Service delivery, fraud prevention, security, and user support.</li>
                    <li>Improving features and content.</li>
                    <li>Legal/regulatory obligations (including moderation, tax, or government inquiries).</li>
                    <li>(With consent) Marketing or platform updates.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">3. How We Collect Data</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Registration, payment, and interaction forms.</li>
                    <li>Cookies and tracking technologies for logins and analytics.</li>
                    <li>Third-party processors (e.g., payment gateways, analytics tools).</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">4. Sharing & International Transfers</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Shared only with trusted service providers.</li>
                    <li>No sale or unauthorized sharing of user data.</li>
                    <li>International transfers comply with GDPR and DPDP/other local laws (with Standard Contractual Clauses or adequacy mechanisms for EU).</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">5. Retention & Security</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Personal data is retained only as long as needed for service or legal purposes.</li>
                    <li>Encryption, access controls, and regular security audits protect personal data.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">6. User Rights (Global)</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Right to access, correct, erase, restrict, or object to processing.</li>
                    <li>Right to data portability (EU) and opt-out of sale/sharing (CCPA/CPRA).</li>
                    <li>Right to withdraw consent for non-essential processing.</li>
                    <li>Request via account dashboard or contact <a href="mailto:jigilonevyou@gmail.com" className="text-primary hover:underline">jigilonevyou@gmail.com</a>.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">7. Children's Privacy</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Users under 13 (or the relevant minimum for their country) must not use the service.</li>
                    <li>Any suspected child exploitation is reported as per global child protection laws.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">8. Data Breach & Reporting</h2>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Users will be notified in case of any data breach as per applicable law requirements.</li>
                    <li>Users can report privacy or security incidents to our Data Protection Officer (if appointed).</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">9. Policy Updates</h2>
                  <p className="leading-relaxed">
                    We may update this policy. Users will be notified of significant changes.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-primary">10. Contact & Grievance Officer</h2>
                  <p className="leading-relaxed">
                    <strong>JIGIL K</strong> - <a href="mailto:jigilonevyou@gmail.com" className="text-primary hover:underline">jigilonevyou@gmail.com</a>
                  </p>
                </section>
              </div>
            </ScrollArea>
          </div>
        </Card>
      </div>
    </div>
  );
}