import React, { useRef, useState, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Trash2, Upload, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getFileType, getReadableFileSize } from '@/lib/file-utils';

interface FileUploadAreaProps {
  file: File | null;
  setFile: (file: File | null) => void;
  onChange: (file: File | null) => void;
  uploadProgress: number;
  isLoading: boolean;
  isPending: boolean;
  accept: string;
  maxSize: number;
}

// File icon component for better organization and reusability
const FileIcon = memo(({ fileType }: { fileType?: string }) => {
  if (!fileType) {
    return (
      <div className="h-10 w-10 xs:h-12 xs:w-12 text-muted-foreground rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
        <span className="text-xs">?</span>
      </div>
    );
  }

  const getIconContent = () => {
    if (fileType.includes('pdf')) {
      return {
        className: "text-destructive bg-destructive/5 border-destructive/20",
        icon: "📄"
      };
    } else if (fileType.includes('image')) {
      return {
        className: "text-primary bg-primary/5 border-primary/20",
        icon: "🖼️"
      };
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return {
        className: "text-blue-600 bg-blue-50 border-blue-200",
        icon: "📝"
      };
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return {
        className: "text-green-600 bg-green-50 border-green-200",
        icon: "📊"
      };
    } else {
      return {
        className: "text-muted-foreground bg-muted/30 border-border",
        icon: "📁"
      };
    }
  };

  const { className, icon } = getIconContent();
  
  return (
    <div className={`h-10 w-10 xs:h-12 xs:w-12 ${className} rounded-lg border flex items-center justify-center`}>
      <span className="text-xl">{icon}</span>
    </div>
  );
});

FileIcon.displayName = 'FileIcon';

// File type badge component for better organization
const FileTypeBadge = memo(({ fileType }: { fileType?: string }) => {
  if (!fileType) return null;
  
  const type = getFileType(fileType);
  
  const colorMap: Record<string, string> = {
    'pdf': "bg-destructive/10 text-destructive border-destructive/20",
    'image': "bg-primary/10 text-primary border-primary/20",
    'document': "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/30",
    'default': "bg-muted/10 text-muted-foreground border-muted/20"
  };
  
  const color = colorMap[type] || colorMap.default;
  
  return (
    <Badge variant="outline" className={`${color} capitalize text-[10px] xs:text-xs`}>
      {type}
    </Badge>
  );
});

FileTypeBadge.displayName = 'FileTypeBadge';

export const FileUploadArea = memo(({
  file,
  setFile,
  onChange,
  uploadProgress,
  isLoading,
  isPending,
  accept,
  maxSize
}: FileUploadAreaProps) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      onChange(e.target.files[0]);
    }
  }, [onChange, setFile]);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      onChange(e.dataTransfer.files[0]);
    }
  }, [onChange, setFile]);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDelete = useCallback(() => {
    setFile(null);
    onChange(null);
  }, [onChange, setFile]);

  const handleFileInputClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  const isDisabled = isLoading || isPending;
  const containerClasses = `
    border-2 border-dashed rounded-lg p-2 xs:p-3 sm:p-4 md:p-5 text-center transition-colors
    ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/80'} 
    ${isPending ? 'opacity-60' : ''}
  `;

  return (
    <div 
      className={containerClasses}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {file ? (
        <div className="space-y-2 xs:space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center mb-1 xs:mb-2">
            <FileIcon fileType={file.type} />
          </div>
          
          <div className="space-y-0.5 xs:space-y-1">
            <p className="text-xs xs:text-sm font-medium truncate mx-auto max-w-[200px] xs:max-w-[300px]">{file.name}</p>
            <div className="flex items-center justify-center gap-1 xs:gap-2">
              <p className="text-[10px] xs:text-xs text-muted-foreground">
                {getReadableFileSize(file.size)}
              </p>
              <FileTypeBadge fileType={file.type} />
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-1.5 xs:gap-2 mt-2 xs:mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDisabled}
              className="h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs px-2 xs:px-3"
            >
              <Trash2 className="ml-1 h-3 w-3 xs:h-3.5 xs:w-3.5" />
              حذف
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFileInputClick}
              disabled={isDisabled}
              className="h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs px-2 xs:px-3"
            >
              <Upload className="ml-1 h-3 w-3 xs:h-3.5 xs:w-3.5" />
              تغيير
            </Button>
          </div>
          
          {uploadProgress > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] xs:text-xs">
                <span>جاري التحميل...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} max={100} className="h-1.5 xs:h-2" />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 xs:space-y-3 sm:space-y-4">
          <UploadCloud className="mx-auto h-6 w-6 xs:h-8 xs:w-8 sm:h-10 sm:w-10 text-muted-foreground" />
          <div>
            <p className="text-xs xs:text-sm font-medium">اضغط لاختيار ملف أو قم بسحب الملف وإفلاته هنا</p>
            <p className="text-[10px] xs:text-xs text-muted-foreground mt-0.5 xs:mt-1">
              <span className="hidden xs:inline">PDF، صور (JPG, PNG)، مستندات (DOC, DOCX)، نصوص (TXT) - </span>
              <span className="xs:hidden">ملفات PDF، صور، مستندات - </span>
              أقصى حجم {maxSize / 1024 / 1024} ميجابايت
            </p>
          </div>
          
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept={accept}
            disabled={isDisabled}
          />
          
          <Button
            type="button"
            variant="outline"
            className="relative h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs px-2 xs:px-3 max-w-[180px] mx-auto"
            onClick={handleFileInputClick}
            disabled={isDisabled}
          >
            <Upload className="ml-1 h-3 w-3 xs:h-3.5 xs:w-3.5" />
            اختيار ملف
          </Button>
        </div>
      )}
    </div>
  );
});