/**
 * CTA (#contact), the full contact form and the footer (brief, Part 6). Site Settings override the
 * email, phone and location when set; these are the brief's real contact details.
 */
export const CONTACT_CONTENT = {
  cta: {
    title: 'Have an Awesome Project Idea?',
    accent: "Let's Discuss",
    emailLabel: 'Your email address',
    placeholder: 'Enter Email Address',
    button: 'Send',
    sent: "Thanks! I'll email you within a day.",
    /** Figures must stay real and defensible (brief, Part 10: confirm before launch). */
    badges: [
      { icon: 'star', label: 'Top Rated Freelancer' },
      { icon: 'award', label: 'Full-Stack Angular/Node' },
      { icon: 'shield-check', label: '2+ Years Experience' },
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
    quickPlaceholder: 'Email Address',
    quickLabel: 'Your email address for a reply',
    email: 'm.asif340315@gmail.com',
    location: 'Pakpattan / Lahore, Pakistan',
    builtWith: 'Built with Angular & Node.js',
  },
} as const;
