import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Star,
  Filter,
  X,
  Check,
  XCircle,
  Upload,
  Eye,
  FileCheck,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "" || val === "0" || val === "0.00") return "0.00";
  return Number(val).toFixed(2);
}

function calcNum(val: string | null | undefined): number {
  if (!val || val === "") return 0;
  return Number(val) || 0;
}

// 公式计算
function calcOriginalPriceIncome(originalPrice: string | null | undefined): number {
  return calcNum(originalPrice) * 0.4;
}

function calcMarkupAmount(totalPrice: string | null | undefined, originalPrice: string | null | undefined): number {
  return calcNum(totalPrice) - calcNum(originalPrice);
}

function calcMarkupIncome(totalPrice: string | null | undefined, originalPrice: string | null | undefined): number {
  return calcMarkupAmount(totalPrice, originalPrice) * 0.4;
}

function calcMarkupActualIncome(totalPrice: string | null | undefined, originalPrice: string | null | undefined, actualTransfer: string | null | undefined): number {
  return calcMarkupIncome(totalPrice, originalPrice) - calcNum(actualTransfer);
}

function calcOrderActualIncome(totalPrice: string | null | undefined, originalPrice: string | null | undefined, actualTransfer: string | null | undefined): number {
  return calcMarkupActualIncome(totalPrice, originalPrice, actualTransfer) + calcOriginalPriceIncome(originalPrice);
}

function StatusBadge({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground/50">-</span>;
  const colorMap: Record<string, string> = {
    已转: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    未转: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    部分转: "text-sky-400 border-sky-400/30 bg-sky-400/10",
    已登记: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    未登记: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    已结算: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    未结算: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    部分结算: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  };
  const cls = colorMap[value] || "text-muted-foreground border-border bg-muted/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-sm ${cls}`}>
      {value}
    </span>
  );
}

function EditableCell({
  value,
  field,
  type = "text",
  isEditing,
  editValues,
  onEditChange,
}: {
  value: string;
  field: string;
  type?: "text" | "number" | "date" | "select";
  isEditing: boolean;
  editValues: Record<string, string>;
  onEditChange: (field: string, val: string) => void;
}) {
  if (!isEditing) return <>{value}</>;

  if (type === "select") {
    const options: Record<string, string[]> = {
      registrationStatus: ["", "已登记", "未登记"],
      settlementStatus: ["", "已结算", "未结算", "部分结算"],
    };
    return (
      <Select
        value={editValues[field] ?? value}
        onValueChange={(v) => onEditChange(field, v === "__empty__" ? "" : v)}
      >
        <SelectTrigger className="h-7 text-xs bg-input/50 border-primary/30 min-w-[80px]">
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">-</SelectItem>
          {(options[field] || []).filter(Boolean).map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      value={editValues[field] ?? value}
      onChange={(e) => onEditChange(field, e.target.value)}
      className="h-7 text-xs bg-input/50 border-primary/30 min-w-[60px]"
      type={type === "number" ? "number" : "text"}
      step={type === "number" ? "0.01" : undefined}
    />
  );
}

// 转账查询弹窗组件
function TransferQueryDialog({
  open,
  onClose,
  settlementId,
}: {
  open: boolean;
  onClose: () => void;
  settlementId: number | null;
}) {
  const { data: records, isLoading } = trpc.transfer.getBySettlement.useQuery(
    { settlementId: settlementId! },
    { enabled: open && settlementId !== null }
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            转账记录查询
          </DialogTitle>
          <DialogDescription>查看该订单关联的转账记录和截图凭证</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
          </div>
        ) : !records || records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无转账记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record: any, idx: number) => (
              <div key={record.id} className="border border-primary/20 rounded-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading tracking-wider text-primary">
                    转账记录 #{idx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {record.createdAt ? new Date(record.createdAt).toLocaleString("zh-CN") : "-"}
                  </span>
                </div>
                {record.imageData && (
                  <div className="border border-primary/10 rounded-sm overflow-hidden">
                    <img
                      src={record.imageData}
                      alt="转账截图"
                      className="w-full max-h-[300px] object-contain bg-black/20 cursor-pointer"
                      onClick={() => window.open(record.imageData, "_blank")}
                    />
                  </div>
                )}
                {record.note && (
                  <p className="text-sm text-muted-foreground bg-muted/20 p-2 rounded-sm">
                    备注：{record.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SpecialList() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [transferFilter, setTransferFilter] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("");
  const [settlementFilter, setSettlementFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // 转账登记弹窗状态
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedTransferIds, setSelectedTransferIds] = useState<number[]>([]);
  const [transferImage, setTransferImage] = useState<string>("");
  const [transferNote, setTransferNote] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 转账查询弹窗状态
  const [showTransferQuery, setShowTransferQuery] = useState(false);
  const [querySettlementId, setQuerySettlementId] = useState<number | null>(null);

  const queryInput = useMemo(
    () => ({
      page,
      pageSize: 15,
      search: search || undefined,
      transferStatus: transferFilter || undefined,
      registrationStatus: registrationFilter || undefined,
      settlementStatus: settlementFilter || undefined,
      isSpecial: true,
    }),
    [page, search, transferFilter, registrationFilter, settlementFilter]
  );

  const { data, isLoading } = trpc.settlement.list.useQuery(queryInput);
  const utils = trpc.useUtils();

  // 获取特殊单中未转账的订单
  const { data: untransferredItems } = trpc.transfer.untransferred.useQuery(undefined, {
    enabled: showTransferDialog,
  });
  const specialUntransferred = useMemo(
    () => (untransferredItems || []).filter((item: any) => item.isSpecial),
    [untransferredItems]
  );

  const deleteMutation = trpc.settlement.delete.useMutation({
    onSuccess: () => {
      toast.success("记录已删除");
      utils.settlement.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error("删除失败: " + err.message),
  });

  const updateMutation = trpc.settlement.update.useMutation({
    onSuccess: () => {
      toast.success("修改已保存");
      utils.settlement.list.invalidate();
      setEditingId(null);
      setEditValues({});
    },
    onError: (err) => toast.error("保存失败: " + err.message),
  });

  const transferMutation = trpc.transfer.create.useMutation({
    onSuccess: () => {
      toast.success("转账登记成功！选中的订单已标记为已转账");
      utils.settlement.list.invalidate();
      utils.transfer.untransferred.invalidate();
      setShowTransferDialog(false);
      setSelectedTransferIds([]);
      setTransferImage("");
      setTransferNote("");
    },
    onError: (err) => toast.error("转账登记失败: " + err.message),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setTransferFilter("");
    setRegistrationFilter("");
    setSettlementFilter("");
    setPage(1);
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditValues({
      totalPrice: item.totalPrice || "0",
      shouldTransfer: item.shouldTransfer || "0",
      actualTransfer: item.actualTransfer || "0",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = () => {
    if (editingId === null) return;
    const updateData: Record<string, any> = {};
    updateData.totalPrice = editValues.totalPrice || "0";
    updateData.shouldTransfer = editValues.shouldTransfer || "0";
    updateData.actualTransfer = editValues.actualTransfer || "0";
    updateData.isSpecial = true;
    updateMutation.mutate({ id: editingId, data: updateData });
  };

  const onEditChange = (field: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [field]: val }));
  };

  // 编辑时的计算值
  const getEditCalcValues = () => {
    const op = editValues.originalPrice || "0";
    const tp = editValues.totalPrice || "0";
    const at = editValues.actualTransfer || "0";
    return {
      originalPriceIncome: calcOriginalPriceIncome(op),
      markupAmount: calcMarkupAmount(tp, op),
      markupIncome: calcMarkupIncome(tp, op),
      markupActualIncome: calcMarkupActualIncome(tp, op, at),
      orderActualIncome: calcOrderActualIncome(tp, op, at),
    };
  };

  // 文件上传处理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件（JPG、PNG）");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过 10MB");
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setTransferImage(reader.result as string);
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast.error("文件读取失败");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // 提交转账登记
  const handleTransferSubmit = () => {
    if (selectedTransferIds.length === 0) {
      toast.error("请至少选择一个订单");
      return;
    }
    if (!transferImage) {
      toast.error("请上传转账截图");
      return;
    }
    transferMutation.mutate({
      settlementIds: selectedTransferIds,
      imageData: transferImage,
      note: transferNote,
    });
  };

  const toggleTransferSelect = (id: number) => {
    setSelectedTransferIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllTransfer = () => {
    if (selectedTransferIds.length === specialUntransferred.length && specialUntransferred.length > 0) {
      setSelectedTransferIds([]);
    } else {
      setSelectedTransferIds(specialUntransferred.map((item: any) => item.id));
    }
  };

  const hasActiveFilters = search || transferFilter || registrationFilter || settlementFilter;

  const thClass = "text-[10px] font-heading tracking-widest uppercase text-primary/80 border border-primary/20 px-2 py-2.5 bg-primary/5 whitespace-nowrap";
  const tdClass = "text-sm border border-primary/10 px-2 py-2";

  // 总列数 = 21
  const totalCols = 21;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-px w-6 bg-primary/50" />
          <Star className="h-5 w-5 text-amber-400" />
          <h1 className="font-heading font-bold text-lg tracking-widest uppercase text-foreground">
            特殊单明细
          </h1>
          <div className="h-px w-12 bg-primary/30" />
          {data && (
            <span className="text-xs text-muted-foreground font-heading tracking-wider">
              共 {data.total} 条记录
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => {
            setShowTransferDialog(true);
            setSelectedTransferIds([]);
            setTransferImage("");
            setTransferNote("");
          }}
        >
          <FileCheck className="h-4 w-4 mr-1" />
          转账登记
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="blueprint-card rounded-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜索群名、单号或客户名..."
                className="pl-9 bg-input/50 border-border text-sm"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleSearch} className="text-xs">
              搜索
            </Button>
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs"
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            筛选
          </Button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-primary/10">
            <Select value={transferFilter || "all"} onValueChange={(v) => { setTransferFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-input/50 border-border">
                <SelectValue placeholder="转账状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部转账状态</SelectItem>
                <SelectItem value="已转">已转</SelectItem>
                <SelectItem value="未转">未转</SelectItem>
              </SelectContent>
            </Select>
            <Select value={registrationFilter || "all"} onValueChange={(v) => { setRegistrationFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-input/50 border-border">
                <SelectValue placeholder="登记状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部登记状态</SelectItem>
                <SelectItem value="已登记">已登记</SelectItem>
                <SelectItem value="未登记">未登记</SelectItem>
              </SelectContent>
            </Select>
            <Select value={settlementFilter || "all"} onValueChange={(v) => { setSettlementFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-input/50 border-border">
                <SelectValue placeholder="结算状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部结算状态</SelectItem>
                <SelectItem value="已结算">已结算</SelectItem>
                <SelectItem value="未结算">未结算</SelectItem>
                <SelectItem value="部分结算">部分结算</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" />
                清除筛选
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="blueprint-card rounded-sm overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${thClass} w-[40px]`}>序号</th>
              <th className={thClass}>接单日期</th>
              <th className={thClass}>单号</th>
              <th className={thClass}>群名</th>
              <th className={thClass}>客户名</th>
              <th className={thClass}>客服</th>
              <th className={`${thClass} text-right`}>原价</th>
              <th className={`${thClass} text-right`}>原价应到手</th>
              <th className={`${thClass} text-right`}>加价后总价</th>
              <th className={`${thClass} text-right`}>加价金额</th>
              <th className={`${thClass} text-right`}>加价应到手</th>
              <th className={`${thClass} text-right`}>应转出</th>
              <th className={`${thClass} text-right`}>实际转出</th>
              <th className={`${thClass} text-center`}>转账状态</th>
              <th className={`${thClass} text-center`}>转账查询</th>
              <th className={`${thClass} text-right`}>加价部分实际到手</th>
              <th className={`${thClass} text-right`}>订单实际到手</th>
              <th className={`${thClass} text-center`}>登记状态</th>
              <th className={`${thClass} text-center`}>结算状态</th>
              <th className={thClass}>备注</th>
              <th className={`${thClass} text-center w-[80px]`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: totalCols }).map((_, j) => (
                    <td key={j} className={tdClass}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className={`${tdClass} text-center py-16 text-muted-foreground`}>
                  <div className="flex flex-col items-center gap-3">
                    <Star className="h-10 w-10 text-muted-foreground/30" />
                    <p className="font-heading tracking-wider text-sm">暂无特殊单记录</p>
                    <p className="text-xs text-muted-foreground/60">在结算明细中点击星标按钮可将记录标记为特殊单</p>
                  </div>
                </td>
              </tr>
            ) : (
              data?.items.map((item, index) => {
                const isEditing = editingId === item.id;
                const isTransferred = item.transferStatus === "已转";

                // 计算公式值
                const op = isEditing ? (editValues.originalPrice || "0") : (item.originalPrice || "0");
                const tp = isEditing ? (editValues.totalPrice || "0") : (item.totalPrice || "0");
                const at = isEditing ? (editValues.actualTransfer || "0") : (item.actualTransfer || "0");

                const originalPriceIncome = calcOriginalPriceIncome(op);
                const markupAmount = calcMarkupAmount(tp, op);
                const markupIncome = calcMarkupIncome(tp, op);
                const markupActualIncome = calcMarkupActualIncome(tp, op, at);
                const orderActualIncome = calcOrderActualIncome(tp, op, at);

                return (
                  <tr key={item.id} className={`transition-colors hover:bg-primary/5 ${isEditing ? "bg-primary/10" : ""}`}>
                    {/* 1. 序号 */}
                    <td className={`${tdClass} text-center text-muted-foreground text-xs`}>
                      {(data.page - 1) * data.pageSize + index + 1}
                    </td>
                    {/* 2. 接单日期（同步自结算明细，只读） */}
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {formatDate(item.orderDate)}
                    </td>
                    {/* 3. 单号（同步自结算明细，只读） */}
                    <td className={tdClass}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-mono truncate max-w-[100px] inline-block">{item.orderNo || "-"}</span>
                        </TooltipTrigger>
                        {item.orderNo && <TooltipContent>{item.orderNo}</TooltipContent>}
                      </Tooltip>
                    </td>
                    {/* 4. 群名（同步自结算明细，只读） */}
                    <td className={`${tdClass} font-medium`}>
                      {item.groupName || "-"}
                    </td>
                    {/* 5. 客户名（同步自结算明细，只读） */}
                    <td className={tdClass}>
                      {item.customerName || "-"}
                    </td>
                    {/* 6. 客服（同步自结算明细，只读） */}
                    <td className={tdClass}>
                      {item.customerService || "-"}
                    </td>
                    {/* 7. 原价（同步自结算明细，只读） */}
                    <td className={`${tdClass} font-mono text-right`}>
                      {formatMoney(item.originalPrice)}
                    </td>
                    {/* 8. 原价应到手 = 原价 * 40% (自动计算) */}
                    <td className={`${tdClass} font-mono text-right text-cyan-400`}>
                      {formatMoney(originalPriceIncome)}
                    </td>
                    {/* 9. 加价后总价 */}
                    <td className={`${tdClass} font-mono text-right text-primary`}>
                      {isEditing ? (
                        <EditableCell value={item.totalPrice || "0"} field="totalPrice" type="number" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        formatMoney(item.totalPrice)
                      )}
                    </td>
                    {/* 10. 加价金额 = 加价后总价 - 原价 (自动计算) */}
                    <td className={`${tdClass} font-mono text-right text-cyan-400`}>
                      {formatMoney(markupAmount)}
                    </td>
                    {/* 11. 加价应到手 = 加价金额 * 40% (自动计算) */}
                    <td className={`${tdClass} font-mono text-right text-cyan-400`}>
                      {formatMoney(markupIncome)}
                    </td>
                    {/* 12. 应转出 */}
                    <td className={`${tdClass} font-mono text-right`}>
                      {isEditing ? (
                        <EditableCell value={item.shouldTransfer || "0"} field="shouldTransfer" type="number" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        formatMoney(item.shouldTransfer)
                      )}
                    </td>
                    {/* 13. 实际转出 */}
                    <td className={`${tdClass} font-mono text-right`}>
                      {isEditing ? (
                        <EditableCell value={item.actualTransfer || "0"} field="actualTransfer" type="number" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        formatMoney(item.actualTransfer)
                      )}
                    </td>
                    {/* 14. 转账状态（只读） */}
                    <td className={`${tdClass} text-center`}>
                      <StatusBadge value={item.transferStatus || "未转"} />
                    </td>
                    {/* 15. 转账查询 */}
                    <td className={`${tdClass} text-center`}>
                      {isTransferred ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => {
                                setQuerySettlementId(item.id);
                                setShowTransferQuery(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>查看转账记录</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                    {/* 16. 加价部分实际到手 = 加价应到手 - 实际转出 (自动计算) */}
                    <td className={`${tdClass} font-mono text-right text-emerald-400`}>
                      {formatMoney(markupActualIncome)}
                    </td>
                    {/* 17. 订单实际到手 = 加价部分实际到手 + 原价应到手 (自动计算) */}
                    <td className={`${tdClass} font-mono text-right text-emerald-400 font-bold`}>
                      {formatMoney(orderActualIncome)}
                    </td>
                    {/* 18. 登记状态（同步自结算明细，只读） */}
                    <td className={`${tdClass} text-center`}>
                      <StatusBadge value={item.registrationStatus ?? ""} />
                    </td>
                    {/* 19. 结算状态（同步自结算明细，只读） */}
                    <td className={`${tdClass} text-center`}>
                      <StatusBadge value={item.settlementStatus ?? ""} />
                    </td>
                    {/* 20. 备注（同步自结算明细，只读） */}
                    <td className={`${tdClass} text-sm`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm truncate max-w-[100px] inline-block">{item.remark || "-"}</span>
                        </TooltipTrigger>
                        {item.remark && <TooltipContent>{item.remark}</TooltipContent>}
                      </Tooltip>
                    </td>
                    {/* 21. 操作 */}
                    <td className={`${tdClass} text-center`}>
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" onClick={saveEdit} disabled={updateMutation.isPending}>
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>保存</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={cancelEdit}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>取消</TooltipContent>
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => startEdit(item)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>编辑</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>删除</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-primary/20">
          <span className="text-xs text-muted-foreground font-heading tracking-wider">
            第 {data.page} / {data.totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(data.totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (data.totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= data.totalPages - 2) pageNum = data.totalPages - 4 + i;
              else pageNum = page - 2 + i;
              return (
                <Button key={pageNum} variant={pageNum === page ? "default" : "ghost"} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(pageNum)}>
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bottom decoration */}
      <div className="flex items-center gap-2 text-muted-foreground/30 text-[10px] font-heading tracking-widest justify-center">
        <div className="h-px w-16 bg-border/50" />
        <span>SPECIAL · ORDER · LEDGER</span>
        <div className="h-px w-16 bg-border/50" />
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>此操作将永久删除该记录，无法恢复。确定要继续吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 转账登记弹窗 */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-400" />
              转账登记
            </DialogTitle>
            <DialogDescription>
              选择需要标记为已转账的订单，上传转账截图作为凭证
            </DialogDescription>
          </DialogHeader>

          {/* 选择未转账订单 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">选择未转账订单</h4>
              <Button variant="ghost" size="sm" className="text-xs" onClick={selectAllTransfer}>
                {selectedTransferIds.length === specialUntransferred.length && specialUntransferred.length > 0 ? "取消全选" : "全选"}
              </Button>
            </div>

            {specialUntransferred.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                暂无未转账的特殊单订单
              </div>
            ) : (
              <div className="border border-primary/20 rounded-sm overflow-hidden max-h-[200px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-primary/5">
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th className="px-3 py-2 text-left text-xs font-heading tracking-wider">单号</th>
                      <th className="px-3 py-2 text-left text-xs font-heading tracking-wider">群名</th>
                      <th className="px-3 py-2 text-left text-xs font-heading tracking-wider">客户名</th>
                      <th className="px-3 py-2 text-right text-xs font-heading tracking-wider">原价</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specialUntransferred.map((item: any) => (
                      <tr
                        key={item.id}
                        className={`cursor-pointer transition-colors ${selectedTransferIds.includes(item.id) ? "bg-emerald-500/10" : "hover:bg-primary/5"}`}
                        onClick={() => toggleTransferSelect(item.id)}
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selectedTransferIds.includes(item.id)}
                            onCheckedChange={() => toggleTransferSelect(item.id)}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono">{item.orderNo || "-"}</td>
                        <td className="px-3 py-2">{item.groupName || "-"}</td>
                        <td className="px-3 py-2">{item.customerName || "-"}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatMoney(item.originalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 上传转账截图 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              上传转账截图 <span className="text-destructive">*</span>
            </h4>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            {transferImage ? (
              <div className="relative border border-emerald-500/30 rounded-sm overflow-hidden">
                <img src={transferImage} alt="转账截图" className="w-full max-h-[200px] object-contain bg-black/20" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    setTransferImage("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-primary/30 rounded-sm p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">点击上传转账截图</p>
                <p className="text-xs text-muted-foreground/60 mt-1">支持 JPG、PNG 格式，最大 10MB</p>
              </div>
            )}
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">备注（可选）</h4>
            <Textarea
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="输入转账备注..."
              rows={2}
              className="bg-input/50 border-border text-sm resize-none"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleTransferSubmit}
              disabled={transferMutation.isPending || selectedTransferIds.length === 0 || !transferImage}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {transferMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-1" />
                  确认转账登记
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 转账查询弹窗 */}
      <TransferQueryDialog
        open={showTransferQuery}
        onClose={() => {
          setShowTransferQuery(false);
          setQuerySettlementId(null);
        }}
        settlementId={querySettlementId}
      />
    </div>
  );
}
