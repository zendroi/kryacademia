import { workspace } from '@/lib/workspace';
export const refreshNotificationJobs = () => workspace('jobs');
export const retryNotificationJob = (id: string) => workspace('jobs/retry', { id });
