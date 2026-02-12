import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatMoney(val: string | null | undefined): string {
  if (!val || val === "0" || val === "0.00") return "0.00";
  return Number(val).toFixed(2);
}

function StatusBadge({
  value,
}: {
  value: string;
}) {
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
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-sm ${cls}`}
    >
      {value}
    </span>
  );
}

// Inline editable cell component
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
      transferStatus: ["", "已转", "未转", "部分转"],
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
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
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
      type={type === "number" ? "text" : "text"}
    />
  );
}

export default function Home() {
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

  const queryInput = useMemo(
    () => ({
      page,
      pageSize: 15,
      search: search || undefined,
      transferStatus: transferFilter || undefined,
      registrationStatus: registrationFilter || undefined,
      settlementStatus: settlementFilter || undefined,
    }),
    [page, search, transferFilter, registrationFilter, settlementFilter]
  );

  const { data, isLoading } = trpc.settlement.list.useQuery(queryInput);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.settlement.delete.useMutation({
    onSuccess: () => {
      toast.success("记录已删除");
      utils.settlement.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error("删除失败: " + err.message);
    },
  });

  const updateMutation = trpc.settlement.update.useMutation({
    onSuccess: () => {
      toast.success("修改已保存");
      utils.settlement.list.invalidate();
      setEditingId(null);
      setEditValues({});
    },
    onError: (err) => {
      toast.error("保存失败: " + err.message);
    },
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
      orderDate: item.orderDate ? new Date(item.orderDate).toISOString().slice(0, 16) : "",
      orderNo: item.orderNo || "",
      groupName: item.groupName || "",
      customerService: item.customerService || "",
      customerName: item.customerName || "",
      originalPrice: item.originalPrice || "0",
      totalPrice: item.totalPrice || "0",
      actualTransfer: item.actualTransfer || "0",
      transferStatus: item.transferStatus || "",
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
      updateData.orderDate = new Date(editValues.orderDate).getTime();
    } else {
      updateData.orderDate = null;
    }
    updateData.orderNo = editValues.orderNo || "";
    updateData.groupName = editValues.groupName || "";
    updateData.customerService = editValues.customerService || "";
    updateData.customerName = editValues.customerName || "";
    updateData.originalPrice = editValues.originalPrice || "0";
    updateData.totalPrice = editValues.totalPrice || "0";
    updateData.actualTransfer = editValues.actualTransfer || "0";
    updateData.transferStatus = editValues.transferStatus || "";
    updateData.registrationStatus = editValues.registrationStatus || "";
    updateData.settlementStatus = editValues.settlementStatus || "";
    updateData.remark = editValues.remark || "";

    updateMutation.mutate({ id: editingId, data: updateData });
  };

  const onEditChange = (field: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [field]: val }));
  };

  const hasActiveFilters =
    search || transferFilter || registrationFilter || settlementFilter;

  // Table cell base style with border
  const thClass =
    "text-[10px] font-heading tracking-widest uppercase text-primary/80 border border-primary/20 px-3 py-2.5 bg-primary/5";
  const tdClass =
    "text-sm border border-primary/10 px-3 py-2";

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
                placeholder="搜索群名或单号..."
                className="pl-9 bg-input/50 border-border text-sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSearch}
              className="text-xs"
            >
              搜索
            </Button>
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            筛选
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="h-3.5 w-3.5" />
              清除筛选
            </Button>
          )}
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/30">
            <div className="space-y-1">
              <label className="text-[10px] font-heading tracking-wider uppercase text-muted-foreground">
                转账状态
              </label>
              <Select
                value={transferFilter || "all"}
                onValueChange={(v) => {
                  setTransferFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="bg-input/50 border-border text-sm h-9">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="已转">已转</SelectItem>
                  <SelectItem value="未转">未转</SelectItem>
                  <SelectItem value="部分转">部分转</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-heading tracking-wider uppercase text-muted-foreground">
                登记状态
              </label>
              <Select
                value={registrationFilter || "all"}
                onValueChange={(v) => {
                  setRegistrationFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="bg-input/50 border-border text-sm h-9">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="已登记">已登记</SelectItem>
                  <SelectItem value="未登记">未登记</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-heading tracking-wider uppercase text-muted-foreground">
                结算状态
              </label>
              <Select
                value={settlementFilter || "all"}
                onValueChange={(v) => {
                  setSettlementFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="bg-input/50 border-border text-sm h-9">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="已结算">已结算</SelectItem>
                  <SelectItem value="未结算">未结算</SelectItem>
                  <SelectItem value="部分结算">部分结算</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Data Table with borders */}
      <div className="blueprint-card rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thClass} w-[50px]`}>#</th>
                <th className={thClass}>接单日期</th>
                <th className={thClass}>单号</th>
                <th className={thClass}>群名</th>
                <th className={thClass}>客户名</th>
                <th className={thClass}>客服</th>
                <th className={`${thClass} text-right`}>原价</th>
                <th className={`${thClass} text-right`}>加价后总价</th>
                <th className={`${thClass} text-right`}>实际转出</th>
                <th className={`${thClass} text-center`}>转账状态</th>
                <th className={`${thClass} text-center`}>登记状态</th>
                <th className={`${thClass} text-center`}>结算状态</th>
                <th className={thClass}>备注</th>
                <th className={`${thClass} text-center w-[100px]`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 14 }).map((_, j) => (
                      <td key={j} className={tdClass}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className={`${tdClass} text-center py-16 text-muted-foreground`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <LayoutGrid className="h-10 w-10 text-muted-foreground/30" />
                      <p className="font-heading tracking-wider text-sm">
                        暂无结算记录
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation("/create")}
                        className="text-xs"
                      >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        新增记录
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.items.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-accent/20 transition-colors ${isEditing ? "bg-primary/5" : ""}`}
                    >
                      <td className={`${tdClass} font-mono text-xs text-muted-foreground`}>
                        {item.id}
                      </td>
                      <td className={`${tdClass} font-mono whitespace-nowrap`}>
                        {isEditing ? (
                          <Input
                            type="datetime-local"
                            value={editValues.orderDate || ""}
                            onChange={(e) => onEditChange("orderDate", e.target.value)}
                            className="h-7 text-xs bg-input/50 border-primary/30 min-w-[160px]"
                          />
                        ) : (
                          formatDate(item.orderDate)
                        )}
                      </td>
                      <td className={tdClass}>
                        {isEditing ? (
                          <EditableCell
                            value={item.orderNo || ""}
                            field="orderNo"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-mono truncate max-w-[120px] inline-block">
                                {item.orderNo || "-"}
                              </span>
                            </TooltipTrigger>
                            {item.orderNo && (
                              <TooltipContent>{item.orderNo}</TooltipContent>
                            )}
                          </Tooltip>
                        )}
                      </td>
                      <td className={`${tdClass} font-medium`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.groupName || ""}
                            field="groupName"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          item.groupName || "-"
                        )}
                      </td>
                      <td className={tdClass}>
                        {isEditing ? (
                          <EditableCell
                            value={item.customerName || ""}
                            field="customerName"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          item.customerName || "-"
                        )}
                      </td>
                      <td className={tdClass}>
                        {isEditing ? (
                          <EditableCell
                            value={item.customerService || ""}
                            field="customerService"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          item.customerService || "-"
                        )}
                      </td>
                      <td className={`${tdClass} font-mono text-right`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.originalPrice || "0"}
                            field="originalPrice"
                            type="number"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          formatMoney(item.originalPrice)
                        )}
                      </td>
                      <td className={`${tdClass} font-mono text-right text-primary`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.totalPrice || "0"}
                            field="totalPrice"
                            type="number"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          formatMoney(item.totalPrice)
                        )}
                      </td>
                      <td className={`${tdClass} font-mono text-right`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.actualTransfer || "0"}
                            field="actualTransfer"
                            type="number"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          formatMoney(item.actualTransfer)
                        )}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.transferStatus ?? ""}
                            field="transferStatus"
                            type="select"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          <StatusBadge value={item.transferStatus ?? ""} />
                        )}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.registrationStatus ?? ""}
                            field="registrationStatus"
                            type="select"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          <StatusBadge value={item.registrationStatus ?? ""} />
                        )}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.settlementStatus ?? ""}
                            field="settlementStatus"
                            type="select"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          <StatusBadge value={item.settlementStatus ?? ""} />
                        )}
                      </td>
                      <td className={`${tdClass} text-sm`}>
                        {isEditing ? (
                          <EditableCell
                            value={item.remark || ""}
                            field="remark"
                            isEditing={true}
                            editValues={editValues}
                            onEditChange={onEditChange}
                          />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm truncate max-w-[120px] inline-block">
                                {item.remark || "-"}
                              </span>
                            </TooltipTrigger>
                            {item.remark && (
                              <TooltipContent>{item.remark}</TooltipContent>
                            )}
                          </Tooltip>
                        )}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
                                  onClick={saveEdit}
                                  disabled={updateMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>保存</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={cancelEdit}
                                >
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  onClick={() => startEdit(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>编辑</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteId(item.id)}
                                >
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(data.totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (data.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= data.totalPages - 2) {
                  pageNum = data.totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom decoration */}
      <div className="flex items-center gap-2 text-muted-foreground/30 text-[10px] font-heading tracking-widest justify-center py-2">
        <div className="h-px w-12 bg-border/50" />
        <span>SETTLEMENT · LEDGER · SYSTEM</span>
        <div className="h-px w-12 bg-border/50" />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent className="blueprint-card border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading tracking-wider">
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除该结算记录，且无法恢复。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
