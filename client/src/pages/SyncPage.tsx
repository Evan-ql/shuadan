import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  RefreshCw,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  ShieldCheck,
  Upload,
  Pencil,
  RotateCw,
  EyeOff,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function formatMoney(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "" || val === "0" || val === "0.00") return "0.00";
  return Number(val).toFixed(2);
}

// ==================== 同步结果弹窗 ====================
function SyncResultDialog({
  open,
  onClose,
  result,
}: {
  open: boolean;
  onClose: () => void;
  result: any;
}) {
  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            )}
            同步结果
          </DialogTitle>
          <DialogDescription>{result.message}</DialogDescription>
        </DialogHeader>

        {/* 步骤详情 */}
        <div className="space-y-2">
          <p className="text-xs font-heading tracking-wider text-muted-foreground uppercase">执行步骤</p>
          {result.steps?.map((step: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {step.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span className="font-medium">{step.step}</span>
              <span className="text-muted-foreground">— {step.message}</span>
            </div>
          ))}
        </div>

        {/* 统计摘要 */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          {[
            { label: "已登记", value: result.summary?.registered, color: "text-emerald-400" },
            { label: "已结算", value: result.summary?.settled, color: "text-emerald-400" },
            { label: "已上传", value: result.summary?.uploaded, color: "text-sky-400" },
            { label: "已跳过", value: result.summary?.skipped, color: "text-muted-foreground" },
            { label: "失败", value: result.summary?.failed, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="text-center p-2 border border-primary/10 rounded-sm">
              <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 成功列表 */}
        {result.successOrders?.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-heading tracking-wider text-emerald-400 uppercase">成功上传</p>
            <div className="max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-400/5">
                    <th className="text-left px-2 py-1 border border-emerald-400/10">订单号</th>
                    <th className="text-left px-2 py-1 border border-emerald-400/10">客户名</th>
                    <th className="text-right px-2 py-1 border border-emerald-400/10">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {result.successOrders.map((o: any, i: number) => (
                    <tr key={i}>
                      <td className="px-2 py-1 border border-primary/10 font-mono">{o.orderNo}</td>
                      <td className="px-2 py-1 border border-primary/10">{o.customerName}</td>
                      <td className="px-2 py-1 border border-primary/10 text-right font-mono">{o.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 失败列表 */}
        {result.failedOrders?.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-heading tracking-wider text-red-400 uppercase">同步失败</p>
            <div className="max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-red-400/5">
                    <th className="text-left px-2 py-1 border border-red-400/10">订单号</th>
                    <th className="text-left px-2 py-1 border border-red-400/10">客户名</th>
                    <th className="text-right px-2 py-1 border border-red-400/10">金额</th>
                    <th className="text-left px-2 py-1 border border-red-400/10">失败原因</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failedOrders.map((o: any, i: number) => (
                    <tr key={i}>
                      <td className="px-2 py-1 border border-primary/10 font-mono">{o.orderNo}</td>
                      <td className="px-2 py-1 border border-primary/10">{o.customerName}</td>
                      <td className="px-2 py-1 border border-primary/10 text-right font-mono">{o.amount}</td>
                      <td className="px-2 py-1 border border-primary/10 text-red-400">{o.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== 失败队列编辑行 ====================
function FailureEditRow({
  item,
  index,
  onSave,
  onCancel,
}: {
  item: any;
  index: number;
  onSave: (data: Record<string, any>) => void;
  onCancel: () => void;
}) {
  const [editValues, setEditValues] = useState({
    groupName: item.groupName || "",
    customerName: item.customerName || "",
    customerService: item.customerService || "",
    originalPrice: item.originalPrice || "0",
    totalPrice: item.totalPrice || "0",
    orderNo: item.orderNo || "",
  });

  const onChange = (field: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [field]: val }));
  };

  const inputCls = "h-7 text-xs bg-input/50 border-primary/30 min-w-[60px]";

  return (
    <>
      <td className="text-center text-muted-foreground text-xs px-3 py-2 border border-primary/10">{index}</td>
      <td className="px-3 py-2 border border-primary/10">
        <Input value={editValues.groupName} onChange={(e) => onChange("groupName", e.target.value)} className={inputCls} />
      </td>
      <td className="px-3 py-2 border border-primary/10">
        <Input value={editValues.customerName} onChange={(e) => onChange("customerName", e.target.value)} className={inputCls} />
      </td>
      <td className="px-3 py-2 border border-primary/10">
        <Input value={editValues.customerService} onChange={(e) => onChange("customerService", e.target.value)} className={inputCls} />
      </td>
      <td className="px-3 py-2 border border-primary/10 text-center">
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-sm ${item.isSpecial ? "text-amber-400 border-amber-400/30 bg-amber-400/10" : "text-muted-foreground border-border bg-muted/30"}`}>
          {item.isSpecial ? "是" : "否"}
        </span>
      </td>
      <td className="px-3 py-2 border border-primary/10">
        <Input value={editValues.originalPrice} onChange={(e) => onChange("originalPrice", e.target.value)} className={inputCls} type="text" />
      </td>
      <td className="px-3 py-2 border border-primary/10">
        <Input value={editValues.totalPrice} onChange={(e) => onChange("totalPrice", e.target.value)} className={inputCls} type="text" />
      </td>
      <td className="px-3 py-2 border border-primary/10">
        <Input value={editValues.orderNo} onChange={(e) => onChange("orderNo", e.target.value)} className={`${inputCls} min-w-[120px]`} />
      </td>
      <td className="px-3 py-2 border border-primary/10 text-xs font-mono whitespace-nowrap">
        {item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "-"}
      </td>
      <td className="px-3 py-2 border border-primary/10 text-red-400 text-xs">{item.failReason || "-"}</td>
      <td className="px-3 py-2 border border-primary/10 text-center">
        <div className="flex items-center justify-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" onClick={() => onSave(editValues)}>
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>保存</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onCancel}>
                <XCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>取消</TooltipContent>
          </Tooltip>
        </div>
      </td>
    </>
  );
}

// ==================== 主页面 ====================
export default function SyncPage() {
  const [, setLocation] = useLocation();
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [editingFailureId, setEditingFailureId] = useState<number | null>(null);
  const [failurePage, setFailurePage] = useState(1);
  const [ignoreConfirmId, setIgnoreConfirmId] = useState<number | null>(null);

  // Queries
  const { data: tokenData, isLoading: tokenLoading } = trpc.chuangzhi.getToken.useQuery();
  const { data: failureData, isLoading: failuresLoading } = trpc.chuangzhi.failures.useQuery({
    page: failurePage,
    pageSize: 20,
    status: "pending",
  });

  const utils = trpc.useUtils();

  // Mutations
  const saveTokenMutation = trpc.chuangzhi.saveToken.useMutation({
    onSuccess: () => {
      toast.success("Token已保存");
      utils.chuangzhi.getToken.invalidate();
      setShowTokenInput(false);
      setTokenInput("");
    },
    onError: (err) => toast.error("保存失败: " + err.message),
  });

  const verifyTokenMutation = trpc.chuangzhi.verifyToken.useMutation({
    onSuccess: (result) => {
      if (result.valid) {
        toast.success("Token验证通过");
      } else {
        toast.error("Token无效: " + result.message);
      }
    },
    onError: (err) => toast.error("验证失败: " + err.message),
  });

  const syncMutation = trpc.chuangzhi.sync.useMutation({
    onSuccess: (result) => {
      setSyncResult(result);
      setShowResult(true);
      utils.chuangzhi.failures.invalidate();
      utils.settlement.list.invalidate();
    },
    onError: (err) => toast.error("同步失败: " + err.message),
  });

  const retrySyncMutation = trpc.chuangzhi.retrySync.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("重新同步成功");
      } else {
        toast.error("同步失败: " + result.message);
      }
      utils.chuangzhi.failures.invalidate();
      utils.settlement.list.invalidate();
    },
    onError: (err) => toast.error("操作失败: " + err.message),
  });

  const ignoreFailureMutation = trpc.chuangzhi.ignoreFailure.useMutation({
    onSuccess: () => {
      toast.success("已忽略");
      utils.chuangzhi.failures.invalidate();
      setIgnoreConfirmId(null);
    },
    onError: (err) => toast.error("操作失败: " + err.message),
  });

  const updateSettlementMutation = trpc.settlement.update.useMutation({
    onSuccess: () => {
      toast.success("修改已保存");
      utils.chuangzhi.failures.invalidate();
      setEditingFailureId(null);
    },
    onError: (err) => toast.error("保存失败: " + err.message),
  });

  const handleSaveEdit = (failureItem: any, editData: Record<string, any>) => {
    updateSettlementMutation.mutate({
      id: failureItem.settlementId,
      data: {
        groupName: editData.groupName,
        customerName: editData.customerName,
        customerService: editData.customerService,
        originalPrice: editData.originalPrice,
        totalPrice: editData.totalPrice,
        orderNo: editData.orderNo,
      },
    });
  };

  const thClass = "text-[10px] font-heading tracking-widest uppercase text-primary/80 border border-primary/20 px-3 py-2.5 bg-primary/5";
  const tdClass = "text-sm border border-primary/10 px-3 py-2";

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="h-px w-6 bg-primary/50" />
        <RefreshCw className="h-5 w-5 text-primary" />
        <h1 className="font-heading font-bold text-lg tracking-widest uppercase text-foreground">
          创致同步
        </h1>
        <div className="h-px w-12 bg-primary/30" />
      </div>

      {/* Token Management */}
      <div className="blueprint-card rounded-sm p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Key className="h-4 w-4 text-primary" />
          <span className="text-xs font-heading tracking-widest uppercase text-primary/80">Token 配置</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">状态：</span>
            {tokenLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : tokenData?.hasToken ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                已配置
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                未配置
              </span>
            )}
          </div>

          {!showTokenInput ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowTokenInput(true)}>
                <Key className="h-3.5 w-3.5 mr-1" />
                {tokenData?.hasToken ? "更新Token" : "配置Token"}
              </Button>
              {tokenData?.hasToken && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => verifyTokenMutation.mutate()}
                  disabled={verifyTokenMutation.isPending}
                >
                  {verifyTokenMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  )}
                  验证Token
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-[300px]">
              <Input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="粘贴创致平台的 Admin-Token..."
                className="flex-1 bg-input/50 border-border text-sm font-mono"
                type="password"
              />
              <Button
                size="sm"
                className="text-xs"
                onClick={() => saveTokenMutation.mutate({ token: tokenInput })}
                disabled={!tokenInput.trim() || saveTokenMutation.isPending}
              >
                {saveTokenMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                保存
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setShowTokenInput(false); setTokenInput(""); }}>
                取消
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          提示：登录创致平台后，在浏览器开发者工具中找到 Cookie 中的 <code className="text-primary">Admin-Token</code> 值并粘贴到此处。
        </p>
      </div>

      {/* Sync Actions */}
      <div className="blueprint-card rounded-sm p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="h-4 w-4 text-primary" />
          <span className="text-xs font-heading tracking-widest uppercase text-primary/80">一键同步</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => syncMutation.mutate({ mode: "normal" })}
            disabled={syncMutation.isPending || !tokenData?.hasToken}
            className="text-sm"
          >
            {syncMutation.isPending && syncMutation.variables?.mode === "normal" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            同步普通单
          </Button>

          <Button
            onClick={() => syncMutation.mutate({ mode: "special" })}
            disabled={syncMutation.isPending || !tokenData?.hasToken}
            variant="secondary"
            className="text-sm"
          >
            {syncMutation.isPending && syncMutation.variables?.mode === "special" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            同步特殊单
          </Button>
        </div>

        {!tokenData?.hasToken && (
          <p className="text-xs text-amber-400">请先配置Token后再进行同步操作。</p>
        )}

        <p className="text-xs text-muted-foreground">
          同步流程：验证Token → 同步登记状态 → 同步结算状态 → 上传新订单。日期、订单编号、原价/加价后总价、客户名称任一不全的订单将自动跳过。
        </p>
      </div>

      {/* Failure Queue */}
      <div className="blueprint-card rounded-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs font-heading tracking-widest uppercase text-red-400/80">同步失败队列</span>
            {failureData && failureData.total > 0 && (
              <span className="text-xs text-muted-foreground">共 {failureData.total} 条</span>
            )}
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-500px)]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[oklch(0.14_0.04_260)]">
              <tr>
                <th className={`${thClass} w-[50px]`}>序号</th>
                <th className={thClass}>群名称</th>
                <th className={thClass}>结算客户名称</th>
                <th className={thClass}>客服</th>
                <th className={`${thClass} text-center`}>特殊单</th>
                <th className={`${thClass} text-right`}>原价</th>
                <th className={`${thClass} text-right`}>加价后总价</th>
                <th className={`${thClass} min-w-[130px]`}>订单编号</th>
                <th className={thClass}>登记时间</th>
                <th className={thClass}>失败原因</th>
                <th className={`${thClass} text-center w-[140px]`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {failuresLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className={tdClass}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !failureData || failureData.items.length === 0 ? (
                <tr>
                  <td colSpan={11} className={`${tdClass} text-center py-12 text-muted-foreground`}>
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400/30" />
                      <p className="text-sm">暂无同步失败记录</p>
                    </div>
                  </td>
                </tr>
              ) : (
                failureData.items.map((item: any, index: number) => {
                  const isEditing = editingFailureId === item.id;
                  const rowIndex = (failureData.page - 1) * failureData.pageSize + index + 1;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-primary/5 ${isEditing ? "bg-primary/10" : ""}`}
                    >
                      {isEditing ? (
                        <FailureEditRow
                          item={item}
                          index={rowIndex}
                          onSave={(editData) => handleSaveEdit(item, editData)}
                          onCancel={() => setEditingFailureId(null)}
                        />
                      ) : (
                        <>
                          <td className={`${tdClass} text-center text-muted-foreground text-xs`}>{rowIndex}</td>
                          <td className={`${tdClass} font-medium`}>{item.groupName || "-"}</td>
                          <td className={tdClass}>{item.customerName || "-"}</td>
                          <td className={tdClass}>{item.customerService || "-"}</td>
                          <td className={`${tdClass} text-center`}>
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-sm ${item.isSpecial ? "text-amber-400 border-amber-400/30 bg-amber-400/10" : "text-muted-foreground border-border bg-muted/30"}`}>
                              {item.isSpecial ? "是" : "否"}
                            </span>
                          </td>
                          <td className={`${tdClass} font-mono text-right`}>{formatMoney(item.originalPrice)}</td>
                          <td className={`${tdClass} font-mono text-right`}>{formatMoney(item.totalPrice)}</td>
                          <td className={tdClass}>
                            <span className="text-sm font-mono whitespace-nowrap select-all">{item.orderNo || "-"}</span>
                          </td>
                          <td className={`${tdClass} text-xs font-mono whitespace-nowrap`}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "-"}
                          </td>
                          <td className={`${tdClass} text-red-400 text-xs`}>{item.failReason || "-"}</td>
                          <td className={`${tdClass} text-center`}>
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                                    onClick={() => setEditingFailureId(item.id)}
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
                                    className="h-7 w-7 text-muted-foreground hover:text-emerald-400"
                                    onClick={() => retrySyncMutation.mutate({ syncFailureId: item.id, settlementId: item.settlementId })}
                                    disabled={retrySyncMutation.isPending}
                                  >
                                    {retrySyncMutation.isPending ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RotateCw className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>重新同步</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-amber-400"
                                    onClick={() => setIgnoreConfirmId(item.id)}
                                  >
                                    <EyeOff className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>忽略</TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {failureData && failureData.totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-2 border-t border-primary/20">
            <span className="text-xs text-muted-foreground font-heading tracking-wider">
              第 {failureData.page} / {failureData.totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={failurePage <= 1} onClick={() => setFailurePage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={failurePage >= failureData.totalPages} onClick={() => setFailurePage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom decoration */}
      <div className="flex items-center gap-2 text-muted-foreground/30 text-[10px] font-heading tracking-widest justify-center">
        <div className="h-px w-16 bg-border/50" />
        <span>CHUANGZHI · SYNC · MODULE</span>
        <div className="h-px w-16 bg-border/50" />
      </div>

      {/* Sync Result Dialog */}
      <SyncResultDialog open={showResult} onClose={() => setShowResult(false)} result={syncResult} />

      {/* Ignore Confirmation */}
      <AlertDialog open={ignoreConfirmId !== null} onOpenChange={() => setIgnoreConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认忽略</AlertDialogTitle>
            <AlertDialogDescription>忽略后该记录将从失败队列中移除，不再提示。确定要继续吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => ignoreConfirmId && ignoreFailureMutation.mutate({ id: ignoreConfirmId })}
            >
              {ignoreFailureMutation.isPending ? "处理中..." : "确认忽略"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
