import { FileText, FileImage, File } from 'lucide-react';
import { getFileType } from "./file-utils";

// دوال مساعدة لتنسيقات أنواع الملفات
export const getFileTypeLabel = (fileType: string): string => {
  const type = getFileType(fileType);
  
  switch (type) {
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'صورة';
    case 'document':
      return 'مستند';
    default:
      return 'ملف آخر';
  }
};

export const getFileTypeIcon = (fileType: string) => {
  const type = getFileType(fileType);
  
  switch (type) {
    case 'pdf':
      return <FileText className="h-3 w-3 ml-1" />;
    case 'image':
      return <FileImage className="h-3 w-3 ml-1" />;
    case 'document':
      return <File className="h-3 w-3 ml-1" />;
    default:
      return <File className="h-3 w-3 ml-1" />;
  }
};

export const getFileTypeBadgeClasses = (fileType: string): string => {
  const type = getFileType(fileType);
  
  switch (type) {
    case 'pdf':
      return 'bg-red-100 text-red-700';
    case 'image':
      return 'bg-blue-100 text-blue-700';
    case 'document':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};