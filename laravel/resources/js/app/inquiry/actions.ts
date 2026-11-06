import { workspace } from '@/lib/workspace';
export const refreshInquiries = () => workspace('inquiries');
export const updateInquiryStatus = (id: string, status: string) => workspace('inquiries/status', { id, status });
