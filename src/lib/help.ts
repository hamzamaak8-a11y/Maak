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

/**
 * FAQ copy lives in the i18n layer (v2.faq.<id>.q / v2.faq.<id>.a). This
 * helper only returns the stable ids so callers never embed raw strings.
 */
export function getFaqIds(): string[] {
  return ["booking", "status", "cancel", "provider", "account", "payment"];
}

export async function sendSupportMessage(data: SupportMessage): Promise<void> {
  const name = data.name.trim();
  const email = data.email.trim();
  const subject = data.subject.trim();
  const message = data.message.trim();

  if (!name || !email || !subject || !message) {
    throw new Error("v2.supportErrFields");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("v2.supportErrEmail");
  }
  const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim();
  if (!supportEmail) {
    throw new Error("v2.supportErrConfig");
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
