// The Mon IA Privacy Policy as data (rendered by PrivacyPolicy.jsx) plus its VERSION.
// The server refuses a chat message unless the browser sends this exact version, which is how
// each recorded message carries proof of which policy the visitor was shown.
// If you change the policy text in a way that matters, change PRIVACY_VERSION too.
export const PRIVACY_VERSION = "2026-10-20";

export const PRIVACY_CONFIG = {
  controllerName: "Ogbon Akpoyovwire Ovoko",
  location: "Port Harcourt, Nigeria",
  email: "ogbonakposofficial@gmail.com",
  lastUpdated: "20 October 2026",
  databaseRetentionDays: 30, // the weekly job deletes recorded chats this many days after they were emailed
  emailRetentionMonths: 12, // how long Akpos keeps the emailed copies
};

const c = PRIVACY_CONFIG;

export const POLICY_SECTIONS = [
  {
    id: "who",
    heading: "1. Who is responsible",
    paragraphs: [
      `I am ${c.controllerName} (known as Akpos), based in ${c.location}. I run this portfolio website and its AI assistant, Mon IA, and I am the data controller for the personal data described below.`,
      `You can contact me about anything in this policy at ${c.email}.`,
      "This policy is written with the Nigeria Data Protection Act 2023 (NDPA) and the Nigeria Data Protection Commission's General Application and Implementation Directive 2025 in mind.",
    ],
  },
  {
    id: "collect",
    heading: "2. What Mon IA collects",
    paragraphs: ["When you use Mon IA, I record:"],
    list: [
      "the messages you type and the replies Mon IA gives;",
      "the date and time of each message;",
      "a random conversation number, created when you open Mon IA or press New conversation. It is not saved in your browser and is not linked to your name;",
      "which version of this policy you were shown when you pressed Submit.",
    ],
    after: [
      "I do not ask for, or store with the chat, your name, email address, phone number, IP address or device details. Anything personal that you choose to type into a message, however, is recorded.",
      "Please do not type sensitive personal data (for example health, religion, political opinions, sexual life, or financial details) or other people's private information.",
    ],
  },
  {
    id: "ai",
    heading: "3. How Mon IA's answers are produced (Google Gemini)",
    paragraphs: [
      "Mon IA is an automated assistant. To answer you, your recent messages are sent to Google's Gemini AI service, together with the public information about me that Mon IA is allowed to use.",
      "I use Google's free Gemini service. Under Google's terms for that free service, Google may use the content sent to it, and the answers it generates, to provide, improve and develop its products and machine-learning technologies, and its human reviewers may read, annotate and process it. Do not type anything you would not be comfortable with a reviewer at Google reading.",
      "Mon IA can make mistakes. Please check anything important with me directly.",
    ],
  },
  {
    id: "recording",
    heading: "4. Recording and the weekly email",
    paragraphs: [
      "Every Mon IA conversation is saved in a private database. Once a week, a digest of the conversations from that week is emailed to my inbox.",
      "I do this to see what visitors ask, to find mistakes, to improve Mon IA's answers, and to prevent abuse. I do not sell your data and I do not use it for advertising.",
      "Because chats are not linked to a name or contact details, I cannot reply to you by email unless you choose to include your own contact details in a message.",
    ],
  },
  {
    id: "providers",
    heading: "5. Who else handles your data",
    paragraphs: ["I use these services to run Mon IA. Each processes data only to provide its service:"],
    list: [
      "Vercel (USA): hosts the website and the server functions that run Mon IA, and keeps short-lived technical logs that can include your IP address.",
      "Google (USA): the Gemini AI service described above. Google Fonts also load the website's fonts, which shares your IP address with Google when a page loads.",
      "Supabase: the private database where chats are recorded.",
      "Resend (USA): delivers the weekly digest email to me.",
    ],
  },
  {
    id: "transfers",
    heading: "6. Sending data outside Nigeria",
    paragraphs: [
      "The services above are operated from outside Nigeria, so your data leaves Nigeria when you use Mon IA. The NDPA allows this where the receiving organisation protects the data adequately or with appropriate safeguards, and where you consent.",
      "By pressing Submit you consent to this transfer. If you would rather not, please do not use Mon IA; the rest of the website works without it.",
    ],
  },
  {
    id: "basis",
    heading: "7. Why I am allowed to use your data",
    paragraphs: [
      "My main basis is your consent: you give it by reading this policy and pressing Submit. You can withdraw it at any time by not using Mon IA and by contacting me to ask for your messages to be deleted.",
      "I also rely on my legitimate interest in keeping the service secure, preventing abuse (for example by limiting how many messages one visitor can send in a short time) and improving Mon IA, in ways that do not override your rights.",
    ],
  },
  {
    id: "retention",
    heading: "8. How long I keep it",
    paragraphs: [
      `Recorded chats are deleted from the database about ${c.databaseRetentionDays} days after they have been emailed to me.`,
      `I keep the emailed copies in my inbox for up to ${c.emailRetentionMonths} months, then delete them.`,
      "Google, Vercel, Supabase and Resend keep data for the periods set in their own policies.",
    ],
  },
  {
    id: "cookies",
    heading: "9. Cookies and tracking",
    paragraphs: [
      "Mon IA does not use cookies, and it does not save your chat in your browser's storage. Closing the window ends the conversation on your device.",
      "This website does not use advertising or analytics trackers.",
    ],
  },
  {
    id: "security",
    heading: "10. Keeping your data safe",
    paragraphs: [
      "Chats travel over an encrypted (HTTPS) connection. The database cannot be read from the public internet, and the keys that unlock it are kept on the server and never sent to your browser. No system is completely secure, but I take reasonable steps to protect your data.",
      "If a breach happens that is likely to put your rights at risk, I will notify the Nigeria Data Protection Commission within 72 hours of becoming aware of it, and tell affected people where I can.",
    ],
  },
  {
    id: "rights",
    heading: "11. Your rights",
    paragraphs: ["Under the NDPA you have the right to:"],
    list: [
      "be told how your data is used (this policy);",
      "ask for access to your data;",
      "ask me to correct data that is wrong;",
      "ask me to delete your data;",
      "ask me to restrict the use of your data, or object to it;",
      "ask for your data in a portable form;",
      "withdraw your consent at any time.",
    ],
    after: [
      `To use any of these rights, email ${c.email}. Because chats are not linked to a name, please tell me the approximate date and time and quote part of the message, so that I can find it. I will reply within a reasonable time.`,
    ],
  },
  {
    id: "complaints",
    heading: "12. Complaints",
    paragraphs: [
      `If you are unhappy about how I handle your data, please contact me first at ${c.email} so I can put it right. You also have the right to complain to the Nigeria Data Protection Commission: https://ndpc.gov.ng`,
    ],
  },
  {
    id: "children",
    heading: "13. Children",
    paragraphs: ["Mon IA is not meant for anyone under 18. If you are under 18, please ask a parent or guardian before using it."],
  },
  {
    id: "terms",
    heading: "14. Using Mon IA",
    paragraphs: ["By using Mon IA you also agree to these simple terms:"],
    list: [
      "Mon IA is an automated assistant about me and my work. Its answers can be wrong or incomplete and are not professional, legal or financial advice.",
      "Do not use it to break the law, to harass or harm anyone, or to try to break, overload or trick the service.",
      "I may change, limit or switch off Mon IA at any time, and Mon IA may refuse requests it should not answer.",
      "I provide Mon IA as it is, to the extent the law allows.",
    ],
  },
  {
    id: "changes",
    heading: "15. Changes to this policy",
    paragraphs: [
      `I will update this policy if how Mon IA works changes, and the date at the top will change. This version is dated ${c.lastUpdated}.`,
    ],
  },
];
