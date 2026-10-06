export const inquiryTypes = ['Workshop', 'Klass', 'Program', 'School Partnership', 'Event', 'Other'] as const;
export const inquiryStatuses = ['New', 'Contacted', 'Resolved'] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];
export type InquiryDetails = { klass?: string; mode?: string; program?: string; schoolLevel?: string; request?: string };
export type InquiryInput = {
  name: string; email: string; phone: string; place: string;
  type: (typeof inquiryTypes)[number]; affiliation: string; institution: string;
  message: string; language: string; details: InquiryDetails;
};
export type InquiryRecord = InquiryInput & { id: string; status: InquiryStatus; date: string; updatedAt: string };

export function validateInquiry(form: FormData) {
  const fields: string[] = [];
  function text(name: string, limit: number, required = true) {
    const raw = form.get(name);
    const value = typeof raw === 'string' ? raw.trim() : '';
    if ((required && !value) || value.length > limit || (raw !== null && typeof raw !== 'string')) fields.push(name);
    return value;
  }
  const name = text('name', 120);
  const email = text('email', 254).toLowerCase();
  const phone = text('phone', 30);
  const place = text('place', 120);
  const type = text('type', 40) as InquiryInput['type'];
  const affiliation = text('affiliation', 40);
  const institution = affiliation === 'Institution' ? text('institution', 180) : '';
  const message = text('message', 5000);
  const language = text('language', 2);
  const details: InquiryDetails = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.push('email');
  if (!/^\+?[\d ()-]+$/.test(phone) || !/^\d{8,15}$/.test(phone.replace(/\D/g, ''))) fields.push('phone');
  if (!inquiryTypes.includes(type)) fields.push('type');
  if (!['Institution', 'Parent', 'Non-institution'].includes(affiliation)) fields.push('affiliation');
  if (!['en', 'id', 'zh'].includes(language)) fields.push('language');
  if (form.get('consent') !== 'yes') fields.push('consent');
  if (type === 'Klass') {
    details.klass = text('klass', 180);
    details.mode = text('mode', 10);
    if (!['Online', 'Onsite'].includes(details.mode)) fields.push('mode');
  } else if (type === 'Program') details.program = text('program', 180);
  else if (type === 'School Partnership') details.schoolLevel = text('school-level', 180);
  else if (['Workshop', 'Event', 'Other'].includes(type)) details.request = text('request', 1000);
  return { fields: [...new Set(fields)], data: { name, email, phone, place, type, affiliation, institution, message, language, details } satisfies InquiryInput };
}

export function inquiryDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}
