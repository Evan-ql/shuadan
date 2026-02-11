import { useState, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LoginPrompt } from "@/components/login-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function AdminScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();

  const isAdmin = (user as any)?.role === "admin";

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery(undefined, {
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
    if (!confirm(`确定将该用户切换为「${roleLabel}」吗？`)) return;
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
      utils.users.list.invalidate();
      alert(`已切换为${roleLabel}`);
    } catch (error: any) {
      alert(error?.message || "操作失败");
    }
  }, [updateRoleMutation, utils]);

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
    return <LoginPrompt message="登录后即可访问后台管理" />;
  }

  if (!isAdmin) {
    return (
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🔒</Text>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>无管理权限</Text>
          <Text style={[styles.lockDesc, { color: colors.muted }]}>
            仅管理员可访问后台管理功能。请联系管理员获取权限。
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>后台管理</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>管理用户权限和系统设置</Text>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Stats Overview */}
        {stats && (
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>系统概览</Text>
            <View style={styles.statsGrid}>
              <StatItem label="总订单" value={String(stats.total)} color={colors.foreground} colors={colors} />
              <StatItem label="已转" value={String(stats.transferred)} color={colors.success} colors={colors} />
              <StatItem label="未转" value={String(stats.pending)} color={colors.error} colors={colors} />
              <StatItem label="总到手" value={`¥${(stats.totalIncome || 0).toFixed(2)}`} color={colors.primary} colors={colors} />
            </View>
          </View>
        )}

        {/* Users Table */}
        <View style={[styles.usersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.usersHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>用户管理</Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                编辑权限 = 可录入/编辑/删除订单 · 查看权限 = 仅可查看数据
              </Text>
            </View>
            <Text style={[styles.userCount, { color: colors.muted }]}>{users?.length || 0} 位用户</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View>
              {/* Table Header */}
              <View style={[styles.userTableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.userColHeader, { color: colors.muted, width: 240 }]}>用户</Text>
                <Text style={[styles.userColHeader, { color: colors.muted, width: 200 }]}>邮箱</Text>
                <Text style={[styles.userColHeader, { color: colors.muted, width: 120 }]}>权限</Text>
                <Text style={[styles.userColHeader, { color: colors.muted, width: 160 }]}>操作</Text>
              </View>

              {/* Table Body */}
              {(users || []).map((u, idx) => {
                const isCurrentUser = u.id === (user as any)?.id;
                const roleLabel = u.role === "admin" ? "编辑权限" : "查看权限";
                return (
                  <View
                    key={u.id}
                    style={[
                      styles.userRow,
                      {
                        backgroundColor: idx % 2 === 0 ? "transparent" : colors.background + "80",
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    {/* User info */}
                    <View style={[styles.userCell, { width: 240 }]}>
                      <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>
                          {(u.name || u.email || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.userName, { color: colors.foreground }]}>
                          {u.name || "未命名用户"}
                          {isCurrentUser && " (我)"}
                        </Text>
                      </View>
                    </View>

                    {/* Email */}
                    <View style={[styles.userCellSimple, { width: 200 }]}>
                      <Text style={[styles.userEmail, { color: colors.muted }]} numberOfLines={1}>
                        {u.email || "无邮箱"}
                      </Text>
                    </View>

                    {/* Role */}
                    <View style={[styles.userCellSimple, { width: 120 }]}>
                      <View style={[
                        styles.roleBadge,
                        {
                          backgroundColor: u.role === "admin" ? colors.primary + "18" : colors.muted + "18",
                        },
                      ]}>
                        <Text style={[
                          styles.roleBadgeText,
                          { color: u.role === "admin" ? colors.primary : colors.muted },
                        ]}>
                          {roleLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Action */}
                    <View style={[styles.userCellSimple, { width: 160 }]}>
                      {!isCurrentUser ? (
                        <TouchableOpacity
                          onPress={() => handleToggleRole(u.id, u.role)}
                          style={[styles.toggleBtn, { borderColor: colors.border }]}
                        >
                          <Text style={[styles.toggleBtnText, { color: colors.foreground }]}>
                            切换为{u.role === "admin" ? "查看" : "编辑"}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.currentUserText, { color: colors.muted }]}>当前用户</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value, color, colors }: { label: string; value: string; color: string; colors: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  lockTitle: { fontSize: 18, fontWeight: "700" },
  lockDesc: { fontSize: 14, textAlign: "center", maxWidth: 300 },
  pageHeader: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  pageTitle: { fontSize: 24, fontWeight: "700" },
  pageSubtitle: { fontSize: 14, marginTop: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 32, gap: 24 },
  statsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 16 },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  statsGrid: {
    flexDirection: "row",
    gap: 40,
  },
  statItem: {},
  statValue: { fontSize: 28, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 4 },
  usersCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
  },
  usersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  userCount: { fontSize: 13 },
  loadingArea: { paddingVertical: 40, alignItems: "center" },
  userTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  userColHeader: { fontSize: 12, fontWeight: "700" },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  userCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userCellSimple: {
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700" },
  userName: { fontSize: 14, fontWeight: "600" },
  userEmail: { fontSize: 13 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  toggleBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  toggleBtnText: { fontSize: 13, fontWeight: "500" },
  currentUserText: { fontSize: 13 },
});
