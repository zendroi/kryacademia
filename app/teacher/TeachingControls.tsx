'use client';

import Image from 'next/image';
import { ArrowUpRight, FileText } from 'lucide-react';
import BasicDropdown from '@/components/smoothui/basic-dropdown';
import type { TeachingFile } from './teacherData';

export function TeacherSelect({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="admin-select teacher-select"><span>{label}</span><BasicDropdown key={value} label={`${label}: ${options.find((option) => option.id === value)?.label || value}`} items={options} onChange={(item) => onChange(String(item.id))} /></div>;
}

export function TeachingAttachments({ files }: { files: TeachingFile[] }) {
  return <div className="teacher-attachments">{files.map((file) => <a key={file.id} href={`/api/teaching-files/${file.id}`} target="_blank" rel="noopener noreferrer" className={file.mime.startsWith('image/') ? 'teacher-photo-link' : 'teacher-file-link'}>
    {file.mime.startsWith('image/') ? <Image src={`/api/teaching-files/${file.id}`} alt={file.name} width={280} height={200} unoptimized /> : <><FileText size={18} />{file.name}<ArrowUpRight size={15} /></>}
  </a>)}</div>;
}
