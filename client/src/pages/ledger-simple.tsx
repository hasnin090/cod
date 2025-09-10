import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function LedgerSimple() {
  return (
  <div className="page-container space-y-6 mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">دفتر الأستاذ العام</h1>
          <p className="text-muted-foreground">نظام تصنيف المصروفات والمتفرقات</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>دفتر الأستاذ العام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-muted-foreground">
              سيتم عرض العمليات المصنفة هنا حسب نوع المصروف
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              انتقل إلى صفحة التقارير لعرض المعاملات المصنفة
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}