// TermsAndConditions.jsx
// Drop into your React router: <Route path="/terms" element={<TermsAndConditions />} />

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

const SMSBox = ({ children }) => (
  <div style={{
    background: "#f0f9ff", border: "1px solid #bae6fd",
    borderLeft: "4px solid #0284c7", borderRadius: "6px",
    padding: "1rem 1.25rem", margin: "1rem 0", fontSize: "0.95rem", color: "#0c4a6e"
  }}>{children}</div>
);

export default function TermsAndConditions() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Georgia, serif", padding: "2rem 1rem" }}>
      <div style={{
        maxWidth: "760px", margin: "0 auto", background: "#fff",
        borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        padding: "3rem 3.5rem"
      }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "0.5rem", fontFamily: "monospace" }}>
            Effective Date: {EFFECTIVE_DATE}
          </p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Terms and Conditions</h1>
          <p style={{ color: "#475569", marginTop: "0.75rem" }}>{COMPANY_NAME} - {APP_NAME}</p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>By accessing or using the {APP_NAME} provided by {COMPANY_NAME}, you agree to be bound by these
          Terms. If you do not agree, do not use the Service.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>The {APP_NAME} is a notification and alert delivery platform that sends real-time alerts via SMS,
          email, and in-app channels based on configured rules and thresholds.</p>
        </Section>

        <Section title="3. SMS Messaging Program">
          <SMSBox>
            <p style={{ margin: 0, fontWeight: 700, marginBottom: "0.5rem" }}>SMS Alerts - Key Disclosures</p>
            <p style={{ margin: 0 }}>
              <strong>Program:</strong> {APP_NAME} Operational Alert Notifications<br />
              <strong>Message Frequency:</strong> Varies based on your configured alert rules<br />
              <strong>Message and Data Rates:</strong> Standard message and data rates may apply<br />
              <strong>Opt-Out:</strong> Reply STOP to any SMS to unsubscribe immediately<br />
              <strong>Help:</strong> Reply HELP or email {SUPPORT_EMAIL}
            </p>
          </SMSBox>
          <p>By providing your mobile number and enabling SMS alerts, you consent to receive text messages
          related to your configured alerts. Consent is not required as a condition of using the Service.</p>
          <p style={{ marginTop: "1rem" }}>Supported carriers are not liable for delayed or undelivered messages.
          We are not responsible for delivery failures due to network or carrier issues beyond our control.</p>
        </Section>

        <Section title="4. User Accounts and Responsibilities">
          <p>You agree to: provide accurate registration information, maintain the security of your credentials,
          notify us immediately of unauthorized access, and use the Service only for lawful purposes. You are
          responsible for all activity under your account.</p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You may not use the Service to violate any law, send alerts to individuals who have not consented,
          transmit spam or harassing content, interfere with Service infrastructure, or reverse-engineer
          the software.</p>
        </Section>

        <Section title="6. Intellectual Property">
          <p>All content and functionality of the {APP_NAME} is the exclusive property of {COMPANY_NAME}.
          You are granted a limited, non-exclusive, non-transferable license to use the Service for its
          intended purposes.</p>
        </Section>

        <Section title="7. Disclaimer of Warranties">
          <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE
          SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.</p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>TO THE FULLEST EXTENT PERMITTED BY LAW, {COMPANY_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR
          INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE,
          INCLUDING MISSED ALERTS OR DATA LOSS.</p>
        </Section>

        <Section title="9. Indemnification">
          <p>You agree to indemnify and hold harmless {COMPANY_NAME} and its officers from claims, liabilities,
          or expenses arising from your use of the Service or violation of these Terms.</p>
        </Section>

        <Section title="10. Termination">
          <p>We may suspend or terminate your access for violation of these Terms. You may terminate your account
          by contacting {SUPPORT_EMAIL}.</p>
        </Section>

        <Section title="11. Governing Law">
          <p>These Terms are governed by the laws of the State of Delaware, United States. Disputes shall be
          resolved through binding arbitration or in courts of competent jurisdiction in Delaware.</p>
        </Section>

        <Section title="12. Changes to Terms">
          <p>We may modify these Terms at any time. Continued use after changes constitutes acceptance. Material
          changes will be communicated via email or in-app notification.</p>
        </Section>

        <Section title="13. Contact Us">
          <p><strong>{COMPANY_NAME}</strong><br />
          Email: {SUPPORT_EMAIL}</p>
        </Section>

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem", color: "#9ca3af", fontSize: "0.82rem", textAlign: "center" }}>
          {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  );
}
