import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { LoginPrompt } from "@/components/login-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function AdminScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const isAdmin = (user as any)?.role === "admin";

  const { data: users, isLoading, refetch, isRefetching } = trpc.users.list.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });
  const { data: stats } = trpc.orders.stats.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });
  const updateRoleMutation = trpc.users.updateRole.useMutation();
  const utils = trpc.useUtils();

  const handleToggleRole = useCallback(async (userId: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const roleLabel = newRole === "admin" ? "编辑权限" : "查看权限";

    const doUpdate = async () => {
      try {
        await updateRoleMutation.mutateAsync({ userId, role: newRole });
        utils.users.list.invalidate();
        if (Platform.OS === "web") alert(`已切换为${roleLabel}`);
        else Alert.alert("成功", `已切换为${roleLabel}`);
      } catch (error: any) {
        const msg = error?.message || "操作失败";
        if (Platform.OS === "web") alert(msg);
        else Alert.alert("错误", msg);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`确定将该用户切换为「${roleLabel}」吗？`)) await doUpdate();
    } else {
      Alert.alert("确认", `确定将该用户切换为「${roleLabel}」吗？`, [
        { text: "取消", style: "cancel" },
        { text: "确定", onPress: doUpdate },
      ]);
    }
  }, [updateRoleMutation, utils]);

  if (authLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return <LoginPrompt message="登录后即可访问后台管理" />;
  }

  if (!isAdmin) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <View className="items-center gap-3">
          <Text className="text-5xl">🔒</Text>
          <Text className="text-lg font-bold text-foreground">无管理权限</Text>
          <Text className="text-sm text-muted text-center">
            仅管理员可访问后台管理功能。{"\n"}请联系管理员获取权限。
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const renderUserItem = ({ item }: { item: any }) => {
    const isCurrentUser = item.id === (user as any)?.id;
    const roleLabel = item.role === "admin" ? "编辑权限" : "查看权限";
    return (
      <View className={cn("bg-surface rounded-xl p-4 mb-3 border border-border", isWide && "flex-row items-center justify-between")}>
        <View className={cn("flex-1", isWide && "flex-row items-center gap-4")}>
          <View className="flex-row items-center gap-3 mb-2" style={isWide ? { marginBottom: 0 } : undefined}>
            <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center">
              <Text className="text-primary font-bold text-base">
                {(item.name || item.email || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text className="text-base font-semibold text-foreground">
                {item.name || "未命名用户"}
                {isCurrentUser && <Text className="text-xs text-muted"> (我)</Text>}
              </Text>
              <Text className="text-xs text-muted">{item.email || "无邮箱"}</Text>
            </View>
          </View>
        </View>

        <View className={cn("flex-row items-center gap-3", !isWide && "mt-2 justify-between")}>
          <View className={cn("px-3 py-1 rounded-full", item.role === "admin" ? "bg-primary/15" : "bg-muted/15")}>
            <Text className={cn("text-xs font-medium", item.role === "admin" ? "text-primary" : "text-muted")}>
              {roleLabel}
            </Text>
          </View>
          {!isCurrentUser && (
            <TouchableOpacity
              onPress={() => handleToggleRole(item.id, item.role)}
              className="bg-background border border-border px-3 py-1.5 rounded-lg active:opacity-70"
            >
              <Text className="text-sm text-foreground">
                切换为{item.role === "admin" ? "查看" : "编辑"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">后台管理</Text>
        <Text className="text-sm text-muted mt-1">管理用户权限和系统设置</Text>
      </View>

      {/* Stats Overview */}
      {stats && (
        <View className={cn("px-5 mb-4", isWide && "flex-row gap-4")}>
          <View className="bg-surface rounded-2xl p-4 border border-border flex-1 mb-3" style={isWide ? { marginBottom: 0 } : undefined}>
            <Text className="text-sm text-muted mb-1">系统概览</Text>
            <View className="flex-row gap-6 mt-2">
              <View>
                <Text className="text-2xl font-bold text-foreground">{stats.total}</Text>
                <Text className="text-xs text-muted">总订单</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-success">{stats.transferred}</Text>
                <Text className="text-xs text-muted">已转</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-error">{stats.pending}</Text>
                <Text className="text-xs text-muted">未转</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-primary">¥{(stats.totalIncome || 0).toFixed(0)}</Text>
                <Text className="text-xs text-muted">总到手</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Users section */}
      <View className="px-5 mb-3">
        <View className="flex-row justify-between items-center">
          <Text className="text-lg font-semibold text-foreground">用户管理</Text>
          <Text className="text-sm text-muted">{users?.length || 0} 位用户</Text>
        </View>
        <Text className="text-xs text-muted mt-1">
          编辑权限 = 可录入/编辑/删除订单 · 查看权限 = 仅可查看数据
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderUserItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-muted text-base">暂无用户</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
