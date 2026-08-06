import { pseudoAddress } from "../lib/hash";
import type { Person } from "./types";

function person(name: string, headline: string, verifiedAt: string): Person {
  return {
    id: pseudoAddress(name),
    name,
    headline,
    issuer: "Jobited",
    verified: true,
    verifiedAt,
  };
}

export const people: Person[] = [
  person("Mara Lindqvist", "Senior Technical Recruiter", "2026-02-12"),
  person("Jonas Vogt", "Former Engineering Lead", "2026-02-13"),
  person("Elena Marchetti", "Robotics Engineer", "2026-02-14"),
  person("Tom Bergström", "Product Manager", "2026-02-15"),
  person("Priya Chandran", "Independent Data Consultant", "2026-02-16"),
  person("David Okafor", "Backend Engineer", "2026-02-17"),
  person("Sophie Laurent", "Former Operations Manager", "2026-02-19"),
  person("Amir Haddad", "Strategic Advisor", "2026-02-20"),
  person("Nina Kowalski", "Recruitment Consultant", "2026-02-21"),
  person("Lucas Fontaine", "Legal Counsel", "2026-02-22"),
  person("Greta Almqvist", "Fleet Operations Lead", "2026-02-23"),
  person("Robert Kim", "External Sales Agent", "2026-02-25"),
  person("Ingrid Solberg", "Senior Data Scientist", "2026-02-26"),
  person("Marco Bianchi", "Former Automation Contractor", "2026-02-27"),
  person("Fatima Zahra", "Associate Solicitor", "2026-02-28"),
  person("Oliver Bennett", "Communications Consultant", "2026-03-01"),
  person("Yusuf Demir", "Talent Acquisition Partner", "2026-03-02"),
  person("Clara Dubois", "Frontend Engineer", "2026-03-04"),
  person("Henrik Johansson", "Logistics Advisor", "2026-03-05"),
  person("Isabel Reyes", "Former Analytics Lead", "2026-03-06"),
];

export function getPerson(id: string): Person | undefined {
  return people.find((p) => p.id === id);
}
