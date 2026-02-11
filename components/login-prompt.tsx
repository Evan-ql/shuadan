import { Text, View, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { startOAuthLogin } from "@/constants/oauth";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";

export function LoginPrompt({ message }: { message?: string }) {
  const [loggingIn, setLoggingIn] = useState(false);
  const colors = useColors();

  const handleLogin = async () => {
    setLoggingIn(true);
    try {
      await startOAuthLogin();
    } catch {
      setLoggingIn(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>请先登录</Text>
        <Text style={[styles.desc, { color: colors.muted }]}>
          {message || "登录后即可使用加价结算助手的全部功能"}
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, opacity: loggingIn ? 0.6 : 1 }]}
          onPress={handleLogin}
          disabled={loggingIn}
        >
          {loggingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>登录</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  desc: { fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  btn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
