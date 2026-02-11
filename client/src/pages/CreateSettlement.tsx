import SettlementForm, { SettlementFormData } from "@/components/SettlementForm";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateSettlement() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const createMutation = trpc.settlement.create.useMutation({
    onSuccess: () => {
      toast.success("记录创建成功");
      utils.settlement.list.invalidate();
      setLocation("/");
    },
    onError: (err) => {
      toast.error("创建失败: " + err.message);
    },
  });

  const handleSubmit = (data: SettlementFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header with blueprint styling */}
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
          <PlusCircle className="h-5 w-5 text-primary" />
          <h1 className="font-heading font-bold text-lg tracking-widest uppercase text-foreground">
            新增结算记录
          </h1>
          <div className="h-px flex-1 bg-primary/30" />
        </div>
        <p className="text-sm text-muted-foreground ml-14 tracking-wide">
          填写以下信息以创建新的结算明细记录
        </p>
      </div>

      {/* Form card */}
      <div className="blueprint-card rounded-sm p-6 blueprint-corner">
        <SettlementForm
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending}
          submitLabel="创建记录"
        />
      </div>

      {/* Bottom decoration */}
      <div className="flex items-center gap-2 mt-4 text-muted-foreground/30 text-[10px] font-heading tracking-widest justify-center">
        <div className="h-px w-12 bg-border/50" />
        <span>NEW · RECORD · ENTRY</span>
        <div className="h-px w-12 bg-border/50" />
      </div>
    </div>
  );
}
