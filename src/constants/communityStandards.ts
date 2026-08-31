// Community standards / report reason taxonomy mirroring the web app.

export interface ReportViolation {
  id: string;
  label: string;
  description: string;
}

export interface ReportCategory {
  id: string;
  label: string;
  description: string;
  violations: ReportViolation[];
}

export const COMMUNITY_STANDARDS: ReportCategory[] = [
  {
    id: "harassment",
    label: "Harassment & Bullying",
    description: "Targeted, repeated, or intimidating behavior toward you or someone else.",
    violations: [
      {
        id: "harassment-direct",
        label: "Direct harassment",
        description: "Repeated unwanted messages, insults, or threats directed at you.",
      },
      {
        id: "harassment-bullying",
        label: "Bullying or mocking",
        description: "Demeaning, humiliating, or mocking content targeting a person.",
      },
      {
        id: "harassment-doxxing",
        label: "Sharing private information",
        description: "Posting someone's personal details without consent.",
      },
      {
        id: "harassment-impersonation",
        label: "Impersonation",
        description: "Pretending to be another student, staff member, or organization.",
      },
    ],
  },
  {
    id: "hate-speech",
    label: "Hate Speech & Discrimination",
    description: "Attacks based on identity, background, or protected characteristics.",
    violations: [
      {
        id: "hate-identity",
        label: "Attacks based on identity",
        description: "Content targeting race, religion, gender, sexuality, or disability.",
      },
      {
        id: "hate-slurs",
        label: "Slurs or derogatory language",
        description: "Use of slurs or dehumanizing language toward a group.",
      },
    ],
  },
  {
    id: "inappropriate-content",
    label: "Inappropriate Content",
    description: "Content that violates campus or platform decency standards.",
    violations: [
      {
        id: "content-sexual",
        label: "Sexual content",
        description: "Explicit or sexually suggestive messages, images, or links.",
      },
      {
        id: "content-violence",
        label: "Graphic violence",
        description: "Disturbing, graphic, or violent images or descriptions.",
      },
      {
        id: "content-spam",
        label: "Spam or scams",
        description: "Unsolicited ads, links, or repeated promotional messages.",
      },
    ],
  },
  {
    id: "safety",
    label: "Safety Concerns",
    description: "Situations that may put someone at real-world risk.",
    violations: [
      {
        id: "safety-self-harm",
        label: "Self-harm or suicide risk",
        description: "Messages indicating someone may be at risk of harming themselves.",
      },
      {
        id: "safety-threats",
        label: "Threats of violence",
        description: "Explicit or implied threats of physical harm toward someone.",
      },
      {
        id: "safety-minor",
        label: "Concern involving a minor",
        description: "Content or behavior that may endanger someone underage.",
      },
    ],
  },
  {
    id: "academic-integrity",
    label: "Academic Integrity",
    description: "Misuse of the platform related to coursework or exams.",
    violations: [
      {
        id: "academic-cheating",
        label: "Sharing exam answers or cheating",
        description: "Coordinating cheating or distributing exam content.",
      },
      {
        id: "academic-plagiarism",
        label: "Selling or distributing coursework",
        description: "Selling assignments, theses, or other academic work.",
      },
    ],
  },
  {
    id: "other",
    label: "Something Else",
    description: "Doesn't fit the categories above but still feels wrong.",
    violations: [
      {
        id: "other-unspecified",
        label: "Other issue",
        description: "A concern that doesn't match the listed categories.",
      },
    ],
  },
];
