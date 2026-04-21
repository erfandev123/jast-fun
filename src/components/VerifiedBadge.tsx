import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const VerifiedBadge = ({ className = "w-4 h-4" }: { className?: string }) => {
  return (
    <CheckCircle2 
      className={`${className} text-blue-500 fill-blue-500 shrink-0 inline-block align-middle ml-1`} 
      stroke="white" 
      strokeWidth={1.5} 
    />
  );
};
