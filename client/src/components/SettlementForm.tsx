import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useState, useEffect } from "react";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const updateField = <K extends keyof SettlementFormData>(
    key: K,
    value: SettlementFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 将 timestamp 转为 Date 对象
  const orderDateValue = form.orderDate ? new Date(form.orderDate) : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Row 1: Date + Order No + Group Name + Customer Name + Customer Service */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            接单日期
          </Label>
          <DatePicker
            value={orderDateValue}
            onChange={(date) => {
              updateField("orderDate", date ? date.getTime() : null);
            }}
            placeholder="选择日期"
          />
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
            群名
          </Label>
          <Input
            value={form.groupName}
            onChange={(e) => updateField("groupName", e.target.value)}
            placeholder="输入群名"
            className="bg-input/50 border-border text-sm"
          />
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
            原价
          </Label>
          <Input
            type="number"
            step="0.01"
            value={form.originalPrice}
            onChange={(e) => updateField("originalPrice", e.target.value)}
            className="bg-input/50 border-border font-mono text-sm"
          />
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
