'use client';

import { useEffect, useState } from 'react';

interface ClientDateProps {
  unixSeconds: number;
}

// Renders a timestamp in the user's local timezone, client-side only.
// On server-render, shows a neutral placeholder to avoid hydration mismatch.
export function ClientDate({ unixSeconds }: ClientDateProps) {
  const [formatted, setFormatted] = useState<string>('...');

  useEffect(() => {
    setFormatted(new Date(unixSeconds * 1000).toLocaleString());
  }, [unixSeconds]);

  return <span suppressHydrationWarning>{formatted}</span>;
}
