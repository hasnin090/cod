import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link, Unlink, Receipt, FileText, Eye, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Input } from "@/components/ui/input";

interface UnlinkedDocument {
  id: number;
  name: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  uploadDate: string;
  category: string;
  uploaded_by_name: string;
}

interface LinkableTransaction {
  id: number;
  date: string;
  amount: number;
  type: string;
  description: string;
  project_name?: string;
  created_by_name: string;
  has_linked_documents: boolean;
}

interface LinkedDocument {
  id: number;
  name: string;
  fileUrl: string;
  fileType: string;
  link_type: string;
  link_notes?: string;
  linked_at: string;
  linked_by_name: string;
}

export function DocumentLinker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<UnlinkedDocument | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<string>("");
  const [linkType, setLinkType] = useState<string>("receipt");
  const [linkNotes, setLinkNotes] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");

  // جلب المستندات غير المربوطة
  const { data: unlinkedDocuments = [], isLoading: documentsLoading } = useQuery<UnlinkedDocument[]>({
    queryKey: ["/api/documents/unlinked"],
  });

  // جلب العمليات المالية المتاحة للربط
  const { data: linkableTransactions = [], isLoading: transactionsLoading } = useQuery<LinkableTransaction[]>({
    queryKey: ["/api/transactions/linkable"],
  });

  // ربط مستند بعملية مالية
  const linkMutation = useMutation({
    mutationFn: async ({ documentId, transactionId, linkType, notes }: {
      documentId: number;
      transactionId: number;
      linkType: string;
      notes?: string;
    }) => {
      return apiRequest(`/api/documents/${documentId}/link-transaction`, "POST", {
        transactionId,
        linkType,
        notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "تم الربط بنجاح",
        description: "تم ربط المستند بالعملية المالية بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/unlinked"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/linkable"] });
      setIsLinkDialogOpen(false);
      setSelectedDocument(null);
      setSelectedTransaction("");
      setLinkNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الربط",
        description: error.message || "فشل في ربط المستند",
        variant: "destructive",
      });
    },
  });

  const handleLinkDocument = () => {
    if (!selectedDocument || !selectedTransaction) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار المستند والعملية المالية",
        variant: "destructive",
      });
      return;
    }

    linkMutation.mutate({
      documentId: selectedDocument.id,
      transactionId: parseInt(selectedTransaction),
      linkType,
      notes: linkNotes,
    });
  };

  // تصفية المستندات
  const filteredDocuments = unlinkedDocuments.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || doc.category === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            مكتبة إدارة الملفات والربط اليدوي
          </CardTitle>
          <CardDescription>
            ربط المستندات والإيصالات بالعمليات المالية المناسبة لتجنب إعادة الرفع
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* شريط البحث والتصفية */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="البحث في المستندات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="تصفية حسب النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="receipt">إيصالات</SelectItem>
                  <SelectItem value="invoice">فواتير</SelectItem>
                  <SelectItem value="contract">عقود</SelectItem>
                  <SelectItem value="general">عام</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* قائمة المستندات غير المربوطة */}
            <div>
              <h3 className="text-lg font-semibold mb-3">المستندات المتاحة للربط ({filteredDocuments.length})</h3>
              {documentsLoading ? (
                <div className="text-center py-8">جاري التحميل...</div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد مستندات متاحة للربط
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocuments.map((doc) => (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{doc.name}</h4>
                              {doc.description && (
                                <p className="text-xs text-gray-600 mt-1">{doc.description}</p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {doc.category === 'receipt' ? 'إيصال' :
                               doc.category === 'invoice' ? 'فاتورة' :
                               doc.category === 'contract' ? 'عقد' : 'عام'}
                            </Badge>
                          </div>
                          
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>رفع بواسطة: {doc.uploaded_by_name}</div>
                            <div>
                              التاريخ: {doc.uploadDate ? format(new Date(doc.uploadDate), "dd/MM/yyyy HH:mm", { locale: ar }) : 'غير محدد'}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(doc.fileUrl, '_blank')}
                              className="flex-1"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              عرض
                            </Button>
                            <Dialog open={isLinkDialogOpen && selectedDocument?.id === doc.id} onOpenChange={setIsLinkDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedDocument(doc)}
                                  className="flex-1"
                                >
                                  <Link className="h-3 w-3 mr-1" />
                                  ربط
                                </Button>
                              </DialogTrigger>
                              <DialogContent size="xl">
                                <DialogHeader>
                                  <DialogTitle>ربط المستند بعملية مالية</DialogTitle>
                                  <DialogDescription>
                                    اختر العملية المالية المناسبة لربطها بالمستند: {doc.name}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-sm font-medium">العملية المالية</label>
                                    <Select value={selectedTransaction} onValueChange={setSelectedTransaction}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="اختر العملية المالية" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {linkableTransactions.map((transaction) => (
                                          <SelectItem key={transaction.id} value={transaction.id.toString()}>
                                            <div className="flex items-center justify-between w-full">
                                              <span className="flex-1">
                                                {transaction.description} - {transaction.amount.toLocaleString()} دينار عراقي
                                              </span>
                                              <span className="text-xs text-gray-500 ml-2">
                                                {format(new Date(transaction.date), "dd/MM/yyyy", { locale: ar })}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium">نوع الربط</label>
                                    <Select value={linkType} onValueChange={setLinkType}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="receipt">إيصال استلام</SelectItem>
                                        <SelectItem value="invoice">فاتورة</SelectItem>
                                        <SelectItem value="contract">عقد</SelectItem>
                                        <SelectItem value="supporting">مستند مساند</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium">ملاحظات (اختياري)</label>
                                    <Textarea
                                      value={linkNotes}
                                      onChange={(e) => setLinkNotes(e.target.value)}
                                      placeholder="أضف ملاحظات حول الربط..."
                                      rows={3}
                                    />
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => setIsLinkDialogOpen(false)}
                                    >
                                      إلغاء
                                    </Button>
                                    <Button
                                      onClick={handleLinkDocument}
                                      disabled={linkMutation.isPending}
                                    >
                                      {linkMutation.isPending ? "جاري الربط..." : "تأكيد الربط"}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TransactionLinkedDocuments({ transactionId }: { transactionId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // جلب المستندات المربوطة بالعملية المالية
  const { data: linkedDocuments = [], isLoading } = useQuery<LinkedDocument[]>({
    queryKey: [`/api/transactions/${transactionId}/linked-documents`],
  });

  // إلغاء ربط مستند
  const unlinkMutation = useMutation({
    mutationFn: async ({ documentId }: { documentId: number }) => {
      return apiRequest(`/api/documents/${documentId}/unlink-transaction/${transactionId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "تم إلغاء الربط",
        description: "تم إلغاء ربط المستند بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transactionId}/linked-documents`] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/unlinked"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إلغاء الربط",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">جاري التحميل...</div>;
  }

  if (linkedDocuments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>لا توجد مستندات مربوطة بهذه العملية المالية</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">المستندات المربوطة ({linkedDocuments.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {linkedDocuments.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{doc.name}</h4>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {doc.link_type === 'receipt' ? 'إيصال استلام' :
                       doc.link_type === 'invoice' ? 'فاتورة' :
                       doc.link_type === 'contract' ? 'عقد' : 'مستند مساند'}
                    </Badge>
                  </div>
                </div>
                
                {doc.link_notes && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {doc.link_notes}
                  </p>
                )}
                
                <div className="text-xs text-gray-500 space-y-1">
                  <div>ربط بواسطة: {doc.linked_by_name}</div>
                  <div>
                    تاريخ الربط: {format(new Date(doc.linked_at), "dd/MM/yyyy HH:mm", { locale: ar })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(doc.fileUrl, '_blank')}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    عرض
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => unlinkMutation.mutate({ documentId: doc.id })}
                    disabled={unlinkMutation.isPending}
                    className="flex-1"
                  >
                    <Unlink className="h-3 w-3 mr-1" />
                    إلغاء الربط
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}