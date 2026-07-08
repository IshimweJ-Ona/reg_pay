import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAvatarUrl(path?: string | null) {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
  return `${baseUrl}${path}`;
}

export function formatDisplayName(name?: string | null): string {
  if (!name) return 'Unassigned';
  return name.replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

