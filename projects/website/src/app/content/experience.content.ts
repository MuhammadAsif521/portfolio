import type { Experience } from '@shared/interfaces/public-api.interface';

/** What the timeline needs from an Experience document (the API adds _id, order, timestamps…). */
export type TimelineEntry = Pick<
  Experience,
  'company' | 'role' | 'location' | 'startDate' | 'endDate' | 'current' | 'summary' | 'highlights' | 'techStack'
>;

/**
 * "Experience" (brief, Part 6). The live list comes from cusadmin via GET /public/experience; these
 * entries are shown only while that is empty or unreachable, so the section is never blank.
 */
export const EXPERIENCE_CONTENT = {
  eyebrow: 'My',
  title: 'Work Experience',
  fallback: [
    {
      company: 'ICTGE',
      location: 'Lahore',
      role: 'MEAN Stack Developer',
      startDate: '2025-10-01',
      current: true,
      summary:
        'Delivered the City of New Britain ecosystem, three e-commerce redesigns and three internal platform products.',
      highlights: [],
      techStack: [],
    },
    {
      company: 'Learn2Earn Tech',
      location: 'Pakpattan',
      role: 'Ionic Angular Developer',
      summary : 'Learn Coding and then did my internship and works with team to deliver clients projects.',
      startDate: '2024-03-01',
      endDate: '2025-09-30',
      current: false,
      highlights: [],
      techStack: [],
    },
    {
      company: 'Pakistan Air Force',
      role: 'Aviation Technician',
      startDate: '2020-06-01',
      endDate: '2022-08-31',
      current: false,
      summary: 'Maintenance and troubleshooting under strict regulatory compliance: precision and discipline.',
      highlights: [],
      techStack: [],
    },
  ] satisfies TimelineEntry[],
} as const;
