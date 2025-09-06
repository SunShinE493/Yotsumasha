// range-selector.tsx

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { StudyConfig, StudySession } from "@shared/schema";

// 修正後: presetsプロパティを追加
interface RangeSelectorProps {
  selectedJson: {
    name: string;
    wordCount: number;
    presets: { start: number; end: number; label: string }[];
  } | null;
  onStartSession: (session: StudySession) => void;
}

export function RangeSelector({ selectedJson, onStartSession }: RangeSelectorProps) {
  const totalWords = selectedJson?.wordCount || 0;
  // 修正: 初期値を空文字列に変更
  const [endRange, setEndRange] = useState<number | string>(Math.min(50, totalWords));
  const [startRange, setStartRange] = useState<number | string>(Math.min(50, totalWords));
  const [questionCount, setQuestionCount] = useState(totalWords);
  const [order, setOrder] = useState<"sequential" | "random" | "difficulty">("random");
  const [reviewOnly, setReviewOnly] = useState(false);
  const { toast } = useToast();

  const createSessionMutation = useMutation({
    mutationFn: async (config: StudyConfig) => {
      const response = await apiRequest("POST", "/api/study/session", config);
      return response.json();
    },
    onSuccess: (session) => {
      onStartSession(session);
    },
    onError: (error) => {
      toast({
        title: "セッション作成エラー",
        description: error.message,
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
      startRange,
      endRange,
      questionCount: questionCount === -1 ? endRange - startRange + 1 : questionCount,
      order,
      reviewOnly,
    };

    createSessionMutation.mutate(config);
  };

  const setPresetRange = (start: number, end: number) => {
    setStartRange(start);
    setEndRange(Math.min(end, totalWords));
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <i className="fas fa-sliders-h text-primary"></i>
            <h2 className="text-lg font-semibold text-foreground">学習範囲の設定</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="review-mode" className="text-sm text-muted-foreground">復習のみ</Label>
            <Switch
              id="review-mode"
              checked={reviewOnly}
              onCheckedChange={setReviewOnly}
              data-testid="switch-review-mode"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Range Inputs */}
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
                  // 修正: 入力値が空の場合は空文字列に設定
                  setStartRange(value === '' ? '' : parseInt(value));
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
                max={totalWords} // valueはそのまま endRange を使用
                value={endRange}
                onChange={(e) => {
                  const value = e.target.value;
                  // 修正: 入力値が空の場合は空文字列に設定
                  setEndRange(value === '' ? '' : parseInt(value));
                }}
                data-testid="input-end-range"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground mb-2">クイック設定</p>
            <div className="grid grid-cols-2 gap-2">
              {/* 修正箇所：動的にプリセットボタンを生成 */}
              {selectedJson?.presets.length > 0 ? (
                selectedJson.presets.map((preset, index) => (
                  <Button
                    key={index}
                    variant="secondary"
                    size="sm"
                    onClick={() => setPresetRange(preset.start, preset.end)}
                    data-testid={`button-preset-${preset.label}`}
                  >
                    {preset.label}
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

          {/* Study Options */}
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

        {/* Start Study Button */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleStartStudy}
            disabled={createSessionMutation.isPending || !selectedJson}
            size="lg"
            data-testid="button-start-study"
          >
            {createSessionMutation.isPending ? (
              <i className="fas fa-spinner fa-spin mr-2"></i>
            ) : (
              <i className="fas fa-play mr-2"></i>
            )}
            学習を開始
          </Button>
        </div>

        {!selectedJson && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            学習を開始するJSONファイルを選択してください。
          </p>
        )}
      </CardContent>
    </Card>
  );
}