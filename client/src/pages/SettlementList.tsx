import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Filter,
  X,
  Check,
  XCircle,
  Star,
  StarOff,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function formatMoney(val: string | null | undefined): string {
  if (!val || val === "0" || val === "0.00") return "0.00";
  return Number(val).toFixed(2);
}

function StatusBadge({ value, onClick }: { value: string; onClick?: () => void }) {
  if (!value) return <span className="text-muted-foreground/50">-</span>;
  const colorMap: Record<string, string> = {
    已登记: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    未登记: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    同步失败: "text-red-400 border-red-400/30 bg-red-400/10 cursor-pointer hover:bg-red-400/20",
    已结算: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    未结算: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    部分结算: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  };
  const cls = colorMap[value] || "text-muted-foreground border-border bg-muted/30";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-sm ${cls}`}
      onClick={onClick}
      title={value === "同步失败" ? "点击查看失败详情" : undefined}
    >
      {value}
    </span>
  );
}

function EditableDateCell({
  editValues,
  onEditChange,
}: {
  editValues: Record<string, string>;
  onEditChange: (field: string, val: string) => void;
}) {
  const dateValue = editValues.orderDate ? new Date(Number(editValues.orderDate)) : undefined;
  return (
    <DatePicker
      value={dateValue}
      onChange={(date) => {
        onEditChange("orderDate", date ? String(date.getTime()) : "");
      }}
      placeholder="选择日期"
      className="h-7 text-xs min-w-[130px]"
    />
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
      registrationStatus: ["", "已登记", "未登记", "同步失败"],
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
      type="text"
    />
  );
}

export default function SettlementList() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("");
  const [settlementFilter, setSettlementFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const queryInput = useMemo(
    () => ({
      page,
      pageSize: 15,
      search: search || undefined,
      registrationStatus: registrationFilter || undefined,
      settlementStatus: settlementFilter || undefined,
    }),
    [page, search, registrationFilter, settlementFilter]
  );

  const { data, isLoading } = trpc.settlement.list.useQuery(queryInput);
  const { data: settlementStats } = trpc.settlement.settlementStats.useQuery();
  const utils = trpc.useUtils();

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

  const toggleSpecialMutation = trpc.settlement.toggleSpecial.useMutation({
    onSuccess: (result) => {
      if (result?.isSpecial) {
        toast.success("已标记为特殊单，数据已同步到特殊单明细");
      } else {
        toast.success("已取消特殊单标记，已从特殊单明细中移除");
      }
      utils.settlement.list.invalidate();
    },
    onError: (err) => toast.error("操作失败: " + err.message),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setRegistrationFilter("");
    setSettlementFilter("");
    setPage(1);
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditValues({
      orderDate: item.orderDate ? String(item.orderDate) : "",
      orderNo: item.orderNo || "",
      groupName: item.groupName || "",
      customerName: item.customerName || "",
      customerService: item.customerService || "",
      originalPrice: item.originalPrice || "0",
      registrationStatus: item.registrationStatus || "",
      settlementStatus: item.settlementStatus || "",
      remark: item.remark || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = () => {
    if (editingId === null) return;
    const updateData: Record<string, any> = {};
    if (editValues.orderDate) {
      updateData.orderDate = Number(editValues.orderDate);
    } else {
      updateData.orderDate = null;
    }
    updateData.orderNo = editValues.orderNo || "";
    updateData.groupName = editValues.groupName || "";
    updateData.customerName = editValues.customerName || "";
    updateData.customerService = editValues.customerService || "";
    updateData.originalPrice = editValues.originalPrice || "0";
    updateData.registrationStatus = editValues.registrationStatus || "";
    updateData.settlementStatus = editValues.settlementStatus || "";
    updateData.remark = editValues.remark || "";
    updateMutation.mutate({ id: editingId, data: updateData });
  };

  const onEditChange = (field: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [field]: val }));
  };

  const hasActiveFilters = search || registrationFilter || settlementFilter;

  const thClass = "text-[10px] font-heading tracking-widest uppercase text-primary/80 border border-primary/20 px-3 py-2.5 bg-primary/5";
  const tdClass = "text-sm border border-primary/10 px-3 py-2";

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-px w-6 bg-primary/50" />
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h1 className="font-heading font-bold text-lg tracking-widest uppercase text-foreground">
            结算明细
          </h1>
          <div className="h-px w-12 bg-primary/30" />
          {data && (
            <span className="text-xs text-muted-foreground font-heading tracking-wider">
              共 {data.total} 条记录
            </span>
          )}
        </div>
        <Button
          onClick={() => setLocation("/create")}
          size="sm"
          className="font-heading tracking-wider uppercase text-xs"
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          新增记录
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="blueprint-card rounded-sm p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-sm bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <p className="text-[10px] font-heading tracking-widest uppercase text-muted-foreground">当月已接订单</p>
            <p className="text-lg font-bold text-sky-400 font-mono">
              {settlementStats ? settlementStats.monthlyOrderCount : "--"} <span className="text-xs text-muted-foreground font-normal">单</span>
            </p>
          </div>
        </div>
        <div className="blueprint-card rounded-sm p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-heading tracking-widest uppercase text-muted-foreground">当月预估收入</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">
              ¥{settlementStats ? settlementStats.monthlyEstimatedIncome.toFixed(2) : "--"}
            </p>
          </div>
        </div>
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
            <Select value={registrationFilter || "all"} onValueChange={(v) => { setRegistrationFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-input/50 border-border">
                <SelectValue placeholder="登记状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部登记状态</SelectItem>
                <SelectItem value="已登记">已登记</SelectItem>
                <SelectItem value="未登记">未登记</SelectItem>
                <SelectItem value="同步失败">同步失败</SelectItem>
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
      <div className="blueprint-card rounded-sm overflow-auto max-h-[calc(100vh-280px)]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[oklch(0.14_0.04_260)]">
            <tr>
              <th className={`${thClass} w-[50px] sticky-col sticky-col-header left-0`}>#</th>
              <th className={`${thClass} sticky-col sticky-col-header left-[50px] min-w-[90px]`}>接单日期</th>
              <th className={`${thClass} sticky-col sticky-col-header left-[140px] min-w-[130px]`}>单号</th>
              <th className={`${thClass} sticky-col sticky-col-header sticky-col-last left-[270px] min-w-[100px]`}>群名</th>
              <th className={thClass}>客户名</th>
              <th className={thClass}>客服</th>
              <th className={`${thClass} text-right`}>原价</th>
              <th className={`${thClass} text-center`}>登记状态</th>
              <th className={`${thClass} text-center`}>结算状态</th>
              <th className={`${thClass} text-center`}>特殊单</th>
              <th className={thClass}>备注</th>
              <th className={`${thClass} text-center w-[100px]`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <td key={j} className={tdClass}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={12} className={`${tdClass} text-center py-16 text-muted-foreground`}>
                  <div className="flex flex-col items-center gap-3">
                    <LayoutGrid className="h-10 w-10 text-muted-foreground/30" />
                    <p className="font-heading tracking-wider text-sm">暂无结算记录</p>
                    <Button variant="outline" size="sm" onClick={() => setLocation("/create")} className="text-xs">
                      <PlusCircle className="h-3.5 w-3.5 mr-1" />
                      新增记录
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              data?.items.map((item, index) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className={`transition-colors hover:bg-primary/5 ${isEditing ? "bg-primary/10" : ""}`}>
                    <td className={`${tdClass} text-center text-muted-foreground text-xs sticky-col left-0`}>
                      {(data.page - 1) * data.pageSize + index + 1}
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap sticky-col left-[50px]`}>
                      {isEditing ? (
                        <EditableDateCell editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        formatDate(item.orderDate)
                      )}
                    </td>
                    <td className={`${tdClass} sticky-col left-[140px]`}>
                      {isEditing ? (
                        <EditableCell value={item.orderNo || ""} field="orderNo" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        <span className="text-sm font-mono whitespace-nowrap select-all">{item.orderNo || "-"}</span>
                      )}
                    </td>
                    <td className={`${tdClass} font-medium sticky-col sticky-col-last left-[270px]`}>
                      {isEditing ? (
                        <EditableCell value={item.groupName || ""} field="groupName" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        item.groupName || "-"
                      )}
                    </td>
                    <td className={tdClass}>
                      {isEditing ? (
                        <EditableCell value={item.customerName || ""} field="customerName" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        item.customerName || "-"
                      )}
                    </td>
                    <td className={tdClass}>
                      {isEditing ? (
                        <EditableCell value={item.customerService || ""} field="customerService" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        item.customerService || "-"
                      )}
                    </td>
                    <td className={`${tdClass} font-mono text-right`}>
                      {isEditing ? (
                        <EditableCell value={item.originalPrice || "0"} field="originalPrice" type="number" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        formatMoney(item.originalPrice)
                      )}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      {isEditing ? (
                        <EditableCell value={item.registrationStatus ?? ""} field="registrationStatus" type="select" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        <StatusBadge
                          value={item.registrationStatus ?? ""}
                          onClick={item.registrationStatus === "同步失败" ? () => setLocation(`/sync?highlight=${item.id}`) : undefined}
                        />
                      )}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      {isEditing ? (
                        <EditableCell value={item.settlementStatus ?? ""} field="settlementStatus" type="select" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        <StatusBadge value={item.settlementStatus ?? ""} />
                      )}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${item.isSpecial ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10" : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"}`}
                            onClick={() => toggleSpecialMutation.mutate({ id: item.id, isSpecial: !item.isSpecial })}
                            disabled={toggleSpecialMutation.isPending}
                          >
                            {item.isSpecial ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{item.isSpecial ? "点击取消特殊单" : "点击标记为特殊单"}</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className={`${tdClass} text-sm`}>
                      {isEditing ? (
                        <EditableCell value={item.remark || ""} field="remark" isEditing={true} editValues={editValues} onEditChange={onEditChange} />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm truncate max-w-[100px] inline-block">{item.remark || "-"}</span>
                          </TooltipTrigger>
                          {item.remark && <TooltipContent>{item.remark}</TooltipContent>}
                        </Tooltip>
                      )}
                    </td>
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
        <span>SETTLEMENT · LEDGER · SYSTEM</span>
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
    </div>
  );
}
