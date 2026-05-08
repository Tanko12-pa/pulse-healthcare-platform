import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  Users, 
  Settings, 
  Monitor, 
  ShieldCheck,
  User,
  Loader2,
  PhoneCall,
  Circle,
  Square,
  Play,
  Download,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  getDoc, 
  serverTimestamp, 
  setDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface TelehealthProps {
  userId: string;
  isAdmin: boolean;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function Telehealth({ userId, isAdmin }: TelehealthProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [availableCalls, setAvailableCalls] = useState<any[]>([]);
  const [callError, setCallError] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [cameraStatus, setCameraStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isJoining, setIsJoining] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isJoined) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isJoined]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Listen for available calls (for doctors)
    const q = query(
      collection(db, 'calls'),
      where('status', 'in', ['pending', 'waiting']),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableCalls(calls);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'calls');
    });

    // Listen for recordings
    const recordingsQ = query(
      collection(db, 'recordings'),
      where(isAdmin ? 'doctorId' : 'patientId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const recordingsUnsubscribe = onSnapshot(recordingsQ, (snapshot) => {
      const recs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecordings(recs);
    });

    return () => {
      unsubscribe();
      recordingsUnsubscribe();
      cleanup();
    };
  }, [userId, isAdmin]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!navigator.permissions || !navigator.permissions.query) {
        return;
      }

      try {
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        const camPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });

        setMicStatus(micPermission.state as any);
        setCameraStatus(camPermission.state as any);

        micPermission.onchange = () => setMicStatus(micPermission.state as any);
        camPermission.onchange = () => setCameraStatus(camPermission.state as any);
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    };

    checkPermissions();
  }, []);

  const cleanup = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    if (pc.current) {
      pc.current.ontrack = null;
      pc.current.onicecandidate = null;
      pc.current.close();
      pc.current = null;
    }
    setIsJoined(false);
    setIsWaiting(false);
    setIsJoining(false);
    setActiveCallId(null);
    if (isRecording) stopRecording();
  };

  const setupPeerConnection = async () => {
    if (pc.current) {
      pc.current.close();
    }
    pc.current = new RTCPeerConnection(servers);
    remoteStream.current = new MediaStream();

    localStream.current?.getTracks().forEach((track) => {
      pc.current?.addTrack(track, localStream.current!);
    });

    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.current?.addTrack(track);
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream.current;
      }
    };

    pc.current.onconnectionstatechange = () => {
      if (pc.current?.connectionState === 'disconnected' || pc.current?.connectionState === 'failed') {
        cleanup();
      }
    };
  };

  const startLocalStream = async () => {
    try {
      setCallError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStream.current = stream;
      setMicStatus('granted');
      setCameraStatus('granted');
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      
      let message = 'Could not access camera or microphone.';
      
      if (error.name === 'NotAllowedError' || error.message?.includes('Permission') || error.message?.includes('denied')) {
        message = 'Camera or microphone access was denied or dismissed. Please click the camera icon in your browser address bar to reset permissions.';
        setMicStatus('denied');
        setCameraStatus('denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message = 'No camera or microphone found on your device.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        message = 'Camera or microphone is already in use by another application.';
      }
      
      setCallError(message);
      throw error;
    }
  };

  const handleCreateCall = async () => {
    setIsConnecting(true);
    try {
      await startLocalStream();
      await setupPeerConnection();

      const callDoc = doc(collection(db, 'calls'));
      const offerCandidates = collection(callDoc, 'offerCandidates');
      const answerCandidates = collection(callDoc, 'answerCandidates');

      pc.current!.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };

      const offerDescription = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await setDoc(callDoc, {
        hostId: userId,
        offer,
        status: isAdmin ? 'pending' : 'waiting',
        createdAt: serverTimestamp(),
      });

      setActiveCallId(callDoc.id);

      onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (!pc.current!.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.current!.setRemoteDescription(answerDescription);
          setIsJoined(true);
          setIsWaiting(false);
        }
        
        // Remote stats
        if (data) {
          if (isAdmin) {
            setIsRemoteMuted(!!data.patientMuted);
            setIsRemoteVideoOff(!!data.patientVideoOff);
          } else {
            setIsRemoteMuted(!!data.doctorMuted);
            setIsRemoteVideoOff(!!data.doctorVideoOff);
          }
        }

        if (data?.status === 'ended') {
          cleanup();
        }
      });

      onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            pc.current!.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });

      if (!isAdmin) {
        setIsWaiting(true);
      }
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        handleFirestoreError(error, OperationType.WRITE, 'calls');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleJoinCall = async (callId: string) => {
    setIsJoining(true);
    try {
      await startLocalStream();
      await setupPeerConnection();

      const callDoc = doc(db, 'calls', callId);
      const answerCandidates = collection(callDoc, 'answerCandidates');
      const offerCandidates = collection(callDoc, 'offerCandidates');

      pc.current!.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(answerCandidates, event.candidate.toJSON());
        }
      };

      const callData = (await getDoc(callDoc)).data();
      const offerDescription = callData?.offer;
      await pc.current!.setRemoteDescription(new RTCSessionDescription(offerDescription));

      const answerDescription = await pc.current!.createAnswer();
      await pc.current!.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await updateDoc(callDoc, { 
        answer, 
        status: 'active',
        participantId: userId 
      });

      onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            pc.current!.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });

      onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        
        // Remote stats
        if (data) {
          if (isAdmin) {
            setIsRemoteMuted(!!data.patientMuted);
            setIsRemoteVideoOff(!!data.patientVideoOff);
          } else {
            setIsRemoteMuted(!!data.doctorMuted);
            setIsRemoteVideoOff(!!data.doctorVideoOff);
          }
        }

        if (data?.status === 'ended') {
          cleanup();
        }
      });

      setActiveCallId(callId);
      setIsJoined(true);
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        handleFirestoreError(error, OperationType.WRITE, 'calls');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (activeCallId) {
      await updateDoc(doc(db, 'calls', activeCallId), { status: 'ended' });
    }
    cleanup();
  };

  const toggleMute = async () => {
    if (localStream.current && activeCallId) {
      const newMuted = !isMuted;
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
      setIsMuted(newMuted);
      
      try {
        await updateDoc(doc(db, 'calls', activeCallId), {
          [isAdmin ? 'doctorMuted' : 'patientMuted']: newMuted
        });
      } catch (error) {
        console.error('Error updating mute state:', error);
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream.current && activeCallId) {
      const newVideoOff = !isVideoOff;
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = !newVideoOff;
      });
      setIsVideoOff(newVideoOff);

      try {
        await updateDoc(doc(db, 'calls', activeCallId), {
          [isAdmin ? 'doctorVideoOff' : 'patientVideoOff']: newVideoOff
        });
      } catch (error) {
        console.error('Error updating video state:', error);
      }
    }
  };

  const startRecording = () => {
    if (!localStream.current || !remoteStream.current) return;

    // Combine local and remote streams for recording
    const combinedStream = new MediaStream();
    localStream.current.getTracks().forEach(t => combinedStream.addTrack(t));
    remoteStream.current.getTracks().forEach(t => combinedStream.addTrack(t));

    recordedChunks.current = [];
    mediaRecorder.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });

    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };

    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // In a real app, you'd upload this blob to Firebase Storage
      // For this demo, we'll store the local URL and metadata in Firestore
      // AND notify our backend
      if (activeCallId) {
        try {
          const callData = (await getDoc(doc(db, 'calls', activeCallId))).data();
          const recordingData = {
            callId: activeCallId,
            patientId: isAdmin ? callData?.participantId || 'unknown' : userId,
            doctorId: isAdmin ? userId : callData?.hostId || 'unknown',
            url: url, // In real app, this would be the Storage download URL
            duration: 0, // Calculate duration if needed
            createdAt: serverTimestamp()
          };

          await addDoc(collection(db, 'recordings'), recordingData);

          // Notify backend
          const idToken = await auth.currentUser?.getIdToken();
          await fetch('/api/telehealth/recordings', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              callId: activeCallId,
              recordingUrl: url,
              duration: 0
            })
          });
        } catch (error) {
          console.error('Error saving recording metadata:', error);
        }
      }
    };

    mediaRecorder.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Telehealth</h2>
          <p className="text-slate-500 font-medium">Secure, high-definition video consultations with your healthcare providers.</p>
        </div>
        
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-xl">
          <ShieldCheck size={16} />
          End-to-End Encrypted
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="aspect-video bg-slate-900 rounded-[40px] relative overflow-hidden shadow-2xl group border-4 border-slate-800">
            <AnimatePresence mode="wait">
              {!isJoined && !isWaiting ? (
                <motion.div 
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {isConnecting ? (
                    <div className="text-center space-y-4">
                      <Loader2 size={48} className="text-blue-500 animate-spin mx-auto" />
                      <p className="text-white font-bold text-lg">Connecting to secure server...</p>
                    </div>
                  ) : callError ? (
                    <div className="text-center space-y-4 p-8">
                      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mx-auto">
                        <VideoOff size={32} />
                      </div>
                      <p className="text-white font-bold text-lg">{callError}</p>
                      <button 
                        onClick={() => setCallError(null)}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-bold text-sm"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur-md">
                      <Video size={48} />
                    </div>
                  )}
                </motion.div>
              ) : isWaiting ? (
                <motion.div 
                  key="waiting-room"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center bg-slate-800"
                >
                  <div className="text-center space-y-6 max-w-md p-8">
                    <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-500 mx-auto animate-pulse">
                      <Clock size={48} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-2xl font-bold text-white">Virtual Waiting Room</h4>
                      <p className="text-slate-400 font-medium">Please stay on this screen. Your provider will join the consultation shortly.</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                      Secure Connection Active
                    </div>
                    <button 
                      onClick={handleLeave}
                      className="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all font-bold"
                    >
                      Leave Waiting Room
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="active-call"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-slate-900"
                >
                  {/* Remote Video Stream */}
                  <video 
                    ref={remoteVideoRef}
                    autoPlay 
                    playsInline 
                    className={`w-full h-full object-cover ${isRemoteVideoOff ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
                  />
                  
                  {(isRemoteVideoOff || !remoteVideoRef.current?.srcObject) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <div className="text-center space-y-4">
                        <div className="w-32 h-32 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-500 mx-auto transition-transform duration-500 scale-110">
                          {isRemoteVideoOff ? <VideoOff size={64} /> : <User size={64} />}
                        </div>
                        <p className="text-white font-bold text-xl">
                          {isAdmin ? 'Awaiting Patient...' : 'Dr. Sarah Miller'}
                          {isRemoteVideoOff && <span className="block text-sm text-slate-400 font-normal mt-1">Video Paused</span>}
                        </p>
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
                              Live • Connected
                            </span>
                            {isRemoteMuted && (
                              <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30 flex items-center gap-1">
                                <MicOff size={10} />
                                Muted
                              </span>
                            )}
                          </div>
                          <span className="text-white/60 font-mono text-sm tabular-nums">
                            {formatDuration(callDuration)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Self View */}
                  <div className="absolute top-8 right-8 w-48 aspect-video bg-slate-700 rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden group/self">
                    <video 
                      ref={localVideoRef}
                      autoPlay 
                      playsInline 
                      muted 
                      className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                    />
                    {isVideoOff && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white/20">
                        <VideoOff size={32} />
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded text-[10px] text-white font-bold opacity-0 group-hover/self:opacity-100 transition-opacity">
                      You
                    </div>
                  </div>

                  {/* Recording Indicator */}
                  {isRecording && (
                    <div className="absolute top-8 left-8 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                      <Circle size={12} fill="currentColor" />
                      REC
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-4">
                <button 
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white backdrop-blur-md transition-all ${
                    isMuted ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button 
                  onClick={toggleVideo}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white backdrop-blur-md transition-all ${
                    isVideoOff ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>
                {isJoined && (
                  <>
                    <button 
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white backdrop-blur-md transition-all ${
                        isRecording ? 'bg-red-600 animate-pulse' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      {isRecording ? <Square size={24} /> : <Circle size={24} />}
                    </button>
                    <button 
                      onClick={handleLeave}
                      className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                    >
                      <PhoneOff size={24} />
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md hover:bg-white/20 transition-all">
                  <MessageSquare size={24} />
                </button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md hover:bg-white/20 transition-all">
                  <Users size={24} />
                </button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md hover:bg-white/20 transition-all">
                  <Settings size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900">
              {isAdmin ? 'Active Consultations' : 'Virtual Waiting Room'}
            </h3>
            <div className="space-y-4">
              {isAdmin ? (
                availableCalls.length > 0 ? (
                  availableCalls.map(call => (
                    <div key={call.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                          <User size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">Patient Consultation</h4>
                          <p className="text-xs text-slate-500 font-medium">ID: {call.id.slice(0, 8)}</p>
                          {call.status === 'waiting' && (
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">In Waiting Room</span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleJoinCall(call.id)}
                        disabled={isJoining}
                        className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {isJoining ? <Loader2 size={20} className="animate-spin" /> : <PhoneCall size={20} />}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm font-medium">No active patient requests</p>
                  </div>
                )
              ) : (
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Monitor size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Dr. Sarah Miller</h4>
                    <p className="text-xs text-slate-500 font-medium">Cardiologist • Online</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4 pt-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Check</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 font-medium">Microphone</span>
                    <span className={`font-bold ${
                      micStatus === 'granted' ? 'text-emerald-500' : 
                      micStatus === 'denied' ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {micStatus === 'granted' ? 'Connected' : 
                       micStatus === 'denied' ? 'Blocked' : 'Awaiting Access'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 font-medium">Camera</span>
                    <span className={`font-bold ${
                      cameraStatus === 'granted' ? 'text-emerald-500' : 
                      cameraStatus === 'denied' ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {cameraStatus === 'granted' ? 'Connected' : 
                       cameraStatus === 'denied' ? 'Blocked' : 'Awaiting Access'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 font-medium">Internet Speed</span>
                    <span className="text-emerald-500 font-bold">Excellent</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recordings Section */}
          {recordings.length > 0 && (
            <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
              <h3 className="text-xl font-bold text-slate-900">Past Recordings</h3>
              <div className="space-y-4">
                {recordings.map(rec => (
                  <div key={rec.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                        <Play size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Consultation Recording</p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {rec.createdAt?.toDate().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <a 
                      href={rec.url} 
                      download={`recording-${rec.id}.webm`}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-all"
                    >
                      <Download size={18} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!isJoined && !isWaiting && (
            <button 
              onClick={handleCreateCall}
              disabled={isConnecting}
              className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-bold text-lg transition-all shadow-2xl shadow-blue-100 flex items-center justify-center gap-3"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                isAdmin ? 'Start New Consultation' : 'Request Consultation'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
