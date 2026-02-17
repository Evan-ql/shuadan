import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  ArrowLeft,
  PlusCircle,
  Trash2,
  Upload,
  FileSpreadsheet,
  Plus,
  Send,
  Copy,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

// ---------- helpers ----------

let _idCounter = 0;
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for browsers that don't support crypto.randomUUID
  _idCounter++;
  return `${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 11)}`;
}

// ---------- types ----------

interface RowData {
  id: string; // client-only unique key
  orderDate: number | null;
  orderNo: string;
  groupName: string;
  customerName: string;
  customerService: string;
  originalPrice: string;
  remark: string;
}

function createEmptyRow(): RowData {
  return {
    id: generateId(),
    orderDate: null,
    orderNo: "",
    groupName: "",
    customerName: "",
    customerService: "",
    originalPrice: "0",
    remark: "",
  };
}

// ---------- column mapping ----------

/** Maps common Chinese / English header names to RowData keys */
const HEADER_MAP: Record<string, keyof RowData> = {
  接单日期: "orderDate",
  日期: "orderDate",
  date: "orderDate",
  orderdate: "orderDate",
  单号: "orderNo",
  订单号: "orderNo",
  orderno: "orderNo",
  order_no: "orderNo",
  群名: "groupName",
  groupname: "groupName",
  group_name: "groupName",
  客户名: "customerName",
  客户: "customerName",
  customername: "customerName",
  customer_name: "customerName",
  客服: "customerService",
  customerservice: "customerService",
  customer_service: "customerService",
  原价: "originalPrice",
  价格: "originalPrice",
  金额: "originalPrice",
  originalprice: "originalPrice",
  original_price: "originalPrice",
  price: "originalPrice",
  amount: "originalPrice",
  备注: "remark",
  remark: "remark",
  note: "remark",
};

function normalizeHeader(raw: string): keyof RowData | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  return HEADER_MAP[key] ?? null;
}

/** Try to parse a cell value as a UTC-ms timestamp */
function parseDateCell(value: any): number | null {
  if (value == null || value === "") return null;

  // xlsx serial date number
  if (typeof value === "number" && value > 25000 && value < 100000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = epoch.getTime() + value * 86400000;
    return ms;
  }

  // string date
  if (typeof value === "string") {
    const d = new Date(value.replace(/\//g, "-"));
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.getTime();
  }

  return null;
}

function parseExcelRows(sheet: XLSX.WorkSheet): RowData[] {
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
  });
  if (jsonRows.length === 0) return [];

  // build column mapping from first row headers
  const sampleKeys = Object.keys(jsonRows[0]);
  const mapping: { src: string; dest: keyof RowData }[] = [];
  for (const k of sampleKeys) {
    const dest = normalizeHeader(k);
    if (dest) mapping.push({ src: k, dest });
  }

  return jsonRows.map((row) => {
    const r = createEmptyRow();
    for (const { src, dest } of mapping) {
      const val = row[src];
      if (dest === "orderDate") {
        r.orderDate = parseDateCell(val);
      } else if (dest === "originalPrice") {
        const n = parseFloat(String(val));
        r.originalPrice = isNaN(n) ? "0" : n.toFixed(2);
      } else if (dest !== "id") {
        (r as any)[dest] = String(val ?? "");
      }
    }
    return r;
  });
}

// ---------- component ----------

export default function BatchCreateSettlement() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<RowData[]>([createEmptyRow()]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // shared fields that auto-fill new rows
  const [sharedDate, setSharedDate] = useState<number | null>(null);
  const [sharedGroupName, setSharedGroupName] = useState("");
  const [sharedCustomerService, setSharedCustomerService] = useState("");

  const batchMutation = trpc.settlement.batchCreate.useMutation({
    onSuccess: (result) => {
      toast.success(`成功创建 ${result.count} 条记录`);
      utils.settlement.list.invalidate();
      setLocation("/");
    },
    onError: (err) => {
      toast.error("批量创建失败: " + err.message);
    },
  });

  // ---- row operations ----

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        ...createEmptyRow(),
        orderDate: sharedDate,
        groupName: sharedGroupName,
        customerService: sharedCustomerService,
      },
    ]);
  }, [sharedDate, sharedGroupName, sharedCustomerService]);

  const addMultipleRows = useCallback(
    (count: number) => {
      const newRows = Array.from({ length: count }, () => ({
        ...createEmptyRow(),
        orderDate: sharedDate,
        groupName: sharedGroupName,
        customerService: sharedCustomerService,
      }));
      setRows((prev) => [...prev, ...newRows]);
    },
    [sharedDate, sharedGroupName, sharedCustomerService]
  );

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const duplicateRow = useCallback((id: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], id: generateId() };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }, []);

  const updateRow = useCallback(
    (id: string, field: keyof RowData, value: any) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  // ---- apply shared fields to all rows ----

  const applySharedToAll = useCallback(() => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        orderDate: sharedDate ?? r.orderDate,
        groupName: sharedGroupName || r.groupName,
        customerService: sharedCustomerService || r.customerService,
      }))
    );
    toast.success("已将共用字段应用到所有行");
  }, [sharedDate, sharedGroupName, sharedCustomerService]);

  // ---- file import ----

  const handleFileImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const parsed = parseExcelRows(firstSheet);
          if (parsed.length === 0) {
            toast.error("文件中未找到有效数据，请检查表头是否包含：接单日期、单号、群名、客户名、客服、原价、备注");
            return;
          }
          setRows((prev) => {
            // if only one empty row, replace it
            if (
              prev.length === 1 &&
              !prev[0].orderNo &&
              !prev[0].groupName &&
              !prev[0].customerName
            ) {
              return parsed;
            }
            return [...prev, ...parsed];
          });
          toast.success(`成功导入 ${parsed.length} 条记录`);
        } catch (err: any) {
          toast.error("文件解析失败: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileImport(file);
    },
    [handleFileImport]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ---- submit ----

  const handleSubmit = () => {
    // filter out completely empty rows
    const validRows = rows.filter(
      (r) => r.orderNo || r.groupName || r.customerName || r.originalPrice !== "0"
    );
    if (validRows.length === 0) {
      toast.error("没有可提交的记录，请至少填写一行数据");
      return;
    }
    const items = validRows.map((r) => ({
      orderDate: r.orderDate,
      orderNo: r.orderNo,
      groupName: r.groupName,
      customerName: r.customerName,
      customerService: r.customerService,
      originalPrice: r.originalPrice,
      totalPrice: "0",
      shouldTransfer: "0",
      actualTransfer: "0",
      transferStatus: "",
      registrationStatus: "",
      settlementStatus: "",
      isSpecial: false,
      remark: r.remark,
    }));
    batchMutation.mutate({ items });
  };

  // ---- helpers ----

  const validCount = rows.filter(
    (r) => r.orderNo || r.groupName || r.customerName || r.originalPrice !== "0"
  ).length;

  const thClass =
    "text-[10px] font-heading tracking-widest uppercase text-primary/80 border border-primary/20 px-2 py-2 bg-primary/5 whitespace-nowrap";
  const tdClass = "border border-primary/10 px-1 py-1";

  return (
    <div className="max-w-full mx-auto">
      {/* Page header */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="mb-3 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回列表
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-8 bg-primary/50" />
          <PlusCircle className="h-5 w-5 text-primary" />
          <h1 className="font-heading font-bold text-lg tracking-widest uppercase text-foreground">
            批量新增记录
          </h1>
          <div className="h-px flex-1 bg-primary/30" />
        </div>
        <p className="text-sm text-muted-foreground ml-14 tracking-wide">
          支持 Excel/CSV 文件导入，或手动逐行录入
        </p>
      </div>

      {/* File import area */}
      <div
        className="blueprint-card rounded-sm p-6 mb-4 border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors cursor-pointer text-center"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileImport(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-primary/60" />
            <FileSpreadsheet className="h-6 w-6 text-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground">
            拖拽 Excel/CSV 文件到此处，或点击选择文件
          </p>
          <p className="text-xs text-muted-foreground/60">
            支持 .xlsx / .xls / .csv 格式，表头需包含：接单日期、单号、群名、客户名、客服、原价、备注（可选）
          </p>
        </div>
      </div>

      {/* Shared fields */}
      <div className="blueprint-card rounded-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Copy className="h-4 w-4 text-primary/60" />
          <span className="text-xs font-heading tracking-wider uppercase text-muted-foreground">
            共用字段（新增行时自动填充）
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-heading tracking-wider uppercase text-muted-foreground">
              接单日期
            </label>
            <DatePicker
              value={sharedDate ? new Date(sharedDate) : undefined}
              onChange={(d) => setSharedDate(d ? d.getTime() : null)}
              placeholder="共用日期"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-heading tracking-wider uppercase text-muted-foreground">
              群名
            </label>
            <Input
              value={sharedGroupName}
              onChange={(e) => setSharedGroupName(e.target.value)}
              placeholder="共用群名"
              className="h-8 text-xs bg-input/50 border-border"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-heading tracking-wider uppercase text-muted-foreground">
              客服
            </label>
            <Input
              value={sharedCustomerService}
              onChange={(e) => setSharedCustomerService(e.target.value)}
              placeholder="共用客服"
              className="h-8 text-xs bg-input/50 border-border"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={applySharedToAll}
            className="h-8 text-xs"
          >
            应用到所有行
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="blueprint-card rounded-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thClass} text-center w-[40px]`}>#</th>
                <th className={`${thClass} min-w-[130px]`}>接单日期</th>
                <th className={`${thClass} min-w-[120px]`}>单号</th>
                <th className={`${thClass} min-w-[100px]`}>群名</th>
                <th className={`${thClass} min-w-[90px]`}>客户名</th>
                <th className={`${thClass} min-w-[80px]`}>客服</th>
                <th className={`${thClass} min-w-[90px]`}>原价</th>
                <th className={`${thClass} min-w-[100px]`}>备注</th>
                <th className={`${thClass} text-center w-[80px]`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-primary/5"
                >
                  <td className={`${tdClass} text-center text-xs text-muted-foreground`}>
                    {index + 1}
                  </td>
                  <td className={tdClass}>
                    <DatePicker
                      value={row.orderDate ? new Date(row.orderDate) : undefined}
                      onChange={(d) =>
                        updateRow(row.id, "orderDate", d ? d.getTime() : null)
                      }
                      placeholder="选择日期"
                      className="h-7 text-xs min-w-[120px]"
                    />
                  </td>
                  <td className={tdClass}>
                    <Input
                      value={row.orderNo}
                      onChange={(e) =>
                        updateRow(row.id, "orderNo", e.target.value)
                      }
                      placeholder="单号"
                      className="h-7 text-xs bg-input/50 border-primary/20 min-w-[100px]"
                    />
                  </td>
                  <td className={tdClass}>
                    <Input
                      value={row.groupName}
                      onChange={(e) =>
                        updateRow(row.id, "groupName", e.target.value)
                      }
                      placeholder="群名"
                      className="h-7 text-xs bg-input/50 border-primary/20 min-w-[80px]"
                    />
                  </td>
                  <td className={tdClass}>
                    <Input
                      value={row.customerName}
                      onChange={(e) =>
                        updateRow(row.id, "customerName", e.target.value)
                      }
                      placeholder="客户名"
                      className="h-7 text-xs bg-input/50 border-primary/20 min-w-[70px]"
                    />
                  </td>
                  <td className={tdClass}>
                    <Input
                      value={row.customerService}
                      onChange={(e) =>
                        updateRow(row.id, "customerService", e.target.value)
                      }
                      placeholder="客服"
                      className="h-7 text-xs bg-input/50 border-primary/20 min-w-[60px]"
                    />
                  </td>
                  <td className={tdClass}>
                    <Input
                      value={row.originalPrice}
                      onChange={(e) =>
                        updateRow(row.id, "originalPrice", e.target.value)
                      }
                      type="text"
                      placeholder="0"
                      className="h-7 text-xs bg-input/50 border-primary/20 font-mono min-w-[70px]"
                    />
                  </td>
                  <td className={tdClass}>
                    <Input
                      value={row.remark}
                      onChange={(e) =>
                        updateRow(row.id, "remark", e.target.value)
                      }
                      placeholder="备注"
                      className="h-7 text-xs bg-input/50 border-primary/20 min-w-[80px]"
                    />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => duplicateRow(row.id)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>复制此行</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeRow(row.id)}
                            disabled={rows.length <= 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>删除此行</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row buttons */}
        <div className="flex items-center gap-2 p-3 border-t border-primary/20">
          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加 1 行
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addMultipleRows(5)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加 5 行
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addMultipleRows(10)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加 10 行
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            共 {rows.length} 行，有效 {validCount} 条
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowClearConfirm(true)}
          className="text-xs text-muted-foreground hover:text-destructive"
          disabled={rows.length <= 1 && !rows[0]?.orderNo}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          清空所有
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={batchMutation.isPending || validCount === 0}
          className="font-heading tracking-wider uppercase text-sm px-8"
        >
          {batchMutation.isPending ? (
            "提交中..."
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              批量创建 ({validCount} 条)
            </>
          )}
        </Button>
      </div>

      {/* Bottom decoration */}
      <div className="flex items-center gap-2 mt-4 text-muted-foreground/30 text-[10px] font-heading tracking-widest justify-center">
        <div className="h-px w-12 bg-border/50" />
        <span>BATCH · RECORD · ENTRY</span>
        <div className="h-px w-12 bg-border/50" />
      </div>

      {/* Clear confirmation */}
      <AlertDialog
        open={showClearConfirm}
        onOpenChange={() => setShowClearConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将清空所有已填写的数据，无法恢复。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRows([createEmptyRow()]);
                setShowClearConfirm(false);
                toast.success("已清空所有数据");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
