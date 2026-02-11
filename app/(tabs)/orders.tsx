import { useState, useCallback, useMemo } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LoginPrompt } from "@/components/login-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// 列定义 - 与Excel表格一致
const COLUMNS = [
  { key: "index", label: "序号", width: 60, editable: false, type: "text" as const },
  { key: "orderDate", label: "接单日期", width: 160, editable: true, type: "text" as const },
  { key: "orderNo", label: "单号", width: 140, editable: true, type: "text" as const },
  { key: "groupName", label: "群名", width: 140, editable: true, type: "text" as const },
  { key: "originalPrice", label: "原价", width: 100, editable: true, type: "number" as const },
  { key: "origIncome", label: "原价应到手", width: 110, editable: false, type: "calc" as const },
  { key: "totalPrice", label: "加价后总价", width: 110, editable: true, type: "number" as const },
  { key: "markup", label: "加价", width: 90, editable: false, type: "calc" as const },
  { key: "markupIncome", label: "加价应到手", width: 110, editable: false, type: "calc" as const },
  { key: "actualTransferOut", label: "实际转出", width: 100, editable: true, type: "number" as const },
  { key: "transferStatus", label: "转账状态", width: 90, editable: true, type: "status" as const },
  { key: "markupActual", label: "加价实际到手", width: 120, editable: false, type: "calc" as const },
  { key: "actualIncome", label: "实际到手", width: 110, editable: false, type: "calc" as const },
  { key: "registerStatus", label: "登记状态", width: 100, editable: true, type: "text" as const },
  { key: "settlementStatus", label: "结算状态", width: 100, editable: true, type: "text" as const },
];

function calcFields(o: { originalPrice: any; totalPrice: any; actualTransferOut: any }) {
  const orig = Number(o.originalPrice) || 0;
  const tot = Number(o.totalPrice) || 0;
  const actOut = Number(o.actualTransferOut) || 0;
  const markup = tot - orig;
  const origIncome = orig * 0.4;
  const markupIncome = markup * 0.4;
  const markupActual = markupIncome - actOut;
  const actualIncome = origIncome + markupActual;
  return { markup, origIncome, markupIncome, markupActual, actualIncome };
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

type EditRow = Record<string, string>;

export default function OrdersScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();

  const [filter, setFilter] = useState<"全部" | "已转" | "未转">("全部");
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<number, EditRow>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const queryInput = useMemo(() => ({
    transferStatus: filter === "全部" ? undefined : filter as "已转" | "未转",
    search: search.trim() || undefined,
  }), [filter, search]);

  const { data: orders, isLoading, refetch } = trpc.orders.list.useQuery(queryInput, {
    enabled: isAuthenticated,
  });
  const { data: stats } = trpc.orders.stats.useQuery(undefined, { enabled: isAuthenticated });
  const updateMutation = trpc.orders.update.useMutation();
  const deleteMutation = trpc.orders.delete.useMutation();
  const utils = trpc.useUtils();

  const isAdmin = (user as any)?.role === "admin";

  const enterEditMode = useCallback(() => {
    if (!orders) return;
    const data: Record<number, EditRow> = {};
    for (const o of orders) {
      data[o.id] = {
        orderDate: o.orderDate || "",
        orderNo: o.orderNo || "",
        groupName: o.groupName || "",
        originalPrice: String(o.originalPrice || ""),
        totalPrice: String(o.totalPrice || ""),
        actualTransferOut: String(o.actualTransferOut || ""),
        transferStatus: o.transferStatus || "未转",
        registerStatus: o.registerStatus || "",
        settlementStatus: o.settlementStatus || "",
      };
    }
    setEditData(data);
    setEditMode(true);
  }, [orders]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setEditData({});
  }, []);

  const updateEditField = useCallback((id: number, key: string, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }, []);

  const saveRow = useCallback(async (id: number) => {
    const row = editData[id];
    if (!row) return;
    setSavingId(id);
    try {
      await updateMutation.mutateAsync({
        id,
        orderDate: row.orderDate,
        orderNo: row.orderNo,
        groupName: row.groupName || "未命名",
        originalPrice: row.originalPrice,
        totalPrice: row.totalPrice,
        actualTransferOut: row.actualTransferOut,
        transferStatus: row.transferStatus as "已转" | "未转",
        registerStatus: row.registerStatus,
        settlementStatus: row.settlementStatus,
      });
      utils.orders.list.invalidate();
      utils.orders.stats.invalidate();
    } catch (e: any) {
      alert(e?.message || "保存失败");
    } finally {
      setSavingId(null);
    }
  }, [editData, updateMutation, utils]);

  const saveAll = useCallback(async () => {
    const ids = Object.keys(editData).map(Number);
    for (const id of ids) {
      await saveRow(id);
    }
    exitEditMode();
    refetch();
  }, [editData, saveRow, exitEditMode, refetch]);

  const deleteRow = useCallback(async (id: number) => {
    if (!confirm("确定删除该订单？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      utils.orders.list.invalidate();
      utils.orders.stats.invalidate();
    } catch (e: any) {
      alert(e?.message || "删除失败");
    }
  }, [deleteMutation, utils]);

  if (authLoading) {
    return (
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginPrompt message="登录后即可查看加价结算数据" />;
  }

  const getCellValue = (order: any, col: typeof COLUMNS[number]) => {
    const ed = editMode ? editData[order.id] : null;
    const orig = ed?.originalPrice ?? order.originalPrice;
    const tot = ed?.totalPrice ?? order.totalPrice;
    const actOut = ed?.actualTransferOut ?? order.actualTransferOut;
    const calc = calcFields({ originalPrice: orig, totalPrice: tot, actualTransferOut: actOut });

    switch (col.key) {
      case "index": return String(order.index);
      case "orderDate": return ed?.orderDate ?? (order.orderDate || "");
      case "orderNo": return ed?.orderNo ?? (order.orderNo || "");
      case "groupName": return ed?.groupName ?? (order.groupName || "");
      case "originalPrice": return ed?.originalPrice ?? String(order.originalPrice || "");
      case "totalPrice": return ed?.totalPrice ?? String(order.totalPrice || "");
      case "actualTransferOut": return ed?.actualTransferOut ?? String(order.actualTransferOut || "");
      case "transferStatus": return ed?.transferStatus ?? (order.transferStatus || "");
      case "registerStatus": return ed?.registerStatus ?? (order.registerStatus || "");
      case "settlementStatus": return ed?.settlementStatus ?? (order.settlementStatus || "");
      case "origIncome": return fmt(calc.origIncome);
      case "markup": return fmt(calc.markup);
      case "markupIncome": return fmt(calc.markupIncome);
      case "markupActual": return fmt(calc.markupActual);
      case "actualIncome": return fmt(calc.actualIncome);
      default: return "";
    }
  };

  const totalTableWidth = COLUMNS.reduce((s, c) => s + c.width, 0) + (editMode ? 120 : 0);

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>数据查看</Text>
            <Text style={[styles.pageSubtitle, { color: colors.muted }]}>加价结算明细表格</Text>
          </View>
          {isAdmin && (
            <View style={styles.headerActions}>
              {editMode ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={saveAll}
                  >
                    <Text style={styles.actionBtnText}>全部保存</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtnOutline, { borderColor: colors.border }]}
                    onPress={exitEditMode}
                  >
                    <Text style={[styles.actionBtnOutlineText, { color: colors.muted }]}>取消</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={enterEditMode}
                >
                  <Text style={styles.actionBtnText}>编辑模式</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label="总订单" value={String(stats?.total ?? 0)} color={colors.primary} colors={colors} />
          <StatCard label="已转" value={String(stats?.transferred ?? 0)} color={colors.success} colors={colors} />
          <StatCard label="未转" value={String(stats?.pending ?? 0)} color={colors.error} colors={colors} />
          <StatCard label="总实际到手" value={`¥${fmt(stats?.totalIncome ?? 0)}`} color={colors.primary} colors={colors} />
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          {(["全部", "已转", "未转"] as const).map((f) => {
            const isActive = filter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: isActive ? colors.primary : "transparent",
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.filterBtnText, { color: isActive ? "#fff" : colors.muted }]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            placeholder="搜索群名..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Table */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.tableContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ minWidth: totalTableWidth }}>
              {/* Table Header */}
              <View style={[styles.tableHeaderRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                {COLUMNS.map((col) => (
                  <View key={col.key} style={[styles.tableHeaderCell, { width: col.width }]}>
                    <Text style={[styles.tableHeaderText, { color: colors.muted }]} numberOfLines={1}>
                      {col.label}
                    </Text>
                  </View>
                ))}
                {editMode && (
                  <View style={[styles.tableHeaderCell, { width: 120 }]}>
                    <Text style={[styles.tableHeaderText, { color: colors.muted }]}>操作</Text>
                  </View>
                )}
              </View>

              {/* Table Body */}
              {(!orders || orders.length === 0) ? (
                <View style={styles.emptyRow}>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>暂无数据</Text>
                </View>
              ) : (
                orders.map((order, rowIdx) => (
                  <View
                    key={order.id}
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor: rowIdx % 2 === 0 ? colors.background : colors.surface + "80",
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    {COLUMNS.map((col) => {
                      const cellVal = getCellValue(order, col);
                      const isEditing = editMode && col.editable;

                      if (isEditing && col.type === "status") {
                        const curVal = editData[order.id]?.transferStatus ?? order.transferStatus;
                        return (
                          <View key={col.key} style={[styles.tableCell, { width: col.width }]}>
                            <TouchableOpacity
                              onPress={() => {
                                const newVal = curVal === "已转" ? "未转" : "已转";
                                updateEditField(order.id, "transferStatus", newVal);
                              }}
                              style={[
                                styles.statusTag,
                                {
                                  backgroundColor: curVal === "已转" ? colors.success + "18" : colors.error + "18",
                                  borderColor: curVal === "已转" ? colors.success : colors.error,
                                },
                              ]}
                            >
                              <Text style={[styles.statusTagText, { color: curVal === "已转" ? colors.success : colors.error }]}>
                                {curVal}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      if (isEditing) {
                        return (
                          <View key={col.key} style={[styles.tableCell, { width: col.width }]}>
                            <TextInput
                              style={[styles.cellInput, {
                                backgroundColor: colors.background,
                                borderColor: colors.primary + "40",
                                color: colors.foreground,
                              }]}
                              value={cellVal}
                              onChangeText={(v) => updateEditField(order.id, col.key, v)}
                              keyboardType={col.type === "number" ? "numeric" : "default"}
                            />
                          </View>
                        );
                      }

                      // Read-only cell
                      const isCalc = col.type === "calc";
                      const isStatus = col.key === "transferStatus";
                      const isIncome = col.key === "actualIncome";

                      if (isStatus) {
                        const val = cellVal || "未转";
                        return (
                          <View key={col.key} style={[styles.tableCell, { width: col.width }]}>
                            <View style={[
                              styles.statusTag,
                              {
                                backgroundColor: val === "已转" ? colors.success + "18" : colors.error + "18",
                                borderColor: val === "已转" ? colors.success : colors.error,
                              },
                            ]}>
                              <Text style={[styles.statusTagText, { color: val === "已转" ? colors.success : colors.error }]}>
                                {val}
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View key={col.key} style={[styles.tableCell, { width: col.width }]}>
                          <Text
                            style={[
                              styles.cellText,
                              {
                                color: isCalc ? colors.muted : (isIncome ? colors.primary : colors.foreground),
                                fontWeight: isIncome ? "700" : (col.key === "groupName" ? "600" : "400"),
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {(isCalc || col.type === "number") && cellVal && !isNaN(Number(cellVal)) ? `¥${cellVal}` : cellVal || "-"}
                          </Text>
                        </View>
                      );
                    })}

                    {editMode && (
                      <View style={[styles.tableCell, { width: 120, flexDirection: "row", gap: 6 }]}>
                        <TouchableOpacity
                          style={[styles.rowActionBtn, { backgroundColor: colors.primary }]}
                          onPress={() => saveRow(order.id)}
                          disabled={savingId === order.id}
                        >
                          {savingId === order.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.rowActionBtnText}>保存</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rowActionBtn, { backgroundColor: colors.error }]}
                          onPress={() => deleteRow(order.id)}
                        >
                          <Text style={styles.rowActionBtnText}>删除</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({ label, value, color, colors }: { label: string; value: string; color: string; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  pageHeader: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pageTitle: { fontSize: 24, fontWeight: "700" },
  pageSubtitle: { fontSize: 14, marginTop: 4 },
  headerActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  actionBtnOutline: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnOutlineText: { fontSize: 14, fontWeight: "500" },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  statCard: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 120,
  },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700" },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterBtnText: { fontSize: 13, fontWeight: "500" },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    width: 200,
    marginLeft: 8,
  },
  tableContainer: { flex: 1 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tableCell: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 13,
  },
  cellInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 13,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rowActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rowActionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyRow: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
