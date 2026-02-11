import { useState, useCallback, useMemo, useRef } from "react";
import {
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { LoginPrompt } from "@/components/login-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function formatNum(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function calcFields(o: { originalPrice: string | number; totalPrice: string | number; actualTransferOut: string | number }) {
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

type FilterType = "全部" | "已转" | "未转";

// 表格列定义 - 与Excel一致的顺序
const COLUMNS = [
  { key: "index", label: "序号", width: 60, editable: false },
  { key: "orderDate", label: "接单日期", width: 140, editable: true },
  { key: "orderNo", label: "单号", width: 130, editable: true },
  { key: "groupName", label: "群名", width: 130, editable: true },
  { key: "originalPrice", label: "原价", width: 100, editable: true, isNumber: true },
  { key: "origIncome", label: "原价应到手", width: 110, editable: false, isCalc: true },
  { key: "totalPrice", label: "加价后总价", width: 110, editable: true, isNumber: true },
  { key: "markup", label: "加价", width: 90, editable: false, isCalc: true },
  { key: "markupIncome", label: "加价应到手", width: 110, editable: false, isCalc: true },
  { key: "actualTransferOut", label: "实际转出", width: 100, editable: true, isNumber: true },
  { key: "transferStatus", label: "转账状态", width: 90, editable: true, isStatus: true },
  { key: "markupActual", label: "加价实际到手", width: 120, editable: false, isCalc: true },
  { key: "actualIncome", label: "实际到手", width: 100, editable: false, isCalc: true, isHighlight: true },
  { key: "registerStatus", label: "登记状态", width: 90, editable: true },
  { key: "settlementStatus", label: "结算状态", width: 90, editable: true },
] as const;

const TOTAL_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

export default function OrdersScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();

  const [filter, setFilter] = useState<FilterType>("全部");
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editingRows, setEditingRows] = useState<Record<number, Record<string, string>>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const queryInput = useMemo(() => {
    const input: any = {};
    if (filter !== "全部") input.transferStatus = filter;
    if (search.trim()) input.search = search.trim();
    return input;
  }, [filter, search]);

  const { data: orders, isLoading, refetch, isRefetching } = trpc.orders.list.useQuery(queryInput, {
    enabled: isAuthenticated,
  });
  const { data: stats } = trpc.orders.stats.useQuery(undefined, { enabled: isAuthenticated });
  const updateMutation = trpc.orders.update.useMutation();
  const deleteMutation = trpc.orders.delete.useMutation();
  const utils = trpc.useUtils();

  const isAdmin = (user as any)?.role === "admin";

  // 进入编辑模式时，初始化所有行的编辑数据
  const enterEditMode = useCallback(() => {
    if (!orders) return;
    const rows: Record<number, Record<string, string>> = {};
    for (const o of orders) {
      rows[o.id] = {
        orderDate: o.orderDate || "",
        orderNo: o.orderNo || "",
        groupName: o.groupName,
        originalPrice: String(Number(o.originalPrice) || 0),
        totalPrice: String(Number(o.totalPrice) || 0),
        actualTransferOut: String(Number(o.actualTransferOut) || 0),
        transferStatus: o.transferStatus,
        registerStatus: o.registerStatus || "",
        settlementStatus: o.settlementStatus || "",
      };
    }
    setEditingRows(rows);
    setEditMode(true);
  }, [orders]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setEditingRows({});
  }, []);

  const updateEditField = useCallback((id: number, key: string, value: string) => {
    setEditingRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }, []);

  const toggleTransferStatus = useCallback((id: number) => {
    setEditingRows((prev) => {
      const current = prev[id]?.transferStatus || "未转";
      return {
        ...prev,
        [id]: { ...prev[id], transferStatus: current === "已转" ? "未转" : "已转" },
      };
    });
  }, []);

  // 保存单行
  const saveRow = useCallback(async (id: number) => {
    const data = editingRows[id];
    if (!data) return;
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      await updateMutation.mutateAsync({
        id,
        orderDate: data.orderDate,
        orderNo: data.orderNo,
        groupName: data.groupName,
        originalPrice: Number(data.originalPrice) || 0,
        totalPrice: Number(data.totalPrice) || 0,
        actualTransferOut: Number(data.actualTransferOut) || 0,
        transferStatus: data.transferStatus as "已转" | "未转",
        registerStatus: data.registerStatus,
        settlementStatus: data.settlementStatus,
      });
      utils.orders.list.invalidate();
      utils.orders.stats.invalidate();
    } catch (error: any) {
      const msg = error?.message || "保存失败";
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("错误", msg);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [editingRows, updateMutation, utils]);

  // 保存所有修改
  const saveAll = useCallback(async () => {
    const ids = Object.keys(editingRows).map(Number);
    for (const id of ids) {
      await saveRow(id);
    }
    exitEditMode();
    if (Platform.OS === "web") alert("全部保存成功");
    else Alert.alert("成功", "全部保存成功");
  }, [editingRows, saveRow, exitEditMode]);

  const handleDelete = useCallback(async (id: number) => {
    const doDelete = async () => {
      try {
        await deleteMutation.mutateAsync({ id });
        utils.orders.list.invalidate();
        utils.orders.stats.invalidate();
      } catch (error: any) {
        const msg = error?.message || "删除失败";
        if (Platform.OS === "web") alert(msg);
        else Alert.alert("错误", msg);
      }
    };
    if (Platform.OS === "web") {
      if (confirm("确定要删除这条订单吗？")) await doDelete();
    } else {
      Alert.alert("确认删除", "确定要删除这条订单吗？", [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  }, [deleteMutation, utils]);

  if (authLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return <LoginPrompt message="登录后即可查看加价结算数据" />;
  }

  // 获取单元格值（编辑模式 or 只读模式）
  const getCellValue = (order: any, col: typeof COLUMNS[number]): string => {
    const editData = editMode ? editingRows[order.id] : null;

    if (col.key === "index") return `#${order.index}`;

    // 计算字段
    const source = editData || {
      originalPrice: order.originalPrice,
      totalPrice: order.totalPrice,
      actualTransferOut: order.actualTransferOut,
    };
    const calc = calcFields(source as any);

    switch (col.key) {
      case "origIncome": return `¥${formatNum(calc.origIncome)}`;
      case "markup": return `¥${formatNum(calc.markup)}`;
      case "markupIncome": return `¥${formatNum(calc.markupIncome)}`;
      case "markupActual": return `¥${formatNum(calc.markupActual)}`;
      case "actualIncome": return `¥${formatNum(calc.actualIncome)}`;
      default: break;
    }

    // 可编辑字段
    if (editData) {
      const val = editData[col.key as string];
      if ((col as any).isNumber && val !== undefined) return val;
      return val || "";
    }

    // 只读模式
    switch (col.key) {
      case "orderDate": return order.orderDate || "";
      case "orderNo": return order.orderNo || "";
      case "groupName": return order.groupName || "";
      case "originalPrice": return `¥${formatNum(Number(order.originalPrice))}`;
      case "totalPrice": return `¥${formatNum(Number(order.totalPrice))}`;
      case "actualTransferOut": return `¥${formatNum(Number(order.actualTransferOut))}`;
      case "transferStatus": return order.transferStatus;
      case "registerStatus": return order.registerStatus || "—";
      case "settlementStatus": return order.settlementStatus || "—";
      default: return "";
    }
  };

  const renderCell = (order: any, col: typeof COLUMNS[number], rowIdx: number) => {
    const isEditing = editMode && (col as any).editable;
    const editData = editingRows[order.id];

    // 转账状态特殊处理
    if (col.key === "transferStatus") {
      const status = editData?.transferStatus || order.transferStatus;
      const isTransferred = status === "已转";
      if (isEditing) {
        return (
          <TouchableOpacity
            key={col.key}
            onPress={() => toggleTransferStatus(order.id)}
            style={[styles.cell, { width: col.width, justifyContent: "center", alignItems: "center" }]}
          >
            <View style={[
              styles.statusBadge,
              { backgroundColor: isTransferred ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)" },
            ]}>
              <Text style={[
                styles.statusText,
                { color: isTransferred ? colors.success : colors.error },
              ]}>
                {status}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }
      return (
        <View key={col.key} style={[styles.cell, { width: col.width, justifyContent: "center", alignItems: "center" }]}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: isTransferred ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)" },
          ]}>
            <Text style={[
              styles.statusText,
              { color: isTransferred ? colors.success : colors.error },
            ]}>
              {status}
            </Text>
          </View>
        </View>
      );
    }

    // 可编辑字段 - 编辑模式
    if (isEditing && editData) {
      const val = editData[col.key as string] ?? "";
      return (
        <View key={col.key} style={[styles.cell, { width: col.width }]}>
          <TextInput
            style={[styles.cellInput, {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: colors.primary,
            }]}
            value={val}
            onChangeText={(v) => updateEditField(order.id, col.key as string, v)}
            keyboardType={(col as any).isNumber ? "decimal-pad" : "default"}
            returnKeyType="done"
            placeholder="—"
            placeholderTextColor={colors.muted}
          />
        </View>
      );
    }

    // 只读单元格
    const value = getCellValue(order, col);
    const isCalc = (col as any).isCalc;
    const isHighlight = (col as any).isHighlight;

    return (
      <View key={col.key} style={[styles.cell, { width: col.width }]}>
        <Text
          style={[
            styles.cellText,
            {
              color: isHighlight ? colors.primary : isCalc ? colors.foreground : colors.foreground,
              fontWeight: isHighlight ? "700" : isCalc ? "600" : "400",
            },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    );
  };

  const renderRow = ({ item, index: rowIdx }: { item: any; index: number }) => {
    const isEven = rowIdx % 2 === 0;
    const isSaving = savingIds.has(item.id);
    return (
      <View style={[
        styles.row,
        {
          backgroundColor: isEven ? colors.surface : colors.background,
          borderBottomColor: colors.border,
          minWidth: TOTAL_WIDTH + (editMode && isAdmin ? 100 : 0),
        },
      ]}>
        {COLUMNS.map((col) => renderCell(item, col, rowIdx))}
        {editMode && isAdmin && (
          <View style={[styles.cell, { width: 100, flexDirection: "row", gap: 4, justifyContent: "center" }]}>
            <TouchableOpacity
              onPress={() => saveRow(item.id)}
              disabled={isSaving}
              style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.5 : 1 }]}
            >
              <Text style={styles.actionBtnText}>{isSaving ? "..." : "保存"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={[styles.actionBtn, { backgroundColor: colors.error }]}
            >
              <Text style={styles.actionBtnText}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>数据查看</Text>
            {stats && (
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                共 {stats.total} 条 · 已转 {stats.transferred} · 未转 {stats.pending} · 总到手 ¥{formatNum(stats.totalIncome)}
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {isAdmin && (
              editMode ? (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={saveAll}
                    style={[styles.headerBtn, { backgroundColor: colors.success }]}
                  >
                    <Text style={styles.headerBtnText}>全部保存</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={exitEditMode}
                    style={[styles.headerBtn, { backgroundColor: colors.muted }]}
                  >
                    <Text style={styles.headerBtnText}>取消</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={enterEditMode}
                  style={[styles.headerBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.headerBtnText}>编辑模式</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* Filter + Search */}
        <View style={styles.filterRow}>
          <View style={styles.filterBtns}>
            {(["全部", "已转", "未转"] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: filter === f ? colors.primary : colors.surface,
                    borderColor: filter === f ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[
                  styles.filterBtnText,
                  { color: filter === f ? "#fff" : colors.muted },
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.searchInput, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.foreground,
            }]}
            placeholder="搜索群名..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Table */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={[
              styles.tableHeader,
              {
                backgroundColor: colors.primary,
                minWidth: TOTAL_WIDTH + (editMode && isAdmin ? 100 : 0),
              },
            ]}>
              {COLUMNS.map((col) => (
                <View key={col.key} style={[styles.headerCell, { width: col.width }]}>
                  <Text style={styles.headerCellText} numberOfLines={1}>{col.label}</Text>
                </View>
              ))}
              {editMode && isAdmin && (
                <View style={[styles.headerCell, { width: 100 }]}>
                  <Text style={styles.headerCellText}>操作</Text>
                </View>
              )}
            </View>

            {/* Table Body */}
            <FlatList
              data={orders || []}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRow}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>暂无订单数据</Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  filterBtns: {
    flexDirection: "row",
    gap: 6,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    minWidth: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tableScroll: {
    flex: 1,
  },
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255,255,255,0.3)",
  },
  headerCell: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCellText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    alignItems: "center",
  },
  cell: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cellInput: {
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    lineHeight: 18,
    minHeight: 30,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
