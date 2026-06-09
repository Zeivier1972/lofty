export const metadata = {
  title: "Privacy Policy | Catherine Gomez Realtor",
}

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 2025</p>

      <section className="space-y-6 text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
          <p>
            We collect information you provide directly, such as your name, email address, phone number,
            and real estate preferences when you submit a contact form, request a home search, or interact
            with our AI assistant (Sofía).
          </p>
          <p className="mt-2">
            If you contact us via Facebook Lead Ads, we receive the information you submit through those forms,
            including your name, email, and phone number.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To respond to your real estate inquiries and schedule appointments</li>
            <li>To send you property listings and market updates that match your preferences</li>
            <li>To contact you via SMS, WhatsApp, email, or phone (with your consent)</li>
            <li>To improve our services and personalize your experience</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">3. SMS & WhatsApp Communications</h2>
          <p>
            By providing your phone number, you consent to receive text messages and WhatsApp messages from
            Catherine Gomez Realtor regarding your real estate inquiry. Message and data rates may apply.
            Reply STOP at any time to unsubscribe.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">4. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data with trusted service providers
            (such as our CRM platform) solely to fulfill the services described above.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">5. Data Retention</h2>
          <p>
            We retain your information for as long as necessary to provide services and comply with legal
            obligations. You may request deletion of your data at any time by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">6. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or wish to exercise your data rights, contact us at:
          </p>
          <p className="mt-2 font-medium">
            Catherine Gomez Realtor<br />
            Email: <a href="mailto:info@catherineGomezrealtor.com" className="text-blue-600 underline">info@catherineGomezrealtor.com</a><br />
            Miami, Florida
          </p>
        </div>
      </section>
    </main>
  )
}
