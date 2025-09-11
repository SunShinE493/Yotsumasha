// Referenced from blueprint:javascript_auth_all_persistance integration
import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BookOpen, Brain, Users } from "lucide-react";

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

  // Redirect if already authenticated
  if (user) {
    setLocation("/");
    return null;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync(loginData);
      setLocation("/");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await registerMutation.mutateAsync(registerData);
      setLocation("/");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleGuestAccess = async () => {
    try {
      await continueAsGuestMutation.mutateAsync();
      setLocation("/");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        
        {/* Left side - Authentication Forms */}
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              MiniPotato Bot へようこそ
            </h1>
            <p className="text-gray-600">
              単語クイズで楽しく学習しましょう
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">ログイン</TabsTrigger>
              <TabsTrigger value="register">新規登録</TabsTrigger>
            </TabsList>
            
            {/* Login Form */}
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>ログイン</CardTitle>
                  <CardDescription>
                    メールアドレスとパスワードでログインしてください
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">メールアドレス</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="example@email.com"
                        value={loginData.username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">パスワード</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="パスワードを入力"
                        value={loginData.password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        required
                      />
                    </div>
                    {loginMutation.error && (
                      <p className="text-sm text-red-600">
                        {loginMutation.error.message}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      ログイン
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Form */}
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>新規登録</CardTitle>
                  <CardDescription>
                    新しいアカウントを作成してください
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email">メールアドレス</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="example@email.com"
                        value={registerData.username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">パスワード</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="8文字以上で入力"
                        value={registerData.password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={8}
                      />
                      <p className="text-xs text-gray-500">
                        パスワードは8文字以上で設定してください
                      </p>
                    </div>
                    {registerMutation.error && (
                      <p className="text-sm text-red-600">
                        {registerMutation.error.message}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      アカウント作成
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Guest Access Button */}
          <div className="mt-6">
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">試してみる</h3>
                    <p className="text-sm text-gray-600">
                      ログインせずにアプリを体験できます
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleGuestAccess}
                    className="w-full"
                    disabled={continueAsGuestMutation.isPending}
                  >
                    {continueAsGuestMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    ログインせずに続ける
                  </Button>
                  {continueAsGuestMutation.error && (
                    <p className="text-sm text-red-600">
                      {continueAsGuestMutation.error.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right side - App Description */}
        <div className="lg:pl-8">
          <div className="text-center lg:text-left space-y-6">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                効率的な単語学習
              </h2>
              <p className="text-xl text-gray-600">
                MiniPotato Botで楽しく語彙力を向上させましょう
              </p>
            </div>

            <div className="grid gap-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">カスタム単語リスト</h3>
                  <p className="text-gray-600">
                    自分だけの単語リストを作成して、効率的に学習できます
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">スマート復習</h3>
                  <p className="text-gray-600">
                    間違えた単語を自動で復習リストに追加し、記憶定着をサポート
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">個人データ管理</h3>
                  <p className="text-gray-600">
                    ユーザーごとに学習データを安全に管理・同期
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