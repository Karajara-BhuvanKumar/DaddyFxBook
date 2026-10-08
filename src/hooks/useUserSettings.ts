import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
export { ACCENT_COLORS } from "@/lib/workspacePreferences";


export type UserSettings = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  timezone: string;
  time_format: string;
  currency: string;
  account_size: number;
  default_risk_pct: number;
  max_daily_risk: number;
  max_weekly_risk: number;
  max_trades_per_day: number;
  preferred_session: string;
  theme: string;
  accent_color: string;
  chart_style: string;
  compact_mode: boolean;
  notify_daily: boolean;
  notify_weekly: boolean;
  notify_monthly: boolean;
};

export const DEFAULTS = (uid: string): UserSettings => ({
  user_id: uid,
  display_name: null,
  username: null,
  avatar_url: null,
  timezone: "UTC",
  time_format: "24h",
  currency: "USD",
  account_size: 10000,
  default_risk_pct: 1,
  max_daily_risk: 3,
  max_weekly_risk: 6,
  max_trades_per_day: 3,
  preferred_session: "London",
  theme: "dark",
  accent_color: "blue",
  chart_style: "smooth",
  compact_mode: false,
  notify_daily: true,
  notify_weekly: true,
  notify_monthly: false,
});

export function useUserSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id ?? "";


  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ["user_settings", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", uid).maybeSingle();
      if (error) throw error;
      if (!data) {
        const def = DEFAULTS(uid);
        const { error: insErr } = await supabase.from("user_settings").insert(def);
        if (insErr) throw insErr;
        return def;
      }
      return { ...DEFAULTS(uid), ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null)) } as UserSettings;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      if (!uid) throw new Error("Please sign in again.");
      const { data, error } = await supabase.from("user_settings").update(patch).eq("user_id", uid).select("*").single();
      if (error) throw error;
      return { ...DEFAULTS(uid), ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null)) } as UserSettings;
    },
    onSuccess: (saved) => {
      qc.setQueryData(["user_settings", uid], saved);
    },
    onError: (e: Error) => toast({ title: "Failed to update settings", description: e.message, variant: "destructive" }),
  });

  const uploadAvatar = async (file: File) => {
    if (!uid) throw new Error("Please sign in again.");
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = extensions[file.type];
    if (!ext) throw new Error("Choose a JPG, PNG, or WebP image.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Your photo must be 2 MB or smaller.");
    const path = `${uid}/avatar-${crypto.randomUUID()}.${ext}`;
    const bucket = supabase.storage.from("avatars");
    const { error } = await bucket.upload(path, file, { contentType: file.type });
    if (error) throw error;
    try {
      const { data, error: urlError } = await bucket.createSignedUrl(path, 60 * 60 * 24 * 365);
      if (urlError) throw urlError;
      if (!data?.signedUrl) throw new Error("Could not load your uploaded photo. Please try again.");
      await updateMutation.mutateAsync({ avatar_url: data.signedUrl });
    } catch (error) {
      await bucket.remove([path]);
      throw error;
    }
  };

  return {
    settings,
    isLoading,
    isError,
    refetch,
    updateSettings: updateMutation.mutate,
    updateSettingsAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    uploadAvatar,
  };
}
