import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Trade, Journal } from '@/hooks/useTrades';
import { fetchAllAnalysisRows } from '@/lib/fetchAllAnalysisRows';

export function useAnalysisData() {
  const { user } = useAuth();
  const trades = useQuery({
    queryKey: ['trades', user?.id, 'complete-analysis'],
    enabled: !!user,
    queryFn: ({ signal }) => fetchAllAnalysisRows<Trade>(after => {
      let query = supabase.from('trades').select('*').eq('user_id', user!.id).order('id').limit(1000);
      if (after) query = query.gt('id', after);
      return query.abortSignal(signal);
    }),
  });
  const journals = useQuery({
    // Existing journal-save mutations invalidate the 'journal' prefix.
    queryKey: ['journal', user?.id, 'complete-analysis'],
    enabled: !!user,
    queryFn: ({ signal }) => fetchAllAnalysisRows<Journal>(after => {
      let query = supabase.from('journals').select('*').eq('user_id', user!.id).order('id').limit(1000);
      if (after) query = query.gt('id', after);
      return query.abortSignal(signal);
    }),
  });
  return { trades, journals };
}
