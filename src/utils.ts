export const safeFile = (blob: Blob, name: string): File => {
  try {
    return new File([blob], name, { type: blob.type });
  } catch (e) {
    const b = blob as any;
    b.name = name;
    b.lastModified = Date.now();
    return b as File;
  }
};

export const formatTime = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(typeof timestamp === 'string' || typeof timestamp === 'number' ? timestamp : Date.now()));
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString();
  } catch (e) {
    return 'Just now';
  }
};

export const formatCount = (count: number) => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
};
