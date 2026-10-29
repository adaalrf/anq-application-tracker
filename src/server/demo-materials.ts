// Reserved example contact and explicitly fictional text, shared by demo fixtures.
export function demoMaterials(company: string, role: string, nextAction: string) {
  return {
    coverLetter: `Fictional demonstration letter — not submitted to an employer.\n\nDear ${company} team,\n\nI am interested in the ${role} position. I enjoy building accessible interfaces, working with application data, and explaining the decisions behind a project. I would welcome the opportunity to discuss the role and your team's approach to collaboration.\n\nThank you for considering this sample application.\n\nDemo applicant`,
    applicationAddress: 'recruiting@example.test (fictional demo contact)',
    nextAction,
  };
}
