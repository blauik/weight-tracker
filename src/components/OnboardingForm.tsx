"use client";

import { useState } from "react";
import { UserProfile, Gender, ActivityLevel } from "@/types";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: "sedentary", label: "Sedavý", desc: "Kancelářská práce, minimum pohybu" },
  { value: "light", label: "Lehce aktivní", desc: "Lehké cvičení 1-3x týdně" },
  { value: "moderate", label: "Středně aktivní", desc: "Cvičení 3-5x týdně" },
  { value: "active", label: "Aktivní", desc: "Intenzivní cvičení 6-7x týdně" },
  { value: "very_active", label: "Velmi aktivní", desc: "Fyzicky náročná práce + cvičení" },
];

interface Props {
  onComplete: (profile: UserProfile) => void;
}

export default function OnboardingForm({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [startWeight, setStartWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");

  const steps = [
    { title: "Osobní údaje", subtitle: "Řekněte nám o sobě" },
    { title: "Tělesné parametry", subtitle: "Pro výpočet metabolismu" },
    { title: "Cíl", subtitle: "Definujte svůj cíl" },
    { title: "Aktivita", subtitle: "Úroveň pohybové aktivity" },
  ];

  const canNext = () => {
    switch (step) {
      case 0: return name.trim().length > 0 && gender;
      case 1: return +age > 0 && +heightCm > 0;
      case 2: return +startWeight > 0 && +targetWeight > 0 && +targetWeight < +startWeight;
      case 3: return true;
      default: return false;
    }
  };

  const handleSubmit = () => {
    const profile: UserProfile = {
      name: name.trim(),
      gender,
      age: +age,
      heightCm: +heightCm,
      startWeight: +startWeight,
      targetWeight: +targetWeight,
      activityLevel,
      startDate: new Date().toISOString().split("T")[0],
    };
    onComplete(profile);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo & Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mb-4 shadow-lg shadow-emerald-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            WeightFlow
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Inteligentní sledování váhy</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                  i < step
                    ? "bg-emerald-500 text-white"
                    : i === step
                    ? "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 ring-2 ring-emerald-500/50"
                    : "bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600"
                }`}
              >
                {i < step ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 rounded ${i < step ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-800"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="glass p-8 animate-slide-up">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{steps[step].title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{steps[step].subtitle}</p>
          </div>

          {step === 0 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Jméno</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vaše jméno"
                  className="input-base"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Pohlaví</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["male", "female"] as Gender[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        gender === g
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                          : "border-gray-300 dark:border-gray-700/50 bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="text-2xl mb-1">{g === "male" ? "♂" : "♀"}</div>
                      <div className="text-sm font-medium">{g === "male" ? "Muž" : "Žena"}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Věk</label>
                <div className="relative">
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="25"
                    className="input-base pr-12"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-sm">let</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Výška</label>
                <div className="relative">
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="180"
                    className="input-base pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-sm">cm</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Aktuální váha</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={startWeight}
                    onChange={(e) => setStartWeight(e.target.value)}
                    placeholder="90.0"
                    className="input-base pr-12"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-sm">kg</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Cílová váha</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    placeholder="75.0"
                    className="input-base pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-sm">kg</span>
                </div>
              </div>
              {+startWeight > 0 && +targetWeight > 0 && +targetWeight >= +startWeight && (
                <p className="text-sm text-red-400">Cílová váha musí být nižší než aktuální.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 animate-fade-in">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setActivityLevel(opt.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    activityLevel === opt.value
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-gray-300 dark:border-gray-700/50 bg-gray-100 dark:bg-gray-800/30 hover:border-gray-400 dark:hover:border-gray-600"
                  }`}
                >
                  <div className={`font-medium ${activityLevel === opt.value ? "text-emerald-500 dark:text-emerald-400" : "text-gray-900 dark:text-gray-300"}`}>
                    {opt.label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setStep(step - 1)}
              className={`btn-secondary ${step === 0 ? "invisible" : ""}`}
            >
              Zpět
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="btn-primary"
              >
                Pokračovat
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canNext()}
                className="btn-primary"
              >
                Začít sledovat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
