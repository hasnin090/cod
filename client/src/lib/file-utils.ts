// Lightweight file utilities extracted from deprecated firebase-storage module

export const getFileType = (fileType: string): string => {
  return fileType.split('/')[0] || 'unknown';
};

export const getReadableFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} بايت`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${Math.round((sizeInBytes / 1024) * 10) / 10} كيلوبايت`;
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${Math.round((sizeInBytes / (1024 * 1024)) * 10) / 10} ميجابايت`;
  } else {
    return `${Math.round((sizeInBytes / (1024 * 1024 * 1024)) * 10) / 10} جيجابايت`;
  }
};
