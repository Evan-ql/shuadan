import { useState, useCallback, useMemo } from "react";
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
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { LoginPrompt } from "@/components/login-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatNum(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function calcFields(o: { originalPrice: string; totalPrice: string; actualTransferOut: string }) {
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

export default function OrdersScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 768;

  const [filter, setFilter] = useState<FilterType>("全部");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});

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

  const handleDelete = useCallback(async (id: number) => {
    const doDelete = async () => {
      try {
        await deleteMutation.mutateAsync({ id });
        setSelectedOrder(null);
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

  const handleSaveEdit = useCallback(async () => {
    if (!selectedOrder) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedOrder.id,
        ...editData,
        originalPrice: Number(editData.originalPrice) || 0,
        totalPrice: Number(editData.totalPrice) || 0,
        actualTransferOut: Number(editData.actualTransferOut) || 0,
      });
      setEditMode(false);
      setSelectedOrder(null);
      utils.orders.list.invalidate();
      utils.orders.stats.invalidate();
      if (Platform.OS === "web") alert("保存成功");
      else Alert.alert("成功", "订单已更新");
    } catch (error: any) {
      const msg = error?.message || "保存失败";
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("错误", msg);
    }
  }, [selectedOrder, editData, updateMutation, utils]);

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

  const renderOrderItem = ({ item }: { item: any }) => {
    const calc = calcFields(item);
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedOrder(item);
          setEditMode(false);
          setEditData({
            orderDate: item.orderDate || "",
            orderNo: item.orderNo || "",
            groupName: item.groupName,
            originalPrice: String(Number(item.originalPrice) || 0),
            totalPrice: String(Number(item.totalPrice) || 0),
            actualTransferOut: String(Number(item.actualTransferOut) || 0),
            transferStatus: item.transferStatus,
            registerStatus: item.registerStatus || "",
            settlementStatus: item.settlementStatus || "",
          });
        }}
        className="bg-surface rounded-xl p-4 mb-3 border border-border active:opacity-70"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-3">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              #{item.index} {item.groupName}
            </Text>
            {item.orderDate ? (
              <Text className="text-xs text-muted mt-0.5">{item.orderDate}</Text>
            ) : null}
          </View>
          <View
            className={cn(
              "px-2.5 py-1 rounded-full",
              item.transferStatus === "已转" ? "bg-success/15" : "bg-error/15"
            )}
          >
            <Text
              className={cn(
                "text-xs font-medium",
                item.transferStatus === "已转" ? "text-success" : "text-error"
              )}
            >
              {item.transferStatus}
            </Text>
          </View>
        </View>
        <View className={cn("flex-row flex-wrap gap-x-4 gap-y-1", isWide && "gap-x-6")}>
          <MiniStat label="原价" value={`¥${formatNum(Number(item.originalPrice))}`} />
          <MiniStat label="加价后总价" value={`¥${formatNum(Number(item.totalPrice))}`} />
          <MiniStat label="加价" value={`¥${formatNum(calc.markup)}`} />
          <MiniStat label="实际到手" value={`¥${formatNum(calc.actualIncome)}`} highlight />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">数据查看</Text>
      </View>

      {/* Stats bar */}
      {stats && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5 mb-3">
          <View className="flex-row gap-3">
            <StatCard label="总订单" value={String(stats.total)} color={colors.primary} />
            <StatCard label="已转" value={String(stats.transferred)} color={colors.success} />
            <StatCard label="未转" value={String(stats.pending)} color={colors.error} />
            <StatCard label="总实际到手" value={`¥${formatNum(stats.totalIncome)}`} color={colors.primary} />
          </View>
        </ScrollView>
      )}

      {/* Filter + Search */}
      <View className={cn("px-5 mb-3", isWide && "flex-row gap-4 items-center")}>
        <View className="flex-row gap-2 mb-2">
          {(["全部", "已转", "未转"] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-full border",
                filter === f ? "bg-primary border-primary" : "bg-surface border-border"
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  filter === f ? "text-background" : "text-muted"
                )}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View className={cn("flex-1", !isWide && "mb-0")}>
          <TextInput
            className="bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm"
            placeholder="搜索群名..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            style={{ lineHeight: 20 }}
          />
        </View>
      </View>

      {/* Order list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-muted text-base">暂无订单数据</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setSelectedOrder(null); setEditMode(false); }}
      >
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {/* Modal header */}
            <View className="flex-row justify-between items-center px-5 py-3 border-b border-border">
              <TouchableOpacity onPress={() => { setSelectedOrder(null); setEditMode(false); }}>
                <Text className="text-primary text-base">关闭</Text>
              </TouchableOpacity>
              <Text className="text-base font-semibold text-foreground">
                {editMode ? "编辑订单" : "订单详情"}
              </Text>
              {isAdmin ? (
                editMode ? (
                  <TouchableOpacity onPress={handleSaveEdit}>
                    <Text className="text-primary text-base font-semibold">保存</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode(true)}>
                    <Text className="text-primary text-base">编辑</Text>
                  </TouchableOpacity>
                )
              ) : (
                <View style={{ width: 40 }} />
              )}
            </View>

            <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
              {selectedOrder && !editMode && (
                <OrderDetailView order={selectedOrder} isAdmin={isAdmin} onDelete={handleDelete} />
              )}
              {selectedOrder && editMode && (
                <OrderEditForm data={editData} onChange={setEditData} />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View>
      <Text className="text-xs text-muted">{label}</Text>
      <Text className={cn("text-sm font-semibold", highlight ? "text-primary" : "text-foreground")}>
        {value}
      </Text>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="bg-surface rounded-xl px-4 py-3 border border-border min-w-[100px]">
      <Text className="text-xs text-muted mb-1">{label}</Text>
      <Text className="text-base font-bold" style={{ color }}>{value}</Text>
    </View>
  );
}

function OrderDetailView({ order, isAdmin, onDelete }: { order: any; isAdmin: boolean; onDelete: (id: number) => void }) {
  const calc = calcFields(order);
  return (
    <View className="gap-4">
      <View className="bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-base font-semibold text-foreground mb-3">基本信息</Text>
        <DetailRow label="序号" value={`#${order.index}`} />
        <DetailRow label="接单日期" value={order.orderDate || "—"} />
        <DetailRow label="单号" value={order.orderNo || "—"} />
        <DetailRow label="群名" value={order.groupName} />
        <DetailRow label="转账状态" value={order.transferStatus} isTag tagType={order.transferStatus} />
        <DetailRow label="登记状态" value={order.registerStatus || "—"} />
        <DetailRow label="结算状态" value={order.settlementStatus || "—"} />
      </View>

      <View className="bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-base font-semibold text-foreground mb-3">金额明细</Text>
        <DetailRow label="原价" value={`¥${formatNum(Number(order.originalPrice))}`} />
        <DetailRow label="加价后总价" value={`¥${formatNum(Number(order.totalPrice))}`} />
        <DetailRow label="加价" value={`¥${formatNum(calc.markup)}`} />
        <DetailRow label="原价应到手" value={`¥${formatNum(calc.origIncome)}`} />
        <DetailRow label="加价应到手" value={`¥${formatNum(calc.markupIncome)}`} />
        <DetailRow label="实际转出" value={`¥${formatNum(Number(order.actualTransferOut))}`} />
        <DetailRow label="加价实际到手" value={`¥${formatNum(calc.markupActual)}`} />
        <View className="border-t border-border pt-2 mt-1">
          <DetailRow label="实际到手" value={`¥${formatNum(calc.actualIncome)}`} highlight />
        </View>
      </View>

      {isAdmin && (
        <TouchableOpacity
          className="bg-error/10 border border-error/30 py-3.5 rounded-xl items-center mt-2 active:opacity-70"
          onPress={() => onDelete(order.id)}
        >
          <Text className="text-error font-semibold">删除订单</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DetailRow({ label, value, highlight, isTag, tagType }: {
  label: string;
  value: string;
  highlight?: boolean;
  isTag?: boolean;
  tagType?: string;
}) {
  return (
    <View className="flex-row justify-between items-center py-1.5">
      <Text className="text-sm text-muted">{label}</Text>
      {isTag ? (
        <View className={cn("px-2.5 py-0.5 rounded-full", tagType === "已转" ? "bg-success/15" : "bg-error/15")}>
          <Text className={cn("text-sm font-medium", tagType === "已转" ? "text-success" : "text-error")}>
            {value}
          </Text>
        </View>
      ) : (
        <Text className={cn("text-sm font-semibold", highlight ? "text-primary text-base" : "text-foreground")}>
          {value}
        </Text>
      )}
    </View>
  );
}

function OrderEditForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const colors = useColors();
  const update = (key: string, val: string) => onChange({ ...data, [key]: val });

  const origPrice = parseFloat(data.originalPrice) || 0;
  const totPrice = parseFloat(data.totalPrice) || 0;
  const actTransOut = parseFloat(data.actualTransferOut) || 0;
  const markup = totPrice - origPrice;
  const origIncome = origPrice * 0.4;
  const markupIncome = markup * 0.4;
  const markupActual = markupIncome - actTransOut;
  const actualIncome = origIncome + markupActual;

  return (
    <View className="gap-4">
      <View className="bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-base font-semibold text-foreground mb-3">编辑信息</Text>
        <EditField label="接单日期" value={data.orderDate} onChangeText={(v: string) => update("orderDate", v)} colors={colors} />
        <EditField label="单号" value={data.orderNo} onChangeText={(v: string) => update("orderNo", v)} colors={colors} />
        <EditField label="群名" value={data.groupName} onChangeText={(v: string) => update("groupName", v)} colors={colors} />
        <EditField label="原价" value={data.originalPrice} onChangeText={(v: string) => update("originalPrice", v)} keyboardType="decimal-pad" colors={colors} />
        <EditField label="加价后总价" value={data.totalPrice} onChangeText={(v: string) => update("totalPrice", v)} keyboardType="decimal-pad" colors={colors} />
        <EditField label="实际转出" value={data.actualTransferOut} onChangeText={(v: string) => update("actualTransferOut", v)} keyboardType="decimal-pad" colors={colors} />

        <View className="mb-3">
          <Text className="text-sm text-muted mb-1.5">转账状态</Text>
          <View className="flex-row gap-3">
            {(["未转", "已转"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => onChange({ ...data, transferStatus: s })}
                className={cn(
                  "flex-1 py-2.5 rounded-xl items-center border",
                  data.transferStatus === s
                    ? s === "已转" ? "bg-success/15 border-success" : "bg-error/15 border-error"
                    : "bg-background border-border"
                )}
                style={data.transferStatus === s ? { opacity: 1 } : { opacity: 0.6 }}
              >
                <Text className={cn("font-medium text-sm", data.transferStatus === s ? (s === "已转" ? "text-success" : "text-error") : "text-muted")}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <EditField label="登记状态" value={data.registerStatus} onChangeText={(v: string) => update("registerStatus", v)} colors={colors} />
        <EditField label="结算状态" value={data.settlementStatus} onChangeText={(v: string) => update("settlementStatus", v)} colors={colors} />
      </View>

      <View className="bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-base font-semibold text-foreground mb-3">自动计算</Text>
        <DetailRow label="加价" value={`¥${formatNum(markup)}`} />
        <DetailRow label="原价应到手" value={`¥${formatNum(origIncome)}`} />
        <DetailRow label="加价应到手" value={`¥${formatNum(markupIncome)}`} />
        <DetailRow label="加价实际到手" value={`¥${formatNum(markupActual)}`} />
        <View className="border-t border-border pt-2 mt-1">
          <DetailRow label="实际到手" value={`¥${formatNum(actualIncome)}`} highlight />
        </View>
      </View>
    </View>
  );
}

function EditField({ label, value, onChangeText, keyboardType, colors }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "decimal-pad";
  colors: any;
}) {
  return (
    <View className="mb-3">
      <Text className="text-sm text-muted mb-1.5">{label}</Text>
      <TextInput
        className="bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={{ lineHeight: 20 }}
      />
    </View>
  );
}
