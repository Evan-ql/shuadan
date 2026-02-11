import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";

export interface SettlementFormData {
  orderDate: number | null;
  orderNo: string;
  groupName: string;
  customerService: string;
  originalPrice: string;
  totalPrice: string;
  actualTransfer: string;
  transferStatus: string;
  registrationStatus: string;
  settlementStatus: string;
  remark: string;
}

const TRANSFER_STATUS_OPTIONS = ["未转", "已转", "部分转"];
const REGISTRATION_STATUS_OPTIONS = ["未登记", "已登记"];
const SETTLEMENT_STATUS_OPTIONS = ["未结算", "已结算", "部分结算"];

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Row 1: Date + Order No + Group Name + Customer Service */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            接单日期
          </Label>
          <Input
            type="datetime-local"
            value={formatDateForInput(form.orderDate)}
            onChange={(e) => {
              const val = e.target.value;
              updateField("orderDate", val ? new Date(val).getTime() : null);
            }}
            className="bg-input/50 border-border font-mono text-sm"
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

      {/* Row 2: Prices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            加价后总价
          </Label>
          <Input
            type="number"
            step="0.01"
            value={form.totalPrice}
            onChange={(e) => updateField("totalPrice", e.target.value)}
            className="bg-input/50 border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            实际转出
          </Label>
          <Input
            type="number"
            step="0.01"
            value={form.actualTransfer}
            onChange={(e) => updateField("actualTransfer", e.target.value)}
            className="bg-input/50 border-border font-mono text-sm"
          />
        </div>
      </div>

      {/* Row 3: Statuses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            转账状态
          </Label>
          <Select
            value={form.transferStatus || "placeholder"}
            onValueChange={(v) => updateField("transferStatus", v === "placeholder" ? "" : v)}
          >
            <SelectTrigger className="bg-input/50 border-border text-sm">
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder" className="text-muted-foreground">
                选择状态
              </SelectItem>
              {TRANSFER_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            登记状态
          </Label>
          <Select
            value={form.registrationStatus || "placeholder"}
            onValueChange={(v) => updateField("registrationStatus", v === "placeholder" ? "" : v)}
          >
            <SelectTrigger className="bg-input/50 border-border text-sm">
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder" className="text-muted-foreground">
                选择状态
              </SelectItem>
              {REGISTRATION_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            结算状态
          </Label>
          <Select
            value={form.settlementStatus || "placeholder"}
            onValueChange={(v) => updateField("settlementStatus", v === "placeholder" ? "" : v)}
          >
            <SelectTrigger className="bg-input/50 border-border text-sm">
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder" className="text-muted-foreground">
                选择状态
              </SelectItem>
              {SETTLEMENT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 4: Remark */}
      <div className="space-y-2">
        <Label className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
          备注
        </Label>
        <Textarea
          value={form.remark}
          onChange={(e) => updateField("remark", e.target.value)}
          placeholder="输入备注信息（可选）"
          rows={3}
          className="bg-input/50 border-border text-sm resize-none"
        />
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
