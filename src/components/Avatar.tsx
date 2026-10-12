import { Lock } from 'lucide-react';
import { cn } from '../utils/cn';

interface AvatarProps {
  name: string;
  color: string;
  locked?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, color, locked = false, size = 'md' }: AvatarProps) {
  const sizeClasses = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-14 w-14 text-base'
  }[size];

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-md',
        sizeClasses,
        locked ? 'bg-slate-500/40' : `bg-gradient-to-br ${color}`
      )}
    >
      {locked ? <Lock className="h-4 w-4 text-slate-300" /> : getInitials(name)}
    </div>
  );
}
