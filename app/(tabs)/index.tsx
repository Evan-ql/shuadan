import { useState, useCallback } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { LoginPrompt } from "@/components/login-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

function formatNum(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function EntryScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();

  const [orderDate, setOrderDate] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [groupName, setGroupName] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [actualTransferOut, setActualTransferOut] = useState("");
  const [transferStatus, setTransferStatus] = useState<"已转" | "未转">("未转");
  const [registerStatus, setRegisterStatus] = useState("");
  const [settlementStatus, setSettlementStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const createMutation = trpc.orders.create.useMutation();
  const utils = trpc.useUtils();

  // 自动计算
  const origPrice = parseFloat(originalPrice) || 0;
  const totPrice = parseFloat(totalPrice) || 0;
  const actTransOut = parseFloat(actualTransferOut) || 0;
  const markup = totPrice - origPrice;
  const origIncome = origPrice * 0.4;
  const markupIncome = markup * 0.4;
  const markupActual = markupIncome - actTransOut;
  const actualIncome = origIncome + markupActual;

  const resetForm = useCallback(() => {
    setOrderDate("");
    setOrderNo("");
    setGroupName("");
    setOriginalPrice("");
    setTotalPrice("");
    setActualTransferOut("");
    setTransferStatus("未转");
    setRegisterStatus("");
    setSettlementStatus("");
  }, []);

  const handleSubmit = async () => {
    if (!groupName.trim()) {
      alert("请输入群名");
      return;
    }
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        orderDate,
        orderNo,
        groupName: groupName.trim(),
        originalPrice: origPrice,
        totalPrice: totPrice,
        actualTransferOut: actTransOut,
        transferStatus,
        registerStatus,
        settlementStatus,
      });
      resetForm();
      utils.orders.list.invalidate();
      utils.orders.stats.invalidate();
      alert("录入成功！");
    } catch (error: any) {
      alert(error?.message || "录入失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

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
    return <LoginPrompt message="登录后即可录入加价结算订单" />;
  }

  const isAdmin = (user as any)?.role === "admin";

  if (!isAdmin) {
    return (
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🔒</Text>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>无编辑权限</Text>
          <Text style={[styles.lockDesc, { color: colors.muted }]}>
            您当前为查看权限，无法录入订单。请联系管理员升级权限。
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      {/* Page Header */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>录入订单</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>填写订单信息，系统自动计算相关金额</Text>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <View style={styles.formLayout}>
          {/* Left: Input Fields */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>订单信息</Text>

            <View style={styles.formGrid}>
              <FormField label="接单日期" value={orderDate} onChangeText={setOrderDate} placeholder="如：2026-02-08 19:12" colors={colors} />
              <FormField label="单号" value={orderNo} onChangeText={setOrderNo} placeholder="订单编号" colors={colors} />
              <FormField label="群名 *" value={groupName} onChangeText={setGroupName} placeholder="客户/群名称" colors={colors} />
              <FormField label="原价" value={originalPrice} onChangeText={setOriginalPrice} placeholder="0.00" colors={colors} />
              <FormField label="加价后总价" value={totalPrice} onChangeText={setTotalPrice} placeholder="0.00" colors={colors} />
              <FormField label="实际转出" value={actualTransferOut} onChangeText={setActualTransferOut} placeholder="0.00" colors={colors} />
            </View>

            {/* 转账状态 */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>转账状态</Text>
              <View style={styles.statusRow}>
                {(["未转", "已转"] as const).map((s) => {
                  const isActive = transferStatus === s;
                  const activeColor = s === "已转" ? colors.success : colors.error;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setTransferStatus(s)}
                      style={[
                        styles.statusBtn,
                        {
                          backgroundColor: isActive ? activeColor + "18" : colors.background,
                          borderColor: isActive ? activeColor : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBtnText, { color: isActive ? activeColor : colors.muted }]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGrid}>
              <FormField label="登记状态" value={registerStatus} onChangeText={setRegisterStatus} placeholder="可选" colors={colors} />
              <FormField label="结算状态" value={settlementStatus} onChangeText={setSettlementStatus} placeholder="可选" colors={colors} />
            </View>
          </View>

          {/* Right: Calculation + Submit */}
          <View style={styles.rightColumn}>
            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>自动计算</Text>
              <CalcRow label="加价" value={formatNum(markup)} sub="加价后总价 - 原价" colors={colors} />
              <CalcRow label="原价应到手" value={formatNum(origIncome)} sub="原价 × 40%" colors={colors} />
              <CalcRow label="加价应到手" value={formatNum(markupIncome)} sub="加价 × 40%" colors={colors} />
              <CalcRow label="加价实际到手" value={formatNum(markupActual)} sub="加价应到手 - 实际转出" colors={colors} />
              <View style={[styles.divider, { borderTopColor: colors.border }]}>
                <CalcRow label="实际到手" value={formatNum(actualIncome)} sub="原价应到手 + 加价实际到手" colors={colors} highlight />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>提交录入</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearBtn} onPress={resetForm}>
              <Text style={[styles.clearBtnText, { color: colors.muted }]}>清空表单</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function FormField({
  label, value, onChangeText, placeholder, colors,
}: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; colors: any;
}) {
  return (
    <View style={styles.fieldItem}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        style={[styles.input, {
          backgroundColor: colors.background,
          borderColor: colors.border,
          color: colors.foreground,
        }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

function CalcRow({
  label, value, sub, colors, highlight,
}: {
  label: string; value: string; sub: string; colors: any; highlight?: boolean;
}) {
  return (
    <View style={styles.calcRow}>
      <View style={styles.calcRowTop}>
        <Text style={[styles.calcLabel, highlight && styles.calcLabelHighlight, { color: highlight ? colors.foreground : colors.muted }]}>
          {label}
        </Text>
        <Text style={[styles.calcValue, highlight && styles.calcValueHighlight, { color: highlight ? colors.primary : colors.foreground }]}>
          ¥{value}
        </Text>
      </View>
      <Text style={[styles.calcSub, { color: colors.muted }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  lockDesc: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 300,
  },
  pageHeader: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  pageSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
  },
  formLayout: {
    flexDirection: "row",
    gap: 24,
    maxWidth: 1200,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  fieldItem: {
    width: 260,
    marginBottom: 4,
  },
  fieldGroup: {
    marginBottom: 16,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  statusRow: {
    flexDirection: "row",
    gap: 12,
  },
  statusBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
  rightColumn: {
    width: 320,
    gap: 16,
  },
  calcRow: {
    marginBottom: 14,
  },
  calcRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calcLabel: {
    fontSize: 13,
  },
  calcLabelHighlight: {
    fontWeight: "700",
    fontSize: 14,
  },
  calcValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  calcValueHighlight: {
    fontSize: 20,
    fontWeight: "700",
  },
  calcSub: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 4,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  clearBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
