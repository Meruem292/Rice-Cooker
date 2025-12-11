import React, { useState, useEffect } from 'react';
import { Play, Square, Sparkles, Send, Settings, Plus, Trash2, Smartphone, X, Utensils, Zap, Heart, Clock, Save, Droplets, Flame, Ban, AlertCircle } from 'lucide-react';
import { ref, onValue, update, set, remove, push } from 'firebase/database';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { RiceCookerState } from '../types';
import { getSmartCookingAdvice } from '../services/geminiService';

interface DashboardProps {
  user: User;
}

const DEFAULT_PRESETS = [
  { id: 'white', name: 'Perfect White', rice: 2, water: 2, mode: 'white', time: 30 },
  { id: 'brown', name: 'Healthy Brown', rice: 2, water: 3, mode: 'brown', time: 60 },
  { id: 'sushi', name: 'Sushi Grade', rice: 3, water: 3, mode: 'sushi', time: 45 },
  { id: 'porridge', name: 'Morning Porridge', rice: 1, water: 4, mode: 'porridge', time: 90 },
];

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  // Device Management State
  const [ownedDevices, setOwnedDevices] = useState<string[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  // Device Data State
  const [deviceState, setDeviceState] = useState<RiceCookerState>({
    status: 'idle',
    riceLevel: 0,
    waterLevel: 0,
    timeLeftSeconds: 0,
    totalTimeSeconds: 0,
    mode: 'white'
  });

  // Form State
  const [formRice, setFormRice] = useState(2);
  const [formWater, setFormWater] = useState(2); // Explicit water cups instead of ratio
  const [formMode, setFormMode] = useState('white');
  const [formTime, setFormTime] = useState(30);

  // Custom Presets State
  const [customPresets, setCustomPresets] = useState<any[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // AI Chat State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<{message: string, config?: any} | null>(null);
  const [connected, setConnected] = useState(false);

  // 1. Fetch User's Owned Devices
  useEffect(() => {
    const userDevicesRef = ref(db, `users/${user.uid}/ownedDevices`);
    const unsubscribe = onValue(userDevicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const deviceList = Object.keys(data);
        setOwnedDevices(deviceList);
      } else {
        setOwnedDevices([]);
      }
    });

    return () => unsubscribe();
  }, [user.uid]);

  // 1.5 Sync Selection with Device List
  useEffect(() => {
    if (ownedDevices.length > 0) {
      if (!selectedDeviceId || !ownedDevices.includes(selectedDeviceId)) {
        setSelectedDeviceId(ownedDevices[0]);
      }
    } else {
      if (selectedDeviceId) setSelectedDeviceId(null);
    }
  }, [ownedDevices, selectedDeviceId]);

  // 2. Fetch Selected Device Data and Sync Logic
  useEffect(() => {
    if (!selectedDeviceId) {
      setConnected(false);
      return;
    }

    const deviceRef = ref(db, `devices/${selectedDeviceId}`);
    const unsubscribe = onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // DB Structure: { cook: boolean, cookTime: number, cookStartTime: number, dispense: boolean, ... }
        
        let newStatus: RiceCookerState['status'] = 'idle';
        let totalTime = 0;
        let estimatedTimeLeft = 0;
        let cookingEndTime: number | undefined = undefined;

        if (data.cook) {
          // COOKING LOGIC
          const durationMinutes = data.cookTime || 30;
          totalTime = durationMinutes * 60;
          
          // Use cookStartTime for persistence if available, otherwise fallback to Date.now()
          const startTime = data.cookStartTime || Date.now();
          cookingEndTime = startTime + (totalTime * 1000);
          
          const now = Date.now();
          const elapsedSeconds = (now - startTime) / 1000;
          const remaining = Math.max(0, Math.ceil(totalTime - elapsedSeconds));

          // Auto-Stop if time has expired while disconnected
          if (remaining <= 0) {
             update(ref(db, `devices/${selectedDeviceId}`), { 
               cook: false, 
               cookTime: 0, 
               cookStartTime: null 
             });
             newStatus = 'idle';
             estimatedTimeLeft = 0;
          } else {
             newStatus = 'cooking';
             estimatedTimeLeft = remaining;
          }

        } else if (data.dispense) {
          // DISPENSING LOGIC
          newStatus = 'dispensing';
          
          const riceAmount = data.riceDispenseCup || 0;
          const waterAmount = data.waterDispenseCup || 0;
          
          // Calculation: (Rice * 7.5s) + (Water * 10s) + 5s buffer
          totalTime = Math.ceil((riceAmount * 7.5) + (waterAmount * 10) + 5);
          
          // For dispensing, we don't strictly persist time across reloads in this version,
          // but we could if we added a dispenseStartTime.
          // For now, it resets on reload, but completion is handled by timer logic.
          estimatedTimeLeft = totalTime; 
        } else {
          newStatus = 'idle';
        }

        setDeviceState(prev => {
          // Avoid stutter by keeping local time if status is same and time is close
          const isSameStatus = prev.status === newStatus;
          
          return {
            ...prev,
            status: newStatus,
            timeLeftSeconds: isSameStatus && prev.timeLeftSeconds > 0 && newStatus === 'dispensing' ? prev.timeLeftSeconds : estimatedTimeLeft,
            totalTimeSeconds: totalTime,
            cookingEndTime: cookingEndTime,
          };
        });
        setConnected(true);
      } else {
        setConnected(false);
      }
    });

    return () => unsubscribe();
  }, [selectedDeviceId]);

  // 3. Fetch Custom Presets
  useEffect(() => {
    const presetsRef = ref(db, `users/${user.uid}/presets`);
    const unsubscribe = onValue(presetsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedPresets = Object.entries(data).map(([key, val]: [string, any]) => ({
          id: key,
          ...val
        }));
        setCustomPresets(loadedPresets);
      } else {
        setCustomPresets([]);
      }
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Timer Logic
  useEffect(() => {
    let interval: any;

    if (deviceState.status === 'cooking' || deviceState.status === 'dispensing') {
      
      // Check for finish
      if (deviceState.timeLeftSeconds <= 0) {
         if (selectedDeviceId) {
             if (deviceState.status === 'cooking') {
                 // Cooking finished
                 update(ref(db, `devices/${selectedDeviceId}`), { 
                   cook: false, 
                   cookTime: 0,
                   cookStartTime: null
                 });
             } else if (deviceState.status === 'dispensing') {
                 // Dispensing finished - Auto back to neutral
                 update(ref(db, `devices/${selectedDeviceId}`), { 
                   dispense: false,
                   riceDispenseCup: 0,
                   waterDispenseCup: 0
                 });
             }
         }
      } else {
        interval = setInterval(() => {
          setDeviceState(prev => {
             // If cooking, use absolute time for precision
             if (prev.status === 'cooking' && prev.cookingEndTime) {
                 const remaining = Math.max(0, Math.ceil((prev.cookingEndTime - Date.now()) / 1000));
                 return { ...prev, timeLeftSeconds: remaining };
             }
             // Fallback for dispensing
             return { ...prev, timeLeftSeconds: Math.max(0, prev.timeLeftSeconds - 1) };
          });
        }, 1000);
      }
    }
    
    return () => clearInterval(interval);
  }, [deviceState.status, deviceState.timeLeftSeconds, deviceState.cookingEndTime, selectedDeviceId]);

  // CONTROL FUNCTIONS

  const handleCancel = async () => {
    if (!selectedDeviceId) return;
    // Reset all flags
    const updates = {
      cook: false,
      cookTime: 0,
      cookStartTime: null,
      dispense: false,
      waterDispenseCup: 0,
      riceDispenseCup: 0
    };
    
    setDeviceState(prev => ({ ...prev, status: 'idle', timeLeftSeconds: 0 }));
    await update(ref(db, `devices/${selectedDeviceId}`), updates);
  };

  const handleDispense = async () => {
    if (!selectedDeviceId) return;
    if (deviceState.status !== 'idle') return;

    // Use explicit whole number cups
    const waterCups = formWater;
    const riceCups = formRice;
    
    const updates = {
      dispense: true,
      riceDispenseCup: riceCups,
      waterDispenseCup: waterCups,
      cook: false,
      cookTime: 0,
      cookStartTime: null
    };

    // Calculation: (Rice * 7.5s) + (Water * 10s) + 5s buffer
    const dispenseTime = Math.ceil((riceCups * 7.5) + (waterCups * 10) + 5);
    
    setDeviceState(prev => ({ 
        ...prev, 
        status: 'dispensing',
        timeLeftSeconds: dispenseTime,
        totalTimeSeconds: dispenseTime
    }));
    
    await update(ref(db, `devices/${selectedDeviceId}`), updates);
  };

  const handleCook = async () => {
    if (!selectedDeviceId) return;
    if (deviceState.status !== 'idle') return;

    const totalTimeSeconds = formTime * 60;
    const now = Date.now();
    const endTime = now + (totalTimeSeconds * 1000);
    
    const updates = {
      cook: true,
      cookTime: formTime,
      cookStartTime: now, // Add start time for persistence
      dispense: false,
      riceDispenseCup: 0,
      waterDispenseCup: 0
    };

    setDeviceState(prev => ({ 
      ...prev, 
      status: 'cooking',
      timeLeftSeconds: totalTimeSeconds,
      totalTimeSeconds: totalTimeSeconds,
      cookingEndTime: endTime,
      mode: formMode as any
    }));
    
    await update(ref(db, `devices/${selectedDeviceId}`), updates);
  };

  const handleStartAI = async (config: any) => {
     if (!selectedDeviceId) return;
     if (deviceState.status !== 'idle') return;

     const timeMinutes = config.time ? config.time / 60 : 30;
     const totalTimeSeconds = timeMinutes * 60;
     const now = Date.now();
     const endTime = now + (totalTimeSeconds * 1000);

     const updates = {
       cook: true,
       cookTime: timeMinutes,
       cookStartTime: now,
       dispense: false,
       riceDispenseCup: 0,
       waterDispenseCup: 0
     };

     setDeviceState(prev => ({ 
        ...prev, 
        status: 'cooking',
        timeLeftSeconds: totalTimeSeconds,
        totalTimeSeconds: totalTimeSeconds,
        cookingEndTime: endTime,
        mode: config.mode || 'white' as any
     }));
     
     await update(ref(db, `devices/${selectedDeviceId}`), updates);
  };

  const handleStop = async () => {
    await handleCancel();
  };

  // Device Management Functions
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId.trim()) return;
    setIsAddingDevice(true);
    const id = newDeviceId.trim();
    try {
      await set(ref(db, `users/${user.uid}/ownedDevices/${id}`), { addedAt: Date.now() });
      await update(ref(db, `devices/${id}`), {
        cook: false,
        cookTime: 0,
        cookStartTime: null,
        dispense: false,
        waterDispenseCup: 0,
        riceDispenseCup: 0
      });
      setNewDeviceId('');
      setSelectedDeviceId(id);
    } catch (error) {
      console.error("Failed to add device", error);
    } finally {
      setIsAddingDevice(false);
    }
  };

  const handleDeleteDevice = async (e: React.MouseEvent, deviceId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (window.confirm(`Are you sure you want to remove device ${deviceId}?`)) {
      try {
        await remove(ref(db, `users/${user.uid}/ownedDevices/${deviceId}`));
      } catch (error) {
        console.error("Failed to remove device", error);
        alert("Failed to delete device. Please try again.");
      }
    }
  };

  const handleApplyPreset = (preset: any) => {
    if (deviceState.status !== 'idle') return;
    setFormRice(preset.rice);
    // Handle both new explicit water presets and old ratio presets
    if (preset.water) {
        setFormWater(preset.water);
    } else if (preset.ratio) {
        setFormWater(Math.max(1, Math.round(preset.rice * preset.ratio)));
    }
    setFormMode(preset.mode);
    if (preset.time) setFormTime(preset.time);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      const newPreset = {
        name: newPresetName,
        rice: formRice,
        water: formWater, // Save explicit water amount
        mode: formMode,
        time: formTime,
        createdAt: Date.now()
      };
      await push(ref(db, `users/${user.uid}/presets`), newPreset);
      setShowSaveModal(false);
      setNewPresetName('');
    } catch (error) {
      console.error("Error saving preset:", error);
    }
  };

  const handleDeletePreset = async (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    if (confirm("Delete this custom preset?")) {
      try {
        await remove(ref(db, `users/${user.uid}/presets/${presetId}`));
      } catch (error) {
        console.error("Error deleting preset:", error);
      }
    }
  };

  const handleAskAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse(null);

    try {
      const advice = await getSmartCookingAdvice(aiPrompt);
      // Calculate explicit water cups from ratio, rounding to nearest whole number
      const recommendedWater = Math.max(1, Math.round(advice.riceCups * advice.waterRatio));

      setAiResponse({
        message: `I've configured the cooker for ${advice.riceCups} cups of rice with ${recommendedWater} cups of water using ${advice.mode} mode. ${advice.explanation}`,
        config: {
          time: advice.estimatedTimeMinutes * 60,
          mode: advice.mode
        }
      });
      if (deviceState.status === 'idle') {
        setFormRice(advice.riceCups);
        setFormWater(recommendedWater);
        setFormMode(advice.mode);
        if (advice.estimatedTimeMinutes) setFormTime(advice.estimatedTimeMinutes);
      }
    } catch (error) {
      setAiResponse({ message: "Sorry, I couldn't connect to the chef. Please try again." });
    } finally {
      setAiLoading(false);
    }
  };

  // UI Helpers
  const progressPercentage = deviceState.totalTimeSeconds > 0 
    ? ((deviceState.totalTimeSeconds - deviceState.timeLeftSeconds) / deviceState.totalTimeSeconds) * 100 
    : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isBusy = deviceState.status !== 'idle';
  const ringColor = deviceState.status === 'dispensing' ? '#3FA7BB' : '#E2852E';

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Status & Device Selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200 gap-4">
          <div className="flex items-center gap-4">
             <div>
               <h1 className="text-2xl font-bold text-slate-800 tracking-tight">My Smart Cooker</h1>
               <div className="flex items-center gap-2 mt-1">
                 <span className={`w-2 h-2 rounded-full transition-all duration-500 ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                 <p className="text-slate-500 text-sm font-medium">{connected ? 'Online' : 'Offline'}</p>
               </div>
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
             <div className="relative group">
                <button 
                  onClick={() => setShowDeviceManager(true)}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 active:scale-95 border border-slate-200"
                >
                  <Smartphone className="w-4 h-4 group-hover:text-brand-600 transition-colors" />
                  <span>{selectedDeviceId || 'Select Device'}</span>
                  <Settings className="w-4 h-4 ml-2 text-slate-400 group-hover:rotate-45 transition-transform" />
                </button>
             </div>

             {selectedDeviceId && (
               <div className="flex gap-4 ml-4 pl-4 border-l border-slate-200 animate-slide-up">
                  <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Mode</div>
                      <div className="font-semibold text-slate-800 capitalize">{deviceState.mode}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</div>
                      <div className={`font-semibold capitalize transition-colors duration-500 ${
                        deviceState.status === 'cooking' ? 'text-brand-600 animate-pulse' : 
                        deviceState.status === 'dispensing' ? 'text-water-600 animate-pulse' : 
                        deviceState.status === 'warm' ? 'text-brand-400' : 'text-slate-600'
                      }`}>
                        {deviceState.status}
                      </div>
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Empty State if No Devices */}
        {ownedDevices.length === 0 && !showDeviceManager && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center animate-slide-up">
            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 animate-bounce-slight">
              <Smartphone className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Devices Connected</h3>
            <p className="text-slate-500 mt-2 mb-6">Add your Rice Cooker ID to start controlling it remotely.</p>
            <button 
              onClick={() => setShowDeviceManager(true)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-700 transition-all hover:scale-105 shadow-lg shadow-brand-200"
            >
              <Plus className="w-5 h-5" /> Add First Device
            </button>
          </div>
        )}

        {/* Main Interface (Only if device selected) */}
        {selectedDeviceId && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
              
              {/* Main Control Panel - Top Row */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Timer / Progress Circle */}
                <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden h-[400px] gap-10 group">
                   {(deviceState.status === 'cooking' || deviceState.status === 'dispensing') && (
                     <div className={`absolute inset-0 opacity-20 animate-pulse-soft ${deviceState.status === 'dispensing' ? 'bg-water-100' : 'bg-brand-50'}`}></div>
                   )}
                   
                   <div className="relative z-10 w-64 h-64 flex-shrink-0 transition-transform duration-500 group-hover:scale-105">
                      {/* SVG Circle Progress */}
                      <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 256 256">
                        <circle cx="128" cy="128" r="120" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                        <circle 
                          cx="128" cy="128" r="120" 
                          stroke={ringColor}
                          strokeWidth="12" 
                          fill="none" 
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 120}
                          strokeDashoffset={2 * Math.PI * 120 * (1 - progressPercentage / 100)}
                          className="transition-all duration-1000 ease-linear"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-mono font-bold text-slate-800 tabular-nums">
                          {formatTime(deviceState.timeLeftSeconds)}
                        </span>
                        <span className="text-slate-500 mt-2 text-sm uppercase tracking-wider font-semibold">
                            {deviceState.status === 'dispensing' ? 'Dispensing' : 
                             deviceState.status === 'cooking' ? 'Cooking' : 'Ready'}
                        </span>
                      </div>
                   </div>

                   <div className="flex gap-4 z-10">
                     {isBusy ? (
                         <div className="flex gap-4">
                           {deviceState.status === 'cooking' && (
                            <button 
                                onClick={handleStop}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 hover:shadow-xl">
                                <Square className="w-5 h-5 fill-current" /> Stop Cook
                            </button>
                           )}
                           <button 
                            onClick={handleCancel}
                            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-red-200 transition-all transform hover:scale-105 active:scale-95 hover:shadow-red-300">
                             <Ban className="w-5 h-5" /> Cancel All
                           </button>
                         </div>
                     ) : (
                       <button 
                        onClick={handleCook}
                        className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-brand-200 transition-all transform hover:scale-105 active:scale-95 hover:shadow-brand-300">
                         <Play className="w-5 h-5 fill-current" /> Start Cook ({formMode})
                       </button>
                     )}
                   </div>
                </div>
              </div>

              {/* Sidebar: AI Chef (Expanded) */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200 flex flex-col h-[400px] overflow-hidden group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-brand-100 rounded-lg group-hover:rotate-12 transition-transform duration-300">
                        <Sparkles className="w-4 h-4 text-brand-600" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Smart Chef</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto mb-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 custom-scrollbar">
                    {aiResponse ? (
                        <div className="animate-pop">
                            {aiResponse.message}
                        </div>
                    ) : (
                        <span className="italic text-slate-400">Ask me for cooking advice...</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                      placeholder="Type..."
                      className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
                    />
                    <button 
                        onClick={handleAskAI} 
                        className="absolute right-2 top-1.5 text-brand-400 hover:text-brand-600 transition-colors p-1 hover:bg-brand-50 rounded"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                  {aiResponse?.config && (
                    <button onClick={() => handleStartAI(aiResponse.config)} disabled={isBusy} className="mt-2 w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg transition-all transform active:scale-95 shadow-md shadow-brand-200">
                      Use AI Settings
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Smart Dispense Section (Revised) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up-delayed">
              
              {/* Configuration Panel - Full Width */}
              <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200 p-6 relative">
                
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-brand-500 animate-spin-slow" />
                    Configuration & Control
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 items-center">
                     {/* Preset List */}
                    <div className="flex flex-wrap gap-2 mr-2">
                      {DEFAULT_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => handleApplyPreset(preset)}
                          disabled={isBusy}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all hover:scale-105 active:scale-95 border ${isBusy ? 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:border-slate-300'}`}
                        >
                          {preset.name}
                        </button>
                      ))}
                      {customPresets.map(preset => (
                        <div key={preset.id} className="relative group/preset">
                          <button
                            onClick={() => handleApplyPreset(preset)}
                            disabled={isBusy}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all hover:scale-105 active:scale-95 border pr-6 ${isBusy ? 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed' : 'bg-brand-50 hover:bg-brand-100 text-brand-700 border-brand-100'}`}
                          >
                            <span className="flex items-center gap-1">
                               <Heart className="w-3 h-3 fill-current" /> {preset.name}
                            </span>
                          </button>
                          <button
                            onClick={(e) => handleDeletePreset(e, preset.id)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-brand-200 text-brand-400 hover:text-brand-600 opacity-0 group-hover/preset:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Save Button */}
                    <button 
                      onClick={() => setShowSaveModal(true)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-full transition-all hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3 h-3" /> Save Config
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {/* Left Column: Sliders and Mode */}
                  <div className={`space-y-8 px-2 transition-opacity duration-300 ${isBusy ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="group">
                      <label className="flex justify-between text-sm font-medium text-slate-700 mb-3 group-hover:text-brand-700 transition-colors">
                        Rice Amount <span className="text-brand-600 font-bold bg-brand-100 px-2 py-0.5 rounded-md">{formRice} Cups</span>
                      </label>
                      <input 
                        type="range" min="1" max="5" step="0.5" 
                        value={formRice} onChange={(e) => setFormRice(parseFloat(e.target.value))}
                        disabled={isBusy}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:accent-brand-600 transition-all disabled:accent-slate-400"
                      />
                    </div>
                    
                    <div className="group">
                      <label className="flex justify-between text-sm font-medium text-slate-700 mb-3 group-hover:text-water-600 transition-colors">
                        Water Amount <span className="text-water-700 font-bold bg-water-100 px-2 py-0.5 rounded-md">{formWater} Cups</span>
                      </label>
                      <input 
                        type="range" min="1" max="10" step="1" 
                        value={formWater} onChange={(e) => setFormWater(parseInt(e.target.value))}
                        disabled={isBusy}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-water-500 hover:accent-water-600 transition-all disabled:accent-slate-400"
                      />
                    </div>

                    <div className="group">
                      <label className="flex justify-between text-sm font-medium text-slate-700 mb-3 group-hover:text-brand-400 transition-colors">
                        Cooking Duration <span className="text-brand-500 font-bold bg-brand-50 px-2 py-0.5 rounded-md">{formTime} Mins</span>
                      </label>
                      <input 
                        type="range" min="1" max="120" step="1" 
                        value={formTime} onChange={(e) => setFormTime(parseInt(e.target.value))}
                        disabled={isBusy}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-300 hover:accent-brand-400 transition-all disabled:accent-slate-400"
                      />
                    </div>

                    <div className="flex items-start gap-2 p-3 mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>Disclaimer:</strong> Please be aware of the possibility of the dispenser getting stuck or providing inconsistent measurements due to various factors including rice type, grain size, and shape.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Dispense Trigger */}
                  <div className="bg-slate-50 p-8 rounded-xl flex flex-col items-center justify-center text-center h-full border border-slate-100 transition-all hover:bg-slate-100 hover:border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Clock className="w-32 h-32 text-slate-900" />
                    </div>
                    
                    <div className="mb-6 space-y-1 relative z-10">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Ready to Cook?</h4>
                      <p className="text-3xl font-extrabold text-slate-900 transition-all duration-300 key={formRice} animate-pop">{formRice} Cups Rice</p>
                      <p className="text-lg font-medium text-slate-500 transition-all duration-300 key={formWater}">+ {formWater} Cups Water</p>
                      <p className="text-sm font-semibold text-brand-600 mt-2 bg-brand-50 inline-block px-3 py-1 rounded-full">{formTime} Minutes Cycle</p>
                    </div>
                    
                    <div className="w-full max-w-sm flex flex-col gap-3 relative z-10">
                        {/* Dispense Button */}
                        <button 
                          onClick={handleDispense}
                          disabled={isBusy}
                          className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl font-bold shadow-lg transition-all transform relative overflow-hidden
                            ${deviceState.status === 'dispensing' 
                                ? 'bg-water-100 text-water-700 cursor-not-allowed shadow-none border-2 border-water-200' 
                                : isBusy 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                    : 'bg-water-500 hover:bg-water-600 text-white hover:scale-105 active:scale-95 shadow-water-200'
                            }
                          `}
                        >
                          {deviceState.status === 'dispensing' ? (
                              <><Droplets className="w-5 h-5 animate-bounce" /> Dispensing...</>
                          ) : (
                              <><Droplets className="w-5 h-5 relative z-10" /> <span className="relative z-10">Dispense Only</span></>
                          )}
                        </button>

                        {/* Cook Button */}
                        <button 
                          onClick={handleCook}
                          disabled={isBusy}
                          className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl font-bold shadow-lg transition-all transform relative overflow-hidden
                            ${deviceState.status === 'cooking' 
                                ? 'bg-brand-100 text-brand-700 cursor-not-allowed shadow-none border-2 border-brand-200' 
                                : isBusy 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                    : 'bg-brand-500 hover:bg-brand-600 text-white hover:scale-105 active:scale-95 shadow-brand-200'
                            }
                          `}
                        >
                           {deviceState.status === 'cooking' ? (
                              <><Zap className="w-5 h-5 animate-pulse" /> Cooking...</>
                          ) : (
                              <><Flame className="w-5 h-5 relative z-10" /> <span className="relative z-10">Start Cooking</span></>
                          )}
                        </button>
                        
                        {/* Cancel Button (Visible only when busy) */}
                        {isBusy && (
                             <button 
                                onClick={handleCancel}
                                className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-700 font-semibold text-sm py-2 transition-colors mt-2"
                             >
                               <Ban className="w-4 h-4" /> Cancel Operation
                             </button>
                        )}
                    </div>

                    {!isBusy && (
                      <p className="text-xs text-slate-400 mt-4 max-w-xs mx-auto relative z-10">
                        Dispense ingredients first, then start the cooking cycle.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Device Manager Modal */}
        {showDeviceManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Manage Devices</h3>
                <button 
                  onClick={() => setShowDeviceManager(false)}
                  className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors hover:rotate-90 duration-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                {/* Device List */}
                <div className="mb-6 space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Devices</h4>
                  {ownedDevices.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-4 bg-slate-50 rounded-lg">No devices added yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {ownedDevices.map(id => (
                        <div key={id} 
                          className={`flex justify-between items-center rounded-lg border transition-all hover:scale-[1.02] ${selectedDeviceId === id ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-slate-100 hover:bg-slate-50'}`}
                        >
                          <div 
                            className="flex-1 flex items-center gap-3 p-3 cursor-pointer"
                            onClick={() => { setSelectedDeviceId(id); setShowDeviceManager(false); }}
                          >
                            <Smartphone className={`w-4 h-4 ${selectedDeviceId === id ? 'text-brand-600' : 'text-slate-400'}`} />
                            <span className={`text-sm font-medium ${selectedDeviceId === id ? 'text-brand-900' : 'text-slate-700'}`}>{id}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => handleDeleteDevice(e, id)}
                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors mr-1"
                            title="Remove Device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Device Form */}
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Add New Device</h4>
                  <form onSubmit={handleAddDevice} className="flex gap-2">
                    <input 
                      type="text" 
                      value={newDeviceId}
                      onChange={(e) => setNewDeviceId(e.target.value)}
                      placeholder="Enter Device ID"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                    <button 
                      type="submit" 
                      disabled={isAddingDevice || !newDeviceId.trim()}
                      className="bg-brand-500 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-md shadow-brand-100"
                    >
                      {isAddingDevice ? 'Adding...' : <><Plus className="w-4 h-4" /> Add</>}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Preset Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-pop">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-800">Save Configuration</h3>
                  <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl mb-4 text-sm text-slate-600 space-y-2">
                   <div className="flex justify-between"><span>Rice:</span> <span className="font-semibold">{formRice} cups</span></div>
                   <div className="flex justify-between"><span>Water:</span> <span className="font-semibold">{formWater} cups</span></div>
                   <div className="flex justify-between"><span>Time:</span> <span className="font-semibold">{formTime} mins</span></div>
                   <div className="flex justify-between"><span>Mode:</span> <span className="font-semibold capitalize">{formMode}</span></div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase">Preset Name</label>
                  <input 
                    type="text" 
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g. Saturday Night Sushi"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    autoFocus
                  />
                  <button 
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim()}
                    className="w-full bg-brand-500 text-white py-3 rounded-lg font-bold hover:bg-brand-600 disabled:opacity-50 transition-all shadow-md shadow-brand-200 mt-2"
                  >
                    Save Preset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};