// PrivacyPolicy.jsx
// Drop into your React router: <Route path="/privacy" element={<PrivacyPolicy />} />

import { useEffect } from "react";

const COMPANY_NAME = "Qfion Technologies";
const APP_NAME = "Alert Management System";
const SUPPORT_EMAIL = "support@qfion.com";
const EFFECTIVE_DATE = "March 3, 2025";

const Section = ({ title, children }) => (
  <section style={{ marginBottom: "2.5rem" }}>
    <h2 style={{
      fontSize: "1.1rem", fontWeight: 700, color: "#0f172a",
      letterSpacing: "0.01em", marginBottom: "0.75rem",
      paddingBottom: "0.5rem", borderBottom: "2px solid #e2e8f0"
    }}>{title}</h2>
    <div style={{ color: "#374151", lineHeight: 1.8, fontSize: "0.97rem" }}>
      {children}
    </div>
  </section>
);

export default function PrivacyPolicy() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Georgia', serif", padding: "2rem 1rem" }}>
      <div style={{
        maxWidth: "760px", margin: "0 auto", background: "#fff",
        borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04)",
        padding: "3rem 3.5rem"
      }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "0.5rem", fontFamily: "monospace" }}>
            Effective Date: {EFFECTIVE_DATE}
          </p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Privacy Policy</h1>
          <p style={{ color: "#475569", marginTop: "0.75rem" }}>{COMPANY_NAME} · {APP_NAME}</p>
        </div>

        <Section title="1. Introduction">
          <p>{COMPANY_NAME} ("we," "us," or "our") operates the {APP_NAME} platform. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information. By using the platform,
          you agree to the practices described herein.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p><strong>Information you provide:</strong></p>
          <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
            <li>Account registration details (name, email address, phone number)</li>
            <li>Notification preferences and alert configurations</li>
            <li>Communications you send to us</li>
          </ul>
          <p style={{ marginTop: "1rem" }}><strong>Information collected automatically:</strong></p>
          <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
            <li>Log data (IP address, browser type, pages visited, timestamps)</li>
            <li>Device information and usage data</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use collected information to:</p>
          <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
            <li>Deliver alert notifications via SMS, email, or in-app channels</li>
            <li>Maintain and improve the platform</li>
            <li>Respond to support requests</li>
            <li>Send service-related communications</li>
            <li>Comply with applicable laws and regulations</li>
          </ul>
          <p style={{ marginTop: "1rem" }}>We do <strong>not</strong> sell your personal information to third parties.</p>
        </Section>

        <Section title="4. SMS / Text Message Communications">
          <p>If you consent to receive SMS messages, we will send alert notifications as configured in your
          account settings. <strong>Message and data rates may apply.</strong> Message frequency varies
          based on your alert configurations.</p>
          <p style={{ marginTop: "1rem" }}>To opt out, reply <strong>STOP</strong> to any message. You will
          receive a one-time confirmation and no further messages. For help, reply <strong>HELP</strong> or
          contact <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#2563eb" }}>{SUPPORT_EMAIL}</a>.</p>
          <p style={{ marginTop: "1rem" }}>We do <strong>not</strong> share your phone number with third
          parties for their own marketing purposes.</p>
        </Section>

        <Section title="5. Data Sharing & Disclosure">
          <p>We share information only with: service providers operating under confidentiality agreements,
          legal authorities when required by law, and successors in a business transfer. We never sell
          your data.</p>
        </Section>

        <Section title="6. Data Security">
          <p>We use industry-standard measures including TLS encryption and access controls. No method of
          Internet transmission is 100% secure. Keep your login credentials confidential.</p>
        </Section>

        <Section title="7. Data Retention">
          <p>We retain data while your account is active. To request deletion, contact{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#2563eb" }}>{SUPPORT_EMAIL}</a>.
          Certain data may be retained as required by law.</p>
        </Section>

        <Section title="8. Your Rights">
          <p>You may request access, correction, or deletion of your data, and withdraw SMS consent at
          any time by replying STOP or updating your account settings. Contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#2563eb" }}>{SUPPORT_EMAIL}</a>.</p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>The {APP_NAME} is not directed to children under 13. We do not knowingly collect data
          from children. Contact us immediately if you believe this has occurred.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We may update this policy and will notify you of material changes. Continued use after
          changes constitutes acceptance of the revised policy.</p>
        </Section>

        <Section title="11. Contact Us">
          <p><strong>{COMPANY_NAME}</strong><br />
          Email: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#2563eb" }}>{SUPPORT_EMAIL}</a></p>
        </Section>

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem", color: "#9ca3af", fontSize: "0.82rem", textAlign: "center" }}>
          © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  );
}
