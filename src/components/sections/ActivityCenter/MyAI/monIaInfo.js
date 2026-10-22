// The text of Mon IA's "i" panel (it sits right after the big "MON IA" title).
// `action` is added by MonIAModal so the button can open the full Privacy Policy & Terms.
export const MON_IA_INFO = {
  title: "About Mon IA",
  intro: "Mon IA is my AI assistant. It answers questions about me, my portfolio and my work, so you can find what you are looking for without hunting through the site.",
  sections: [
    {
      heading: "What it is",
      paragraphs: [
        "Mon IA is an automated assistant, not me. It only knows the information about me that I have approved for it, and it is powered by AI services from Groq and Google.",
        "It can make mistakes, so please check anything important with me directly.",
      ],
    },
    {
      heading: "How to use it",
      list: [
        "Tap one of the suggested questions, or type your own and press Submit.",
        "Keep each message under 500 characters. It remembers the last few messages, so you can ask follow-up questions.",
        "Press New conversation to start fresh.",
        "Please do not share sensitive personal information.",
      ],
    },
    {
      heading: "Good to know",
      list: [
        "Conversations are recorded and emailed to me, to improve the answers and catch mistakes.",
        "Mon IA is meant for people aged 18 and over.",
        "It does not use cookies and does not save your chat in your browser.",
      ],
    },
  ],
  actionLabel: "Read the full Privacy Policy & Terms",
};