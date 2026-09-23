/**
 * CTA (#contact), the full contact form and the footer (brief, Part 6). Site Settings override the
 * email, phone and location when set; these are the brief's real contact details.
 */
export const CONTACT_CONTENT = {
  cta: {
    title: 'Have a project idea?',
    accent: "Let's discuss",
    text: 'Leave your email and I will get back to you within a day, or write me a full message below.',
    emailLabel: 'Your email address',
    placeholder: 'Enter email address',
    button: 'Send',
    sent: "Thanks! I'll email you within a day.",
    /** Figures must stay real and defensible (brief, Part 10: confirm before launch). */
    badges: [
      { icon: 'award', label: 'Top Rated Freelancer' },
      { icon: 'layers', label: 'Full-Stack Angular/Node' },
      { icon: 'calendar-check', label: '2+ Years Experience' },
    ],
    openForm: 'Prefer to write a full message?',
    closeForm: 'Hide the full form',
  },
  form: {
    name: 'Name',
    email: 'Email',
    subject: 'Subject',
    message: 'Message',
    messageMin: 10,
    messageMax: 5000,
    button: 'Send message',
    sent: 'Message sent. Thank you! I usually reply within a day.',
    again: 'Send another message',
  },
  footer: {
    connectTitle: "Let's Connect there",
    connectButton: 'Hire me',
    navTitle: 'Navigation',
    contactTitle: 'Contact',
    quickTitle: 'Get in touch',
    quickText: 'Drop your email and I will reach out.',
    quickLabel: 'Your email address for a reply',
    email: 'm.asif340315@gmail.com',
    location: 'Pakpattan / Lahore, Pakistan',
    builtWith: 'Built with Angular & Node.js',
  },
} as const;
