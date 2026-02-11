import SettlementForm, { SettlementFormData } from "@/components/SettlementForm";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditSettlement() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: record, isLoading } = trpc.settlement.getById.useQuery(
    { id },
    { enabled: !isNaN(id) }
  );

  const updateMutation = trpc.settlement.update.useMutation({
    onSuccess: () => {
      toast.success("记录更新成功");
      utils.settlement.list.invalidate();
      utils.settlement.getById.invalidate({ id });
      setLocation("/");
    },
    onError: (err) => {
      toast.error("更新失败: " + err.message);
    },
  });

  const handleSubmit = (data: SettlementFormData) => {
    updateMutation.mutate({ id, data });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-muted-foreground">记录不存在</p>
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mt-4"
        >
          返回列表
        </Button>
      </div>
    );
  }

  const initialData: Partial<SettlementFormData> = {
    orderDate: record.orderDate,
    orderNo: record.orderNo ?? "",
    groupName: record.groupName ?? "",
    originalPrice: record.originalPrice ?? "0",
    totalPrice: record.totalPrice ?? "0",
    actualTransfer: record.actualTransfer ?? "0",
    transferStatus: record.transferStatus ?? "",
    registrationStatus: record.registrationStatus ?? "",
    settlementStatus: record.settlementStatus ?? "",
    remark: record.remark ?? "",
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回列表
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-primary/50" />
          <Pencil className="h-5 w-5 text-primary" />
          <h1 className="font-heading font-bold text-lg tracking-widest uppercase text-foreground">
            编辑结算记录
          </h1>
          <div className="h-px flex-1 bg-primary/30" />
        </div>
        <p className="text-sm text-muted-foreground ml-14 tracking-wide">
          修改记录 #{record.id} 的结算明细信息
        </p>
      </div>

      {/* Form card */}
      <div className="blueprint-card rounded-sm p-6 blueprint-corner">
        <SettlementForm
          initialData={initialData}
          onSubmit={handleSubmit}
          isLoading={updateMutation.isPending}
          submitLabel="保存修改"
        />
      </div>

      {/* Bottom decoration */}
      <div className="flex items-center gap-2 mt-4 text-muted-foreground/30 text-[10px] font-heading tracking-widest justify-center">
        <div className="h-px w-12 bg-border/50" />
        <span>EDIT · RECORD · #{record.id}</span>
        <div className="h-px w-12 bg-border/50" />
      </div>
    </div>
  );
}
