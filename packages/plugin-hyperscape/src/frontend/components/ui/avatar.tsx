import React from "react";

interface AvatarProps {
  children: React.ReactNode;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ children, className = "" }) => (
  <div className={`relative inline-flex h-10 w-10 rounded-full ${className}`}>
    {children}
  </div>
);

export const AvatarImage: React.FC<{
  src?: string;
  alt?: string;
  className?: string;
}> = ({ src, alt = "", className = "" }) => (
  <img
    src={src}
    alt={alt}
    className={`h-full w-full rounded-full object-cover ${className}`}
  />
);

export const AvatarFallback: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div
    className={`flex h-full w-full items-center justify-center rounded-full bg-gray-200 text-gray-600 ${className}`}
  >
    {children}
  </div>
);
