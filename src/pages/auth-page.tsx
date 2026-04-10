// Referenced from blueprint:javascript_auth_all_persistance integration
import React, { useState } from "react";
import { useAuth, apiRequest } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BookOpen, Brain, Users } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

interface UpdateItem {
  date: string;
  title: string;
  content: string;
}

export default function AuthPage() {
  const {
    user,
    loginMutation,
    registerMutation,
    continueAsGuestMutation
  } = useAuth();
  const [, setLocation] = useLocation();

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ username: "", password: "" });

  // Fetch updates
  const { data: updates } = useQuery<UpdateItem[]>({
    queryKey: ['updates'],
    queryFn: async () => {
      const res = await fetch('/updates.json');
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Redirect if already authenticated
  if (user) {
    window.location.href = "/";
    return null;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("handleLogin called. Login data:", loginData);
    try {
      await loginMutation.mutateAsync(loginData);
      const fetchedUserAfterLogin = await queryClient.fetchQuery({
        queryKey: ["/api/user"],
        queryFn: async () => {
          try {
            const res = await apiRequest("GET", "/api/user");
            return await res.json();
          } catch (error) {
            return null;
          }
        },
      });
      console.log("Login successful - fetched user after login:", fetchedUserAfterLogin);
      console.log("Login successful, redirecting to /");
      window.location.href = "/";
    } catch (error) {
      console.error("Login mutation failed in AuthPage:", error);
      // Error is handled by the mutation
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("handleRegister called. Register data:", registerData);
    try {
      await registerMutation.mutateAsync(registerData);
      const fetchedUserAfterRegister = await queryClient.fetchQuery({
        queryKey: ["/api/user"],
        queryFn: async () => {
          try {
            const res = await apiRequest("GET", "/api/user");
            return await res.json();
          } catch (error) {
            return null;
          }
        },
      });
      console.log("Registration successful - fetched user after register:", fetchedUserAfterRegister);
      console.log("Registration successful, redirecting to /");
      window.location.href = "/";
    } catch (error) {
      console.error("Register mutation failed in AuthPage:", error);
      // Error is handled by the mutation
    }
  };

  const handleGuestAccess = async () => {
    console.log("handleGuestAccess called.");
    try {
      await continueAsGuestMutation.mutateAsync();
      const fetchedUserAfterGuest = await queryClient.fetchQuery({
        queryKey: ["/api/user"],
        queryFn: async () => {
          try {
            const res = await apiRequest("GET", "/api/user");
            return await res.json();
          } catch (error) {
            return null;
          }
        },
      });
      console.log("Guest access successful - fetched user after guest:", fetchedUserAfterGuest);
      console.log("Guest access successful, redirecting to /");
      window.location.href = "/";
    } catch (error) {
      console.error("Guest access mutation failed in AuthPage:", error);
      // Error is handled by the mutation
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center relative z-10">

        {/* Left side - Authentication Forms */}
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-2xl">🥴</span>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
              よつましゃアプリブラウザ版 へようこそ
            </h1>
            <p className="text-gray-600 text-lg">
              単語クイズで楽しく学習しましょう ✨
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100/80 backdrop-blur-sm p-1 rounded-xl">
              <TabsTrigger value="login" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all duration-200">ログイン</TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all duration-200">新規登録</TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login" className="mt-6">
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-2xl font-bold text-gray-900">ログイン</CardTitle>
                  <CardDescription className="text-gray-600 text-base">
                    メールアドレスとパスワードでログインしてください
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-sm font-medium text-gray-700">メールアドレス</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="example@email.com"
                        value={loginData.username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                        className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">パスワード</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="パスワードを入力"
                        value={loginData.password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        required
                      />
                    </div>
                    {loginMutation.error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-sm text-red-700 flex items-center">
                          <span className="mr-2">⚠️</span>
                          {loginMutation.error.message}
                        </p>
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl text-white"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {loginMutation.isPending ? 'ログイン中...' : 'ログイン'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Form */}
            <TabsContent value="register" className="mt-6">
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-2xl font-bold text-gray-900">新規登録</CardTitle>
                  <CardDescription className="text-gray-600 text-base">
                    新しいアカウントを作成してください
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-sm font-medium text-gray-700">メールアドレス</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="example@email.com"
                        value={registerData.username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                        className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-sm font-medium text-gray-700">パスワード</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="8文字以上で入力"
                        value={registerData.password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        required
                        minLength={8}
                      />
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <span>🔒</span> パスワードは8文字以上で設定してください
                      </p>
                    </div>
                    {registerMutation.error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-sm text-red-700 flex items-center">
                          <span className="mr-2">⚠️</span>
                          {registerMutation.error.message}
                        </p>
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl text-white"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {registerMutation.isPending ? 'アカウント作成中...' : 'アカウント作成 ✨'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Guest Access Button */}
          <div className="mt-8">
            <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50/50 to-white/50 backdrop-blur-sm hover:border-gray-400 transition-all duration-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg flex items-center justify-center gap-2">
                      <span>🎮</span> 試してみる
                    </h3>
                    <p className="text-gray-600 text-base">
                      ログインせずにアプリを体験できます
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleGuestAccess}
                    className="w-full h-12 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                    disabled={continueAsGuestMutation.isPending}
                  >
                    {continueAsGuestMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {continueAsGuestMutation.isPending ? 'アクセス中...' : 'ログインせずに続ける'}
                  </Button>
                  {continueAsGuestMutation.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-in slide-in-from-top-2 duration-300">
                      <p className="text-sm text-red-700 flex items-center">
                        <span className="mr-2">⚠️</span>
                        {continueAsGuestMutation.error.message}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right side - App Description */}
        <div className="lg:pl-8">
          <div className="text-center space-y-8">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-6 leading-tight">
                効率的な単語学習
              </h2>
              <p className="text-base text-gray-600 leading-relaxed">
                よつましゃアプリで語彙力を向上させましょう 🚀
              </p>
            </div>

            {/* Updates Section */}
            {updates && updates.length > 0 && (
              <Card className="bg-white/50 border-blue-100 shadow-sm text-left">
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">📢</span>
                    <CardTitle className="text-md font-bold text-gray-800">最新情報</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                    {updates.map((update, idx) => (
                      <div key={idx} className="border-l-2 border-blue-400 pl-3 pb-1">
                        <p className="text-xs text-blue-600 font-semibold mb-1">{update.date}</p>
                        <h4 className="text-sm font-bold text-gray-800 mb-1">{update.title}</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">{update.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-8">
              <div className="flex items-start space-x-5 group">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">カスタム単語リスト</h3>
                  <p className="text-gray-600 text-base leading-relaxed">
                    自分だけの単語リストを作成して、効率的に学習できます 📚
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-5 group">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">スマート復習</h3>
                  <p className="text-gray-600 text-base leading-relaxed">
                    間違えた単語を自動で復習リストに追加し、記憶定着をサポート 🧠
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-5 group">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">個人データ管理</h3>
                  <p className="text-gray-600 text-base leading-relaxed">
                    ユーザーごとに学習データを安全に管理・同期 🔒
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}