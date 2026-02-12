import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export interface SettlementFormData {
  orderDate: number | null;
  orderNo: string;
  groupName: string;
  customerName: string;
  customerService: string;
  originalPrice: string;
  totalPrice: string;
  actualTransfer: string;
  transferStatus: string;
  registrationStatus: string;
  settlementStatus: string;
  remark: string;
}

interface SettlementFormProps {
  initialData?: Partial<SettlementFormData>;
  onSubmit: (data: SettlementFormData) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

function formatDateForInput(timestamp: number | null | undefined): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function SettlementForm({
  initialData,
  onSubmit,
  isLoading,
  submitLabel = "提交",
}: SettlementFormProps) {
  const [form, setForm] = useState<SettlementFormData>({
    orderDate: initialData?.orderDate ?? null,
    orderNo: initialData?.orderNo ?? "",
    groupName: initialData?.groupName ?? "",
    customerName: initialData?.customerName ?? "",
    customerService: initialData?.customerService ?? "",
    originalPrice: initialData?.originalPrice ?? "0",
    totalPrice: initialData?.totalPrice ?? "0",
    actualTransfer: initialData?.actualTransfer ?? "0",
    transferStatus: initialData?.transferStatus ?? "",
    registrationStatus: initialData?.registrationStatus ?? "",
    settlementStatus: initialData?.settlementStatus ?? "",
    remark: initialData?.remark ?? "",
  });

  // 记录哪些必填字段被触碰过（用于显示错误提示）
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // 是否尝试过提交（提交后所有必填字段都显示错误）
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        orderDate: initialData.orderDate ?? null,
        orderNo: initialData.orderNo ?? "",
        groupName: initialData.groupName ?? "",
        customerName: initialData.customerName ?? "",
        customerService: initialData.customerService ?? "",
        originalPrice: initialData.originalPrice ?? "0",
        totalPrice: initialData.totalPrice ?? "0",
        actualTransfer: initialData.actualTransfer ?? "0",
        transferStatus: initialData.transferStatus ?? "",
        registrationStatus: initialData.registrationStatus ?? "",
        settlementStatus: initialData.settlementStatus ?? "",
        remark: initialData.remark ?? "",
      });
    }
  }, [initialData]);

  // 必填项验证
  const errors: Record<string, string> = {};
  if (!form.orderDate) errors.orderDate = "请选择接单日期";
  if (!form.groupName.trim()) errors.groupName = "请输入群名";
  if (!form.originalPrice || form.originalPrice === "0" || form.originalPrice === "0.00") {
    errors.originalPrice = "请输入原价";
  }

  const showError = (field: string) => (submitted || touched[field]) && errors[field];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.values(errors);
      toast.error(errorMessages[0]);
      return;
    }

    onSubmit(form);
  };

  const updateField = <K extends keyof SettlementFormData>(
    key: K,
    value: SettlementFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const requiredMark = <span className="text-destructive ml-0.5">*</span>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Row 1: Date + Order No + Group Name + Customer Name + Customer Service */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            接单日期{requiredMark}
          </Label>
          <Input
            type="datetime-local"
            value={formatDateForInput(form.orderDate)}
            onChange={(e) => {
              const val = e.target.value;
              updateField("orderDate", val ? new Date(val).getTime() : null);
            }}
            onBlur={() => handleBlur("orderDate")}
            className={`bg-input/50 border-border font-mono text-sm ${showError("orderDate") ? "border-destructive" : ""}`}
          />
          {showError("orderDate") && (
            <p className="text-[11px] text-destructive">{errors.orderDate}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            单号
          </Label>
          <Input
            value={form.orderNo}
            onChange={(e) => updateField("orderNo", e.target.value)}
            placeholder="输入单号"
            className="bg-input/50 border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            群名{requiredMark}
          </Label>
          <Input
            value={form.groupName}
            onChange={(e) => updateField("groupName", e.target.value)}
            onBlur={() => handleBlur("groupName")}
            placeholder="输入群名"
            className={`bg-input/50 border-border text-sm ${showError("groupName") ? "border-destructive" : ""}`}
          />
          {showError("groupName") && (
            <p className="text-[11px] text-destructive">{errors.groupName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            客户名
          </Label>
          <Input
            value={form.customerName}
            onChange={(e) => updateField("customerName", e.target.value)}
            placeholder="输入客户名"
            className="bg-input/50 border-border text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            客服
          </Label>
          <Input
            value={form.customerService}
            onChange={(e) => updateField("customerService", e.target.value)}
            placeholder="输入客服名称"
            className="bg-input/50 border-border text-sm"
          />
        </div>
      </div>

      {/* Row 2: Price + Remark */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            原价{requiredMark}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={form.originalPrice}
            onChange={(e) => updateField("originalPrice", e.target.value)}
            onBlur={() => handleBlur("originalPrice")}
            className={`bg-input/50 border-border font-mono text-sm ${showError("originalPrice") ? "border-destructive" : ""}`}
          />
          {showError("originalPrice") && (
            <p className="text-[11px] text-destructive">{errors.originalPrice}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            备注
          </Label>
          <Input
            value={form.remark}
            onChange={(e) => updateField("remark", e.target.value)}
            placeholder="输入备注信息（可选）"
            className="bg-input/50 border-border text-sm"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={isLoading}
          className="font-heading tracking-wider uppercase text-sm px-8"
        >
          {isLoading ? "处理中..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
