"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle } from "lucide-react";
import { CustomDatePicker } from "@/components/ui/AppIcons";
import {
  BudgetPeriodType,
  getStandardPeriodOptions,
  getWeekRange,
  getMonthRange,
  getQuarterRange,
  getYearRange,
} from "@/lib/budgetUtils";

interface SelectTimeRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriodType: BudgetPeriodType;
  startDate: Date;
  endDate: Date;
  onSave: (periodType: BudgetPeriodType, startDate: Date, endDate: Date) => void;
}

function toLocalDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SelectTimeRangeModal({
  isOpen,
  onClose,
  selectedPeriodType,
  startDate,
  endDate,
  onSave,
}: SelectTimeRangeModalProps) {
  const [tempType, setTempType] = useState<BudgetPeriodType>(selectedPeriodType);
  const [customError, setCustomError] = useState<string>("");

  const getSafeEndDate = (sDate: Date, eDate: Date, pType: BudgetPeriodType) => {
    let e = new Date(eDate);
    if ((pType === "MONTH" || !pType) && e.getDate() === 1 && e.getMonth() !== sDate.getMonth()) {
      e = new Date(sDate.getFullYear(), sDate.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    return e;
  };

  const [customStart, setCustomStart] = useState<string>(() => toLocalDateInput(startDate));
  const [customEnd, setCustomEnd] = useState<string>(() =>
    toLocalDateInput(getSafeEndDate(startDate, endDate, selectedPeriodType))
  );

  useEffect(() => {
    if (isOpen) {
      setTempType(selectedPeriodType);
      setCustomStart(toLocalDateInput(startDate));
      setCustomEnd(toLocalDateInput(getSafeEndDate(startDate, endDate, selectedPeriodType)));
      setCustomError("");
    }
  }, [isOpen, selectedPeriodType, startDate, endDate]);

  if (!isOpen) return null;

  const presets = getStandardPeriodOptions(new Date());

  const handleSelectOption = (type: BudgetPeriodType) => {
    setTempType(type);
    setCustomError("");
  };

  const handleSave = () => {
    if (tempType === "CUSTOM") {
      const [sY, sM, sD] = customStart.split("-").map(Number);
      const [eY, eM, eD] = customEnd.split("-").map(Number);
      const s = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
      const e = new Date(eY, eM - 1, eD, 23, 59, 59, 999);

      // Validate: end date must not be entirely in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (e < today) {
        setCustomError("Budget end date cannot be in the past. Please select a present or future date.");
        return;
      }

      // Validate: start must be before or equal to end
      if (s > e) {
        setCustomError("Start date must be before or equal to the end date.");
        return;
      }

      setCustomError("");
      onSave("CUSTOM", s, e);
    } else if (tempType === "WEEK") {
      const { startDate: s, endDate: e } = getWeekRange(new Date());
      onSave("WEEK", s, e);
    } else if (tempType === "MONTH") {
      const { startDate: s, endDate: e } = getMonthRange(new Date());
      onSave("MONTH", s, e);
    } else if (tempType === "QUARTER") {
      const { startDate: s, endDate: e } = getQuarterRange(new Date());
      onSave("QUARTER", s, e);
    } else if (tempType === "YEAR") {
      const { startDate: s, endDate: e } = getYearRange(new Date());
      onSave("YEAR", s, e);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet Sheet Panel matching 2nd picture */}
      <div className="relative w-full max-w-lg mx-auto bg-[#1b1c20] rounded-t-3xl border-t border-white/10 px-5 pt-3 pb-8 z-10 shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Top Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1 bg-white/20 rounded-full" />
        </div>

        <h3 className="text-white text-lg font-bold mb-4 tracking-tight">
          Select time range
        </h3>

        {/* Options List matching Screenshot 2 */}
        <div className="space-y-1 mb-6">
          {presets.map((preset) => {
            const isSelected = tempType === preset.type;
            return (
              <button
                key={preset.type}
                type="button"
                onClick={() => handleSelectOption(preset.type)}
                className="w-full flex items-center justify-between py-3.5 px-1 text-left cursor-pointer group active:opacity-80"
              >
                <div className="flex items-center gap-3">
                  {/* Custom Round Radio matching Screenshot 2 */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "text-white shadow-sm"
                        : "border-2 border-white/25 group-hover:border-white/40"
                    }`}
                    style={isSelected ? { backgroundColor: "var(--color-primary)" } : undefined}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />}
                  </div>

                  <span className="text-white text-sm font-medium tracking-wide">
                    {preset.label} {preset.rangeText}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Custom option */}
          <button
            type="button"
            onClick={() => handleSelectOption("CUSTOM")}
            className="w-full flex items-center justify-between py-3.5 px-1 text-left cursor-pointer group active:opacity-80"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  tempType === "CUSTOM"
                    ? "text-white shadow-sm"
                    : "border-2 border-white/25 group-hover:border-white/40"
                }`}
                style={tempType === "CUSTOM" ? { backgroundColor: "var(--color-primary)" } : undefined}
              >
                {tempType === "CUSTOM" && <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />}
              </div>

              <span className="text-white text-sm font-medium tracking-wide">
                Custom
              </span>
            </div>
          </button>

          {/* Custom Date Pickers if Custom is chosen */}
          {tempType === "CUSTOM" && (
            <div className="grid grid-cols-2 gap-3 pt-2 pb-1 px-1">
              <div>
                <label className="text-slate-400 text-xs block mb-1">Start Date</label>
                <div className="w-full bg-[#252830] border border-white/10 rounded-xl px-3 py-2">
                  <CustomDatePicker
                    value={customStart}
                    onChange={(val) => { setCustomStart(val); setCustomError(""); }}
                    placeholder="Start date"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">End Date</label>
                <div className="w-full bg-[#252830] border border-white/10 rounded-xl px-3 py-2">
                  <CustomDatePicker
                    value={customEnd}
                    onChange={(val) => { setCustomEnd(val); setCustomError(""); }}
                    placeholder="End date"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Custom date error */}
          {customError && (
            <div className="flex items-start gap-2 mt-2 px-1 py-2 bg-red-500/10 border border-red-500/30 rounded-xl animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-xs leading-relaxed">{customError}</p>
            </div>
          )}
        </div>

        {/* Bottom Actions matching Screenshot 2 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-full bg-[#e8eae9] text-slate-900 font-bold text-sm hover:bg-white active:scale-98 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3.5 rounded-full text-white font-bold text-sm shadow-lg active:scale-98 transition-all cursor-pointer hover:opacity-95"
            style={{
              backgroundColor: "var(--color-primary)",
              boxShadow: "0 8px 20px -4px var(--color-primary-glow)",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
