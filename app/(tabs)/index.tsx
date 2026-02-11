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
  useWindowDimensions,
  KeyboardAvoidingView,
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

export default function EntryScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

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
      if (Platform.OS === "web") {
        alert("请输入群名");
      } else {
        Alert.alert("提示", "请输入群名");
      }
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
      if (Platform.OS === "web") {
        alert("录入成功！");
      } else {
        Alert.alert("成功", "订单已录入");
      }
    } catch (error: any) {
      const msg = error?.message || "录入失败，请重试";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("错误", msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return <LoginPrompt message="登录后即可录入加价结算订单" />;
  }

  const isAdmin = (user as any)?.role === "admin";

  if (!isAdmin) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <View className="items-center gap-3">
          <Text className="text-5xl">🔒</Text>
          <Text className="text-lg font-bold text-foreground">无编辑权限</Text>
          <Text className="text-sm text-muted text-center">
            您当前为查看权限，无法录入订单。{"\n"}请联系管理员升级权限。
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="px-5 pt-4 pb-3">
            <Text className="text-2xl font-bold text-foreground">录入订单</Text>
            <Text className="text-sm text-muted mt-1">填写订单信息，系统自动计算相关金额</Text>
          </View>

          <View className={cn("px-5", isWide && "flex-row gap-6")}>
            {/* 左侧：手动输入字段 */}
            <View className={cn("flex-1", isWide && "max-w-lg")}>
              <View className="bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-base font-semibold text-foreground mb-4">订单信息</Text>

                <InputField label="接单日期" value={orderDate} onChangeText={setOrderDate} placeholder="如：2026-02-08 19:12" />
                <InputField label="单号" value={orderNo} onChangeText={setOrderNo} placeholder="订单编号" />
                <InputField label="群名 *" value={groupName} onChangeText={setGroupName} placeholder="客户/群名称" />
                <InputField label="原价" value={originalPrice} onChangeText={setOriginalPrice} placeholder="0.00" keyboardType="decimal-pad" />
                <InputField label="加价后总价" value={totalPrice} onChangeText={setTotalPrice} placeholder="0.00" keyboardType="decimal-pad" />
                <InputField label="实际转出" value={actualTransferOut} onChangeText={setActualTransferOut} placeholder="0.00" keyboardType="decimal-pad" />

                {/* 转账状态 */}
                <View className="mb-3">
                  <Text className="text-sm text-muted mb-1.5">转账状态</Text>
                  <View className="flex-row gap-3">
                    {(["未转", "已转"] as const).map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setTransferStatus(s)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl items-center border",
                          transferStatus === s
                            ? s === "已转"
                              ? "bg-success/15 border-success"
                              : "bg-error/15 border-error"
                            : "bg-background border-border"
                        )}
                        style={
                          transferStatus === s
                            ? { opacity: 1 }
                            : { opacity: 0.6 }
                        }
                      >
                        <Text
                          className={cn(
                            "font-medium text-sm",
                            transferStatus === s
                              ? s === "已转"
                                ? "text-success"
                                : "text-error"
                              : "text-muted"
                          )}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <InputField label="登记状态" value={registerStatus} onChangeText={setRegisterStatus} placeholder="可选" />
                <InputField label="结算状态" value={settlementStatus} onChangeText={setSettlementStatus} placeholder="可选" />
              </View>
            </View>

            {/* 右侧：自动计算字段 */}
            <View className={cn(isWide ? "w-80" : "mt-4")}>
              <View className="bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-base font-semibold text-foreground mb-4">自动计算</Text>
                <CalcRow label="加价" value={formatNum(markup)} sub="加价后总价 - 原价" />
                <CalcRow label="原价应到手" value={formatNum(origIncome)} sub="原价 × 40%" />
                <CalcRow label="加价应到手" value={formatNum(markupIncome)} sub="加价 × 40%" />
                <CalcRow label="加价实际到手" value={formatNum(markupActual)} sub="加价应到手 - 实际转出" />
                <View className="border-t border-border pt-3 mt-1">
                  <CalcRow label="实际到手" value={formatNum(actualIncome)} sub="原价应到手 + 加价实际到手" highlight />
                </View>
              </View>

              {/* 提交按钮 */}
              <TouchableOpacity
                className="bg-primary py-4 rounded-xl mt-4 items-center active:opacity-80"
                onPress={handleSubmit}
                disabled={submitting}
                style={submitting ? { opacity: 0.6 } : undefined}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-background font-bold text-base">提交录入</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="py-3 rounded-xl mt-2 items-center active:opacity-60"
                onPress={resetForm}
              >
                <Text className="text-muted font-medium text-sm">清空表单</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "numeric";
}) {
  const colors = useColors();
  return (
    <View className="mb-3">
      <Text className="text-sm text-muted mb-1.5">{label}</Text>
      <TextInput
        className="bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        returnKeyType="done"
        style={{ lineHeight: 20 }}
      />
    </View>
  );
}

function CalcRow({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-center">
        <Text className={cn("text-sm", highlight ? "font-bold text-foreground" : "text-muted")}>
          {label}
        </Text>
        <Text
          className={cn(
            "font-bold",
            highlight ? "text-lg text-primary" : "text-base text-foreground"
          )}
        >
          ¥{value}
        </Text>
      </View>
      <Text className="text-xs text-muted mt-0.5">{sub}</Text>
    </View>
  );
}
