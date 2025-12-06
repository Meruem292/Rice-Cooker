import React, { useState, useEffect } from 'react';
import { Play, Square, Sparkles, Send, Settings, Plus, Trash2, Smartphone, X, Utensils, Zap, Heart, Clock, Save, Droplets, Flame } from 'lucide-react';
import { ref, onValue, update, set, remove, push } from 'firebase/database';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { RiceCookerState } from '../types';
import { getSmartCookingAdvice } from '../services/geminiService';

interface DashboardProps {
  user: User;
}

const DEFAULT_PRESETS = [
  { id: 'white', name: 'Perfect White', rice: 2, ratio: 1.2, mode: 'white', time: 30 },
  { id: 'brown', name: 'Healthy Brown', rice: 2, ratio: 1.5, mode: 'brown', time: 60 },
  { id: 'sushi', name: 'Sushi Grade', rice: 3, ratio: 1.1, mode: 'sushi', time: 45 },
  { id: 'porridge', name: 'Morning Porridge', rice: 1, ratio: 4.0, mode: 'porridge', time: 90 },
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
  const [formRatio, setFormRatio] = useState(1.2);
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
      // If no selection, or current selection is no longer in the list (e.g. deleted)
      if (!selectedDeviceId || !ownedDevices.includes(selectedDeviceId)) {
        setSelectedDeviceId(ownedDevices[0]);
      }
    } else {
      if (selectedDeviceId) setSelectedDeviceId(null);
    }
  }, [ownedDevices, selectedDeviceId]);

  // 2. Fetch Selected Device Data and Sync Timer
  useEffect(() => {
    if (!selectedDeviceId) {
      setConnected(false);
      return;
    }

    const deviceRef = ref(db, `devices/${selectedDeviceId}`);
    const unsubscribe = onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Extract basic state
        const { schedules: _, ...rest } = data;
        
        // Timer Sync Logic: Calculate remaining time based on cookingEndTime if available
        let derivedTimeLeft = rest.timeLeftSeconds || 0;
        let shouldAutoStop = false;
        
        if (rest.status === 'cooking' && rest.cookingEndTime) {
           const now = Date.now();
           if (now >= rest.cookingEndTime) {
             shouldAutoStop = true;
             derivedTimeLeft = 0;
           } else {
             const remaining = Math.max(0, Math.ceil((rest.cookingEndTime - now) / 1000));
             derivedTimeLeft = remaining;
           }
        }

        if (shouldAutoStop) {
           // If time has passed but DB still says cooking, fix it immediately
           const updates: any = {
             status: 'warm',
             timeLeftSeconds: 0,
             cookingEndTime: null,
             command: {
               action: 'warm',
               timestamp: Date.now()
             }
           };
           update(ref(db, `devices/${selectedDeviceId}`), updates);
           
           // Update local state optimistically
           setDeviceState(prev => ({ 
             ...prev, 
             ...rest, 
             status: 'warm',
             timeLeftSeconds: 0,
             cookingEndTime: undefined
           }));
        } else {
           setDeviceState(prev => ({ 
             ...prev, 
             ...rest, 
             timeLeftSeconds: derivedTimeLeft 
           }));
        }
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

  // Simulation / Timer Logic
  useEffect(() => {
    let interval: any;

    if (deviceState.status === 'cooking') {
      // Check if finished
      if (deviceState.timeLeftSeconds <= 0) {
        handleStop();
      } else {
        // Run ticker
        interval = setInterval(() => {
          setDeviceState(prev => {
            // If we have an absolute end time, use it for accuracy and persistence
            if (prev.cookingEndTime) {
              const now = Date.now();
              const remaining = Math.max(0, Math.ceil((prev.cookingEndTime - now) / 1000));
              return { ...prev, timeLeftSeconds: remaining };
            }
            // Fallback for immediate UI feedback if no end time (legacy)
            return { ...prev, timeLeftSeconds: Math.max(0, prev.timeLeftSeconds - 1) };
          });
        }, 1000);
      }
    }
    
    return () => clearInterval(interval);
  }, [deviceState.status, deviceState.timeLeftSeconds, deviceState.cookingEndTime]);


  // Device Management Functions
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId.trim()) return;
    
    setIsAddingDevice(true);
    const id = newDeviceId.trim();
    
    try {
      // 1. Add to user's list
      await set(ref(db, `users/${user.uid}/ownedDevices/${id}`), {
        addedAt: Date.now()
      });

      // 2. Initialize device if it doesn't exist
      await update(ref(db, `devices/${id}`), {
        status: 'idle',
        riceLevel: 100,
        waterLevel: 100,
        mode: 'white',
        lastUpdated: Date.now()
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
    
    if (confirm(`Are you sure you want to remove device ${deviceId}?`)) {
      try {
        await remove(ref(db, `users/${user.uid}/ownedDevices/${deviceId}`));
        // Selection update is handled by the useEffect watching ownedDevices
      } catch (error) {
        console.error("Failed to remove device", error);
      }
    }
  };

  const handleApplyPreset = (preset: any) => {
    setFormRice(preset.rice);
    setFormRatio(preset.ratio);
    setFormMode(preset.mode);
    if (preset.time) setFormTime(preset.time);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    
    try {
      const newPreset = {
        name: newPresetName,
        rice: formRice,
        ratio: formRatio,
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

  // Control Functions
  const handleDispense = async () => {
    if (!selectedDeviceId) return;
    const now = Date.now();
    
    // Send command to Firebase for the device to pick up - Dispense Only
    const firebaseUpdates = {
      command: {
        action: 'dispense',
        riceCups: formRice,
        waterRatio: formRatio,
        timestamp: now
      }
    };
    
    await update(ref(db, `devices/${selectedDeviceId}`), firebaseUpdates);
  };

  const handleCook = async () => {
    if (!selectedDeviceId) return;
    const totalTime = formTime * 60; 
    const now = Date.now();
    const endTime = now + (totalTime * 1000);
    
    // Send command to Firebase - Cook Only
    const firebaseUpdates = {
      status: 'cooking',
      timeLeftSeconds: totalTime,
      totalTimeSeconds: totalTime,
      cookingEndTime: endTime,
      mode: formMode,
      command: {
        action: 'cook',
        cookingTime: totalTime,
        mode: formMode,
        timestamp: now
      }
    };

    // Update local state for immediate feedback
    const localUpdates: Partial<RiceCookerState> = {
      status: 'cooking',
      timeLeftSeconds: totalTime,
      totalTimeSeconds: totalTime,
      cookingEndTime: endTime,
      mode: formMode as any
    };
    
    setDeviceState(prev => ({ ...prev, ...localUpdates }));
    await update(ref(db, `devices/${selectedDeviceId}`), firebaseUpdates);
  };

  const handleStartAI = async (config: any) => {
     if (!selectedDeviceId) return;
     const totalTime = config.time || 1800;
     const now = Date.now();
     const endTime = now + (totalTime * 1000);
     const mode = config.mode || 'white';

     const updates: any = {
       status: 'cooking',
       timeLeftSeconds: totalTime,
       totalTimeSeconds: totalTime,
       cookingEndTime: endTime,
       mode: mode,
       command: {
        action: 'cook',
        cookingTime: totalTime,
        mode: mode,
        timestamp: now
       }
     };

     const localUpdates: Partial<RiceCookerState> = {
        status: 'cooking',
        timeLeftSeconds: totalTime,
        totalTimeSeconds: totalTime,
        cookingEndTime: endTime,
        mode: mode as any
     };

     setDeviceState(prev => ({ ...prev, ...localUpdates }));
     await update(ref(db, `devices/${selectedDeviceId}`), updates);
  };

  const handleStop = async () => {
    if (!selectedDeviceId) return;
    const updates: Partial<RiceCookerState> = {
      status: 'warm',
      timeLeftSeconds: 0,
      cookingEndTime: null as any
    };
    const firebaseUpdates = {
      ...updates,
      command: {
        action: 'warm', // Explicitly switch to warm as requested
        timestamp: Date.now()
      }
    };
    setDeviceState(prev => ({ ...prev, ...updates }));
    await update(ref(db, `devices/${selectedDeviceId}`), firebaseUpdates);
  };

  const handleAskAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse(null);

    try {
      const advice = await getSmartCookingAdvice(aiPrompt);
      setAiResponse({
        message: `I've configured the cooker for ${advice.riceCups} cups of rice with a ${advice.waterRatio} water ratio using ${advice.mode} mode. ${advice.explanation}`,
        config: {
          time: advice.estimatedTimeMinutes * 60,
          mode: advice.mode
        }
      });
      // Auto-populate form with AI suggestion
      setFormRice(advice.riceCups);
      setFormRatio(advice.waterRatio);
      setFormMode(advice.mode);
      if (advice.estimatedTimeMinutes) setFormTime(advice.estimatedTimeMinutes);
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
                   {deviceState.status === 'cooking' && (
                     <div className="absolute inset-0 bg-brand-50 opacity-50 animate-pulse-soft"></div>
                   )}
                   
                   <div className="relative z-10 w-64 h-64 flex-shrink-0 transition-transform duration-500 group-hover:scale-105">
                      {/* SVG Circle Progress */}
                      <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 256 256">
                        <circle cx="128" cy="128" r="120" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                        <circle 
                          cx="128" cy="128" r="120" 
                          stroke="#E2852E" 
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
                        <span className="text-slate-500 mt-2 text-sm uppercase tracking-wider font-semibold">Remaining</span>
                      </div>
                   </div>

                   <div className="flex gap-4 z-10">
                     {deviceState.status !== 'cooking' ? (
                       <button 
                        onClick={handleCook}
                        className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-brand-200 transition-all transform hover:scale-105 active:scale-95 hover:shadow-brand-300">
                         <Play className="w-5 h-5 fill-current" /> Start Cook ({formMode})
                       </button>
                     ) : (
                       <button 
                        onClick={handleStop}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 hover:shadow-xl">
                         <Square className="w-5 h-5 fill-current" /> Stop
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
                    <button onClick={() => handleStartAI(aiResponse.config)} className="mt-2 w-full bg-brand-500 hover:bg-brand-600 text-white text-xs py-2 rounded-lg transition-all transform active:scale-95 shadow-md shadow-brand-200">
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
                          className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-slate-300"
                        >
                          {preset.name}
                        </button>
                      ))}
                      {customPresets.map(preset => (
                        <div key={preset.id} className="relative group/preset">
                          <button
                            onClick={() => handleApplyPreset(preset)}
                            className="px-3 py-1.5 text-xs font-medium rounded-full bg-brand-50 hover:bg-brand-100 text-brand-700 transition-all hover:scale-105 active:scale-95 border border-brand-100 pr-6"
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
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-full transition-all hover:scale-105 shadow-md"
                    >
                      <Save className="w-3 h-3" /> Save Config
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {/* Left Column: Sliders and Mode */}
                  <div className="space-y-8 px-2">
                    <div className="group">
                      <label className="flex justify-between text-sm font-medium text-slate-700 mb-3 group-hover:text-brand-700 transition-colors">
                        Rice Amount <span className="text-brand-600 font-bold bg-brand-100 px-2 py-0.5 rounded-md">{formRice} Cups</span>
                      </label>
                      <input 
                        type="range" min="1" max="5" step="0.5" 
                        value={formRice} onChange={(e) => setFormRice(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:accent-brand-600 transition-all"
                      />
                    </div>
                    
                    <div className="group">
                      <label className="flex justify-between text-sm font-medium text-slate-700 mb-3 group-hover:text-water-600 transition-colors">
                        Water Ratio <span className="text-water-700 font-bold bg-water-100 px-2 py-0.5 rounded-md">{formRatio}x ({(formRice * formRatio).toFixed(1)} Cups)</span>
                      </label>
                      <input 
                        type="range" min="1" max="2.5" step="0.1" 
                        value={formRatio} onChange={(e) => setFormRatio(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-water-500 hover:accent-water-600 transition-all"
                      />
                    </div>

                    <div className="group">
                      <label className="flex justify-between text-sm font-medium text-slate-700 mb-3 group-hover:text-brand-400 transition-colors">
                        Cooking Duration <span className="text-brand-500 font-bold bg-brand-50 px-2 py-0.5 rounded-md">{formTime} Mins</span>
                      </label>
                      <input 
                        type="range" min="20" max="120" step="5" 
                        value={formTime} onChange={(e) => setFormTime(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-300 hover:accent-brand-400 transition-all"
                      />
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
                      <p className="text-lg font-medium text-slate-500 transition-all duration-300 key={formRatio}">+ {(formRice * formRatio).toFixed(1)} Cups Water</p>
                      <p className="text-sm font-semibold text-brand-600 mt-2 bg-brand-50 inline-block px-3 py-1 rounded-full">{formTime} Minutes Cycle</p>
                    </div>
                    
                    {deviceState.status === 'cooking' ? (
                       <button 
                        disabled
                        className="w-full max-w-sm flex items-center justify-center gap-3 bg-slate-200 text-slate-400 py-4 rounded-xl font-bold cursor-not-allowed opacity-75 relative z-10"
                      >
                        <Zap className="w-5 h-5 animate-pulse" /> Currently Cooking
                      </button>
                    ) : (
                      <div className="w-full max-w-sm flex flex-col gap-3 relative z-10">
                        <button 
                          onClick={handleDispense}
                          className="w-full flex items-center justify-center gap-3 bg-water-500 hover:bg-water-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-water-200 transition-all transform hover:scale-105 active:scale-95 group/dispense relative overflow-hidden"
                        >
                          <Droplets className="w-5 h-5 relative z-10" /> 
                          <span className="relative z-10">Dispense Only</span>
                        </button>

                        <button 
                          onClick={handleCook}
                          className="w-full flex items-center justify-center gap-3 bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-brand-200 transition-all transform hover:scale-105 active:scale-95 group/cook relative overflow-hidden"
                        >
                          <Flame className="w-5 h-5 relative z-10" /> 
                          <span className="relative z-10">Start Cooking</span>
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-4 max-w-xs mx-auto relative z-10">
                      Dispense ingredients first, then start the cooking cycle.
                    </p>
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
                          onClick={() => { setSelectedDeviceId(id); setShowDeviceManager(false); }}
                          className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${selectedDeviceId === id ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-slate-100 hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <Smartphone className={`w-4 h-4 ${selectedDeviceId === id ? 'text-brand-600' : 'text-slate-400'}`} />
                            <span className={`text-sm font-medium ${selectedDeviceId === id ? 'text-brand-900' : 'text-slate-700'}`}>{id}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => handleDeleteDevice(e, id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
                   <div className="flex justify-between"><span>Water Ratio:</span> <span className="font-semibold">{formRatio}x</span></div>
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