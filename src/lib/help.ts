export type SupportMessage = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export function getFaqData(): FaqItem[] {
  return [
    { id: "booking", question: "How do I make a booking?", answer: "Open a provider profile, choose the service, select an available date, add the requested details, then review and submit the booking request." },
    { id: "status", question: "How can I check my booking status?", answer: "Open Bookings from the main navigation. Each booking shows its current status, service details, provider, date and payment state when available." },
    { id: "cancel", question: "Can I cancel a booking?", answer: "Yes. Open the booking from your Bookings page and use the available cancellation action while the booking is still eligible for cancellation." },
    { id: "provider", question: "How do I contact a provider?", answer: "Open the provider profile and use the contact action to start a conversation when chat is available for that provider." },
    { id: "account", question: "How do I update my account information?", answer: "Open Account from the main navigation, update the editable profile fields, and save your changes." },
    { id: "payment", question: "What happens to payment information?", answer: "Payment and booking financial states are displayed when they are available for the booking. Never share card numbers or passwords in a support message." },
  ];
}

export async function sendSupportMessage(data: SupportMessage): Promise<void> {
  const name = data.name.trim();
  const email = data.email.trim();
  const subject = data.subject.trim();
  const message = data.message.trim();

  if (!name || !email || !subject || !message) {
    throw new Error("Please complete all support fields.");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
  const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim();
  if (!supportEmail) {
    throw new Error("Support email is not configured.");
  }

  const body = [
    `Name: ${name}`,
    `Customer email: ${email}`,
    "",
    message,
  ].join("\n");
  const href = `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(`[Maak Support] ${subject}`)}&body=${encodeURIComponent(body)}`;

  window.location.href = href;
}
