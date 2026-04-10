import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { StudyConfig, StudySession } from "@shared/schema";
import { SelectedJsonInfo } from "./file-upload";
import { Check } from "lucide-react";

interface RangeSelectorProps {
  selectedJson: SelectedJsonInfo | null;
  onStartSession: (session: StudySession) => void;
  isStarting: boolean;
  userId: string | null; // 👈 ユーザーIDを追加
}

export function RangeSelector({ selectedJson, onStartSession, isStarting, userId }: RangeSelectorProps) {
  const totalWords = selectedJson?.wordCount || 0;
  const [endRange, setEndRange] = useState<number | string>(Math.min(50, totalWords));
  const [startRange, setStartRange] = useState<number | string>(1);
  const [questionCount, setQuestionCount] = useState<number>(-1);
  const [order, setOrder] = useState<"sequential" | "random" | "difficulty">("random");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedDifficulties, setSelectedDifficulties] = useState<(number | string)[]>([]);
  const [langMode, setLangMode] = useState<"en-jp" | "jp-en">("en-jp");
  const { toast } = useToast();

  useEffect(() => {
    if (selectedJson && selectedJson.wordCount > 0) {
      setStartRange(1);
      setEndRange(Math.min(50, selectedJson.wordCount));
      setQuestionCount(-1);
    }
  }, [selectedJson]);

  const createSessionMutation = useMutation({
    mutationFn: async (config: StudyConfig) => {
      // ユーザーIDがない場合はエラーを投げる
      if (!userId) {
        throw new Error("ユーザーIDが利用できません。");
      }
      const response = await apiRequest("POST", "/api/study/session", config, userId);
      return response.json();
    },
    onSuccess: (session) => {
      onStartSession(session);
    },
    onError: (error: any) => {
      toast({
        title: "セッション作成エラー",
        description: error?.message || "セッションの作成に失敗しました。",
        variant: "destructive",
      });
    }
  });

  const handleStartStudy = () => {
    if (!selectedJson) {
      toast({
        title: "データなし",
        description: "学習を開始するJSONファイルを選択してください",
        variant: "destructive",
      });
      return;
    }

    if (startRange > endRange) {
      toast({
        title: "範囲エラー",
        description: "開始番号は終了番号以下である必要があります",
        variant: "destructive",
      });
      return;
    }

    const config: StudyConfig = {
      startRange: Number(startRange),
      endRange: Number(endRange),
      questionCount: questionCount === -1 ? Number(endRange) - Number(startRange) + 1 : questionCount,
      order,
      reviewOnly,
      // 内蔵ファイルかつプリセットが設定されている場合のみ sourceFile を渡す（外部アップロードはメモリの語彙を使用）
      ...(selectedJson?.isBuiltin && selectedJson.presets && selectedJson.presets.length > 0
        ? { sourceFile: selectedJson.name }
        : {}),
      selectedDifficulties: selectedDifficulties.length > 0 ? selectedDifficulties : undefined,
      langMode,
    };

    createSessionMutation.mutate(config);
  };

  const setPresetRange = (start: number, end: number) => {
    setStartRange(start);
    setEndRange(Math.min(end, totalWords));
  };

  const isPresetActive = (preset: { start: number; end: number }) => {
    return startRange === preset.start && endRange === preset.end;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <i className="fas fa-cogs text-primary text-xl"></i>
            <CardTitle>範囲設定</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="review-mode" className="text-sm text-muted-foreground">
              復習のみ
            </Label>
            <Switch
              id="review-mode"
              checked={reviewOnly}
              onCheckedChange={setReviewOnly}
              data-testid="switch-review-mode"
            />
          </div>
        </div>
        <CardDescription>
          単語の範囲や出題順序をカスタマイズして学習を開始できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="start-range" className="text-sm font-medium text-foreground mb-1">
                開始番号
              </Label>
              <Input
                id="start-range"
                type="number"
                max={totalWords}
                value={startRange}
                onChange={(e) => {
                  const value = e.target.value;
                  setStartRange(value === "" ? "" : parseInt(value));
                }}
                data-testid="input-start-range"
              />
            </div>
            <div>
              <Label htmlFor="end-range" className="text-sm font-medium text-foreground mb-1">
                終了番号
              </Label>
              <Input
                id="end-range"
                type="number"
                min="1"
                max={totalWords}
                value={endRange}
                onChange={(e) => {
                  const value = e.target.value;
                  setEndRange(value === "" ? "" : parseInt(value));
                }}
                data-testid="input-end-range"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground mb-2">クイック設定</p>
            <div className="grid grid-cols-2 gap-2">
              {selectedJson?.presets.length > 0 ? (
                selectedJson.presets.map((preset, index) => (
                  <Button
                    key={index}
                    variant={isPresetActive(preset) ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setPresetRange(preset.start, preset.end)}
                    data-testid={`button-preset-${preset.label}`}
                  >
                    {preset.label}
                    {isPresetActive(preset) && <Check className="ml-2 h-4 w-4" />}
                  </Button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">このファイルにはプリセットがありません</p>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPresetRange(1, totalWords)}
                data-testid="button-preset-all"
              >
                全範囲
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="question-count" className="text-sm font-medium text-foreground mb-1">
                問題数
              </Label>
              <Select value={questionCount.toString()} onValueChange={(value) => setQuestionCount(parseInt(value))}>
                <SelectTrigger data-testid="select-question-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10問</SelectItem>
                  <SelectItem value="20">20問</SelectItem>
                  <SelectItem value="50">50問</SelectItem>
                  <SelectItem value="100">100問</SelectItem>
                  <SelectItem value="-1">全て</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="order" className="text-sm font-medium text-foreground mb-1">
                順序
              </Label>
              <Select value={order} onValueChange={(value: "sequential" | "random" | "difficulty") => setOrder(value)}>
                <SelectTrigger data-testid="select-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">順番通り</SelectItem>
                  <SelectItem value="random">ランダム</SelectItem>
                  <SelectItem value="difficulty">難易度順</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground mb-1">
            難易度 (選択しない場合は全レベル)
          </Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <Button
                key={level}
                variant={selectedDifficulties.includes(level) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedDifficulties(prev =>
                    prev.includes(level)
                      ? prev.filter(p => p !== level)
                      : [...prev, level]
                  );
                }}
                className={selectedDifficulties.includes(level) ? "bg-primary text-primary-foreground" : ""}
              >
                Lv.{level}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-center items-center gap-4">
          <Button
            onClick={handleStartStudy}
            disabled={isStarting || !selectedJson}
            size="lg"
            data-testid="button-start-study"
          >
            {isStarting ? (
              <i className="fas fa-spinner fa-spin mr-2"></i>
            ) : (
              <i className="fas fa-play mr-2"></i>
            )}
            学習を開始
          </Button>

          <div className="flex items-center space-x-2 border rounded-md p-1 bg-muted/20">
            <Button
              variant={langMode === "en-jp" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLangMode("en-jp")}
              className="text-xs px-2 h-8"
            >
              w➜m
            </Button>
            <Button
              variant={langMode === "jp-en" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLangMode("jp-en")}
              className="text-xs px-2 h-8"
            >
              m➜w
            </Button>
          </div>
        </div>
        {!selectedJson && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            学習を開始するJSONファイルを選択してください。
          </p>
        )}
      </CardContent>
    </Card >
  );
}
