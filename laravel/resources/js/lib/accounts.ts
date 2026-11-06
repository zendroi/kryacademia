export type TeacherAccount = { id: string; email: string; name: string; status: 'pending' | 'active' | 'suspended' | 'rejected'; revision: number; note: string; createdAt: string; onboardingComplete?: boolean; bankName?: string; bankAccount?: string; accountHolder?: string; identityId?: string };
export type AccountAction = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'revoke';
