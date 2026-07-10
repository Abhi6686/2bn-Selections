import { apiFetch } from "./client";

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFrom: string;
  hasSmtpPass: boolean;
}

export async function fetchOrgSettings(): Promise<OrgSettings> {
  return apiFetch("/api/settings/org");
}

export async function updateOrgSettings(
  input: Partial<Omit<OrgSettings, "id" | "slug" | "hasSmtpPass">> & { smtpPass?: string }
): Promise<{ success: boolean; org: OrgSettings }> {
  return apiFetch("/api/settings/org", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function testSmtp(input: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass?: string;
  smtpFrom: string;
  testTo: string;
}): Promise<{ success: boolean; message: string }> {
  return apiFetch("/api/settings/test-smtp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
