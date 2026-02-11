import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { usePathname, useRouter } from "expo-router";

const NAV_ITEMS = [
  { name: "index", label: "录入", icon: "+" },
  { name: "orders", label: "数据查看", icon: "☰" },
  { name: "admin", label: "后台管理", icon: "⚙" },
] as const;

export default function TabLayout() {
  const colors = useColors();
  const pathname = usePathname();
  const router = useRouter();

  const getActiveRoute = () => {
    if (pathname.includes("/orders")) return "orders";
    if (pathname.includes("/admin")) return "admin";
    return "index";
  };

  const activeRoute = getActiveRoute();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sidebar */}
      <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={[styles.logoText, { color: colors.primary }]}>加价结算</Text>
          <Text style={[styles.logoSubtext, { color: colors.muted }]}>管理系统</Text>
        </View>

        {/* Nav Items */}
        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.name;
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => {
                  if (item.name === "index") router.push("/");
                  else router.push(`/${item.name}` as any);
                }}
                style={[
                  styles.navItem,
                  isActive && { backgroundColor: colors.primary + "15" },
                ]}
              >
                <Text style={[
                  styles.navIcon,
                  { color: isActive ? colors.primary : colors.muted },
                ]}>
                  {item.icon}
                </Text>
                <Text style={[
                  styles.navLabel,
                  {
                    color: isActive ? colors.primary : colors.foreground,
                    fontWeight: isActive ? "600" : "400",
                  },
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="orders" />
          <Tabs.Screen name="admin" />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 220,
    borderRightWidth: 1,
    paddingTop: 24,
  },
  logoContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
    marginBottom: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
  },
  logoSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  navList: {
    paddingHorizontal: 12,
    gap: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 10,
  },
  navIcon: {
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },
  navLabel: {
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
  },
});
