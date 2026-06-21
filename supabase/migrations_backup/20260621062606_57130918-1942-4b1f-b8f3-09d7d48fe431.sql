
CREATE POLICY "Users can update own ai_performance_reports" ON public.ai_performance_reports FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_scorecards" ON public.ai_scorecards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own screenshots" ON public.screenshots FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
