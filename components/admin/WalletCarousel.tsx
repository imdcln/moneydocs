"use client";

const WALLET_GRADIENTS: Record<string, string> = {
  CASH: "from-emerald-500 to-teal-600",
  BANK: "from-blue-500 to-indigo-600",
  E_WALLET: "from-purple-500 to-violet-600",
  INVESTMENT: "from-amber-500 to-orange-500",
  OTHER: "from-slate-500 to-slate-600",
};

interface WalletCardData {
  id: string;
  name: string;
  icon: string;
  type: string;
  balance: number;
  currency: string;
  isDefault: boolean;
  ownerName?: string;
  ownerEmail?: string;
  isOwned?: boolean;
}

interface WalletCarouselProps {
  wallets: WalletCardData[];
}

export default function WalletCarousel({ wallets }: WalletCarouselProps) {
  if (wallets.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm bg-white/5 border border-white/10 rounded-2xl">
        <p className="text-2xl mb-1">🏦</p>
        <p>No wallets yet</p>
        <p className="text-xs mt-1">Add one in Account settings</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide -mx-4 px-4">
      {wallets.map((wallet) => {
        const gradient = WALLET_GRADIENTS[wallet.type] ?? WALLET_GRADIENTS.OTHER;
        const formattedBalance = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: wallet.currency === "IDR" ? "IDR" : "IDR", // Always show in IDR
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(wallet.balance);

        return (
          <div
            key={wallet.id}
            className={`flex-shrink-0 snap-center w-60 bg-gradient-to-br ${gradient} rounded-3xl p-5 relative overflow-hidden shadow-xl`}
          >
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-black/10 translate-y-4 -translate-x-4" />

            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                  {wallet.icon}
                </div>
                {wallet.isDefault && (
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                    Default
                  </span>
                )}
              </div>

              <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-0.5">
                {wallet.type.replace("_", " ")}
              </p>
              <p className="text-white font-bold text-lg leading-tight mb-3 truncate">
                {wallet.name}
              </p>

              <p className="text-white/60 text-[10px] uppercase tracking-widest">Balance</p>
              <p className="text-white font-extrabold text-xl tracking-tight">
                {formattedBalance}
              </p>

              {wallet.isOwned === false && (wallet.ownerName || wallet.ownerEmail) && (
                <span className="inline-block mt-2 text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold truncate max-w-full">
                  Shared by {wallet.ownerName || wallet.ownerEmail}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Wallet CTA card */}
      <div className="flex-shrink-0 snap-center w-40 border-2 border-dashed border-white/15 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-slate-400 hover:border-white/25 transition-colors cursor-pointer p-4">
        <span className="text-2xl">＋</span>
        <p className="text-xs text-center leading-tight">Add Wallet</p>
      </div>
    </div>
  );
}
