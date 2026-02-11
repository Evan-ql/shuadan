import { Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { useState } from "react";

export function LoginPrompt({ message }: { message?: string }) {
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async () => {
    setLoggingIn(true);
    try {
      await startOAuthLogin();
    } catch {
      setLoggingIn(false);
    }
  };

  return (
    <ScreenContainer className="flex-1 items-center justify-center p-6">
      <View className="items-center gap-4 w-full max-w-sm">
        <Text className="text-5xl mb-2">🔐</Text>
        <Text className="text-xl font-bold text-foreground text-center">
          请先登录
        </Text>
        <Text className="text-sm text-muted text-center leading-relaxed">
          {message || "登录后即可使用加价结算助手的全部功能"}
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-3.5 rounded-xl mt-4 w-full items-center active:opacity-80"
          onPress={handleLogin}
          disabled={loggingIn}
        >
          {loggingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-background font-semibold text-base">登录</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
