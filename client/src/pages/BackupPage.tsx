import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, Upload, Database, Shield, AlertTriangle, CheckCircle2, Loader2, HardDrive, FileJson } from "lucide-react";

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirmImport, setShowConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [pendingFileName, setPendingFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const exportQuery = trpc.backup.export.useQuery(undefined, {
    enabled: false,
  });

  const importMutation = trpc.backup.import.useMutation({
    onSuccess: (stats) => {
      toast.success(
        `数据恢复成功！已导入 ${stats.settlements} 条结算记录、${stats.transferRecords} 条转账记录`
      );
      setIsImporting(false);
      setShowConfirmImport(false);
      setPendingFile(null);
      setPendingFileName("");
      utils.invalidate();
    },
    onError: (err) => {
      toast.error("数据恢复失败: " + err.message);
      setIsImporting(false);
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const jsonStr = JSON.stringify(result.data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        a.href = url;
        a.download = `settlement_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("数据备份文件已下载");
      }
    } catch (err: any) {
      toast.error("导出失败: " + (err.message || "未知错误"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("请选择 JSON 格式的备份文件");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.data || !data.data.settlements) {
          toast.error("无效的备份文件格式");
          return;
        }
        setPendingFile(data);
        setPendingFileName(file.name);
        setShowConfirmImport(true);
      } catch {
        toast.error("文件解析失败，请确认是有效的 JSON 备份文件");
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = () => {
    if (!pendingFile) return;
    setIsImporting(true);
    importMutation.mutate({ data: pendingFile.data });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="h-px w-6 bg-primary/50" />
        <Database className="h-5 w-5 text-primary" />
        <h1 className="font-heading font-bold text-lg tracking-widest uppercase text-foreground">
          数据备份
        </h1>
        <div className="h-px w-12 bg-primary/30" />
      </div>

      {/* Info Card */}
      <div className="glass-card rounded-lg p-5">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-foreground">数据安全说明</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              建议在每次版本更新前进行数据备份。备份文件包含所有结算明细、特殊单数据和转账记录。
              恢复数据时会<span className="text-amber-400 font-medium">覆盖当前所有数据</span>，请谨慎操作。
            </p>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="glass-card rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Download className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-medium text-sm text-foreground">导出备份</h2>
            <p className="text-xs text-muted-foreground mt-0.5">将所有数据导出为 JSON 文件保存到本地</p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full h-11 bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-500/30 backdrop-blur-sm"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              正在导出...
            </>
          ) : (
            <>
              <HardDrive className="h-4 w-4 mr-2" />
              立即备份数据
            </>
          )}
        </Button>
      </div>

      {/* Import Section */}
      <div className="glass-card rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Upload className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h2 className="font-medium text-sm text-foreground">恢复数据</h2>
            <p className="text-xs text-muted-foreground mt-0.5">从备份文件恢复数据（将覆盖当前数据）</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="w-full h-11 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 backdrop-blur-sm"
        >
          <FileJson className="h-4 w-4 mr-2" />
          选择备份文件
        </Button>
      </div>

      {/* Confirm Import Dialog */}
      {showConfirmImport && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-lg p-6 max-w-md w-full mx-4 space-y-4 border border-primary/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h3 className="font-medium text-foreground">确认恢复数据</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="glass-card rounded-md p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">备份文件</p>
                <p className="text-foreground font-mono text-xs">{pendingFileName}</p>
              </div>
              <div className="glass-card rounded-md p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">备份时间</p>
                <p className="text-foreground text-xs">{pendingFile.exportedAt ? new Date(pendingFile.exportedAt).toLocaleString("zh-CN") : "-"}</p>
              </div>
              <div className="glass-card rounded-md p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">数据统计</p>
                <p className="text-foreground text-xs">
                  {pendingFile.data.settlements?.length || 0} 条结算记录，
                  {pendingFile.data.transferRecords?.length || 0} 条转账记录
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300/90">
                  恢复操作将<strong>清除当前所有数据</strong>并替换为备份文件中的数据，此操作不可撤销。
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowConfirmImport(false);
                  setPendingFile(null);
                  setPendingFileName("");
                }}
                disabled={isImporting}
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="flex-1 bg-amber-600/80 hover:bg-amber-600 text-white border border-amber-500/30"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    恢复中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    确认恢复
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
