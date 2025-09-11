// مكون معاينة المستند
import React, { useCallback, useMemo, memo } from 'react';
import { Download, ExternalLink, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Document as DocumentType } from '@/types';
import { FileTypeIcon } from '@/components/common/file-type-icon';
import { getFileTypeLabel, isImageFile, isPdfFile } from '@/utils/file-utils';

interface DocumentPreviewDialogProps {
  document: DocumentType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Image preview component for better organization
const ImagePreview = memo(({ 
  document, 
  onOpenExternal 
}: { 
  document: DocumentType;
  onOpenExternal: () => void;
}) => (
  <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-6">
    <img 
      src={document.fileUrl} 
      alt={document.name}
      className="max-w-full max-h-[50vh] xs:max-h-[55vh] sm:max-h-[60vh] object-contain rounded-lg shadow-md dark:drop-shadow-xl border border-primary/10"
    />
    <Button 
      variant="ghost" 
      size="icon" 
      className="absolute top-3 right-3 h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 bg-white/90 dark:bg-gray-900/80 hover:bg-white dark:hover:bg-gray-900 backdrop-blur-sm rounded-full shadow-md border border-primary/10"
      onClick={onOpenExternal}
    >
      <Maximize2 className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5 text-primary" />
    </Button>
  </div>
));

ImagePreview.displayName = 'ImagePreview';

// PDF preview component
const PdfPreview = memo(({ document }: { document: DocumentType }) => (
  <div className="w-full h-full p-2 sm:p-4">
    <iframe 
      src={`${document.fileUrl}#toolbar=0`} 
      className="w-full h-full min-h-[250px] xs:min-h-[300px] sm:min-h-[400px] border-none rounded-lg shadow-md border border-primary/10 dark:opacity-90" 
      title={document.name}
    />
  </div>
));

PdfPreview.displayName = 'PdfPreview';

// Fallback preview component for unsupported file types
const FallbackPreview = memo(({ document }: { document: DocumentType }) => (
  <div className="flex flex-col items-center justify-center p-6 xs:p-8 sm:p-10 text-center">
    <div className="h-16 w-16 xs:h-20 xs:w-20 sm:h-24 sm:w-24 bg-gradient-to-br from-primary/30 to-primary/10 dark:from-primary/20 dark:to-primary/5 rounded-xl flex items-center justify-center shadow-md mb-4 xs:mb-6">
      <FileTypeIcon fileType={document.fileType} className="h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 text-primary dark:text-primary/90" />
    </div>
    <p className="text-base xs:text-lg text-foreground font-medium mb-2 xs:mb-3">لا يمكن معاينة هذا النوع من الملفات</p>
    <p className="text-sm xs:text-base text-muted-foreground dark:text-muted-foreground/80 max-w-xs">
      يمكنك تنزيل الملف لعرضه على جهازك من خلال زر التنزيل بالأسفل
    </p>
  </div>
));

FallbackPreview.displayName = 'FallbackPreview';

export const DocumentPreviewDialog = memo(({
  document,
  open,
  onOpenChange
}: DocumentPreviewDialogProps) => {
  if (!document) return null;
  
  // Memoize computed values to prevent unnecessary re-renders
  const fileTypeInfo = useMemo(() => ({
    isImage: isImageFile(document.fileType),
    isPdf: isPdfFile(document.fileType),
    description: getFileTypeLabel(document.fileType),
  }), [document.fileType]);
  
  // Handle file download by creating a temporary anchor element
  const handleDownload = useCallback(() => {
    // استخدام endpoint التحميل المخصص دائماً لضمان العمل الصحيح
    const downloadUrl = `/api/download/${document.id}`;
    
    const a = window.document.createElement('a');
    a.href = downloadUrl;
    a.download = document.name || 'document';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  }, [document.name, document.id]);
  
  // Open file in a new browser tab/window
  const handleOpenExternal = useCallback(() => {
    window.open(document.fileUrl, '_blank', 'noopener,noreferrer');
  }, [document.fileUrl]);
  
  // Render appropriate preview based on file type
  const renderPreview = () => {
    if (fileTypeInfo.isImage) {
      return <ImagePreview document={document} onOpenExternal={handleOpenExternal} />;
    } else if (fileTypeInfo.isPdf) {
      return <PdfPreview document={document} />;
    } else {
      return <FallbackPreview document={document} />;
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="preview" className="app-window w-[95vw] xs:w-[90vw] sm:w-auto max-h-[90dvh] overflow-hidden flex flex-col p-4 xs:p-5 sm:p-6">
        <DialogHeader className="mb-3 xs:mb-4 sm:mb-5 space-y-2">
          <DialogTitle className="flex items-center gap-3 text-base xs:text-lg sm:text-xl">
            <div className="h-8 w-8 xs:h-10 xs:w-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <FileTypeIcon fileType={document.fileType} className="h-4 w-4 xs:h-5 xs:w-5 text-white" />
            </div>
            <span className="truncate font-bold">{document.name}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2 text-xs xs:text-sm mt-2 pb-1 border-b border-primary/10">
            <span className="bg-primary/10 py-1 px-3 rounded-full text-primary font-medium">{fileTypeInfo.description}</span>
            <span className="text-xs xs:text-sm opacity-80 bg-gray-100 dark:bg-gray-800/60 rounded-full px-3 py-1 flex items-center" dir="ltr">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 ml-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(document.uploadDate).toLocaleDateString('ar-EG')}
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent rounded-xl my-1 xs:my-2 min-h-[250px] xs:min-h-[300px] sm:min-h-[400px] flex items-center justify-center relative border border-primary/10 shadow-inner">
          {renderPreview()}
        </div>
        
        <DialogFooter className="sm:justify-between gap-3 xs:gap-4 flex-wrap pt-3 xs:pt-4 mt-2 xs:mt-3 border-t border-primary/10">
          <div className="flex items-center w-full xs:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenExternal} 
              className="h-10 xs:h-11 text-xs xs:text-sm w-full xs:w-auto"
            >
              <ExternalLink className="h-4 w-4 ml-2" />
              <span>فتح في تبويب جديد</span>
            </Button>
          </div>
          <Button 
            onClick={handleDownload}
            size="sm"
            className="h-10 xs:h-11 text-xs xs:text-sm w-full xs:w-auto mt-2 xs:mt-0"
          >
            <Download className="h-4 w-4 ml-2" />
            <span>تنزيل الملف</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});