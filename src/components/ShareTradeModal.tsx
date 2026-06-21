import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trade } from "@/hooks/useTrades";
import { ArrowUpRight, ArrowDownRight, Share2, Link as LinkIcon, Download, FileText, Image as ImageIcon, Twitter, Send } from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

interface ShareTradeModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareTradeModal({ trade, isOpen, onClose }: ShareTradeModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!trade) return null;

  const shareUrl = `${window.location.origin}/trade/share/${trade.id}`;
  const pnl = Number(trade.pnl);
  const isProfit = pnl >= 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${day} ${month} ${time}`;
  };

  const tradeSummary = `
${trade.symbol} ${trade.direction.toUpperCase()}

Entry: ${trade.entry_price}
Exit: ${trade.exit_price}
Lot Size: ${trade.lot_size}

Profit: ${isProfit ? '+' : '-'}$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}

Open:
${formatDate(trade.open_time)}

Close:
${formatDate(trade.close_time)}

Shared from DaddyFXBook
  `.trim();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Trade link copied.");
    } catch (err) {
      toast.error("Sharing failed. Please try again.");
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(tradeSummary);
      toast.success("Trade summary copied.");
    } catch (err) {
      toast.error("Sharing failed. Please try again.");
    }
  };

  const handleDownloadImage = async () => {
    if (!previewRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        backgroundColor: '#0A0A0A',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `DaddyFXBook_${trade.symbol}_${trade.direction}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image downloaded.");
    } catch (err) {
      toast.error("Sharing failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!previewRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        backgroundColor: '#0A0A0A',
        pixelRatio: 2,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DaddyFXBook_${trade.symbol}_${trade.direction}.pdf`);
      toast.success("PDF downloaded.");
    } catch (err) {
      toast.error("Sharing failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `DaddyFXBook Trade: ${trade.symbol} ${trade.direction}`,
          text: tradeSummary,
          url: shareUrl,
        });
        toast.success("Trade shared successfully.");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out my trade on DaddyFXBook!\n\n' + tradeSummary)}&url=${encodeURIComponent(shareUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(tradeSummary)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(tradeSummary + '\n' + shareUrl)}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-[#0B0B0B] border-white/[0.08] text-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-4 border-b border-white/[0.08]">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Trade
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Preview Card */}
          <div 
            ref={previewRef}
            className="rounded-[20px] bg-gradient-to-br from-[#121212] to-[#0A0A0A] border border-white/[0.08] p-5 shadow-xl relative overflow-hidden"
          >
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/[0.02] font-black text-4xl rotate-[-20deg] whitespace-nowrap pointer-events-none select-none">
              DADDYFXBOOK
            </div>

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div>
                <h3 className="font-bold text-lg text-white">{trade.symbol}</h3>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 mt-1 ${trade.direction === 'Long' ? 'bg-[#0A1224] text-[#3B82F6]' : 'bg-[#240A0A] text-[#EF4444]'}`}>
                  {trade.direction === 'Long' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {trade.direction}
                </span>
              </div>
              <div className="text-right">
                <p className={`font-black text-2xl ${isProfit ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                  {isProfit ? '+' : '-'}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mt-1">Net Profit</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
              <div>
                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1">Entry Price</p>
                <p className="font-bold text-sm text-white">${Number(trade.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1">Exit Price</p>
                <p className="font-bold text-sm text-white">${Number(trade.exit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1">Lot Size</p>
                <p className="font-bold text-sm text-white">{trade.lot_size}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1">Open Date</p>
                <p className="font-bold text-sm text-white truncate">{formatDate(trade.open_time)}</p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/[0.05] flex items-center justify-between relative z-10">
              <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Shared via DaddyFXBook</span>
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
                <span className="text-black font-black text-[10px]">$</span>
              </div>
            </div>
          </div>

          {/* Share Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={handleWebShare} className="sm:hidden col-span-2 touch-target flex items-center justify-center gap-2 bg-[#3B82F6] hover:bg-blue-600 text-white p-3 rounded-xl font-bold text-sm transition-all">
              <Share2 className="w-4 h-4" /> Share...
            </button>
            <button onClick={handleCopyLink} className="touch-target flex flex-col items-center justify-center gap-2 bg-[#121212] hover:bg-white/[0.05] border border-white/[0.08] text-white p-3 min-h-[80px] rounded-xl font-semibold text-xs transition-all">
              <LinkIcon className="w-5 h-5 text-primary" />
              Copy Link
            </button>
            <button onClick={handleCopySummary} className="touch-target flex flex-col items-center justify-center gap-2 bg-[#121212] hover:bg-white/[0.05] border border-white/[0.08] text-white p-3 min-h-[80px] rounded-xl font-semibold text-xs transition-all">
              <FileText className="w-5 h-5 text-purple-400" />
              Copy Text
            </button>
            <button onClick={handleDownloadImage} disabled={isExporting} className="touch-target flex flex-col items-center justify-center gap-2 bg-[#121212] hover:bg-white/[0.05] border border-white/[0.08] text-white p-3 min-h-[80px] rounded-xl font-semibold text-xs transition-all disabled:opacity-50">
              <ImageIcon className="w-5 h-5 text-emerald-400" />
              Image
            </button>
            <button onClick={handleDownloadPDF} disabled={isExporting} className="touch-target flex flex-col items-center justify-center gap-2 bg-[#121212] hover:bg-white/[0.05] border border-white/[0.08] text-white p-3 min-h-[80px] rounded-xl font-semibold text-xs transition-all disabled:opacity-50">
              <Download className="w-5 h-5 text-amber-400" />
              PDF
            </button>
          </div>

          <div className="pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Share on Social</p>
            <div className="flex items-center gap-3">
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="touch-target flex-1 flex items-center justify-center gap-2 bg-[#121212] hover:bg-white/[0.05] border border-white/[0.08] text-white p-2.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all">
                <Twitter className="w-4 h-4" /> Twitter
              </a>
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="touch-target flex-1 flex items-center justify-center gap-2 bg-[#121212] hover:bg-white/[0.05] border border-white/[0.08] text-white p-2.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all">
                <Send className="w-4 h-4" /> Telegram
              </a>
            </div>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-3 touch-target w-full flex items-center justify-center gap-2 bg-[#121212] hover:bg-white/[0.05] border border-white/[0.08] text-white p-2.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all">
              WhatsApp
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
