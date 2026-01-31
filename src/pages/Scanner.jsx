import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { AlertCircle, Camera, CheckCircle, RefreshCw, ZoomIn, Lock } from 'lucide-react';

const ATTENDEE_COLLECTION = "rsvp_innovate_2026";

export default function Scanner() {
    const [scanResult, setScanResult] = useState(null);
    const [error, setError] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [currentCameraId, setCurrentCameraId] = useState(null);
    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const [modalData, setModalData] = useState(null); // For team selection

    // ... (Init effect remains the same, skipping for brevity in replacement if possible, but safely replacing block) ...
    // To safe space I will just replace `const ATTENDEE_COLLECTION` line and `handleScan` logic mostly. 
    // But since this tool replaces blocks, I'll replace the full component start to handleScan.

    // Initial Auth & Camera Setup
    useEffect(() => {
        async function init() {
            try {
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    setCameras(devices);
                    const backCam = devices.find(d => d.label.toLowerCase().includes('back'));
                    setCurrentCameraId(backCam ? backCam.id : devices[0].id);
                }
            } catch (err) {
                console.error("Init error:", err);
                setError("Failed to initialize scanner.");
            }
        }
        init();

        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(console.error);
            }
        };
    }, []);

    const startScanning = async () => {
        if (!currentCameraId) return;
        setError(null);
        setScanning(true);
        setScanResult(null);
        setModalData(null);

        try {
            const html5QrCode = new Html5Qrcode("reader");
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                currentCameraId,
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async (decodedText) => {
                    await handleScan(decodedText);
                    await html5QrCode.stop();
                    setScanning(false);
                },
                (errorMessage) => { }
            );
        } catch (err) {
            console.error("Start error:", err);
            setError("Failed to start camera.");
            setScanning(false);
        }
    };

    const stopScanning = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
            setScanning(false);
        }
    };

    const handleScan = async (barcode) => {
        try {
            const docRef = doc(db, ATTENDEE_COLLECTION, barcode);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const members = [];

                if (data.name) {
                    members.push({ name: data.name, field: 'checkedIn', status: !!data.checkedIn });
                } else {
                    if (data['Team Leader Name']) members.push({ name: data['Team Leader Name'] + " (Leader)", field: 'leader_checkedIn', status: !!data.leader_checkedIn });
                    for (let i = 1; i <= 5; i++) {
                        if (data[`Team Member ${i}`]) members.push({ name: data[`Team Member ${i}`], field: `member_${i}_checkedIn`, status: !!data[`member_${i}_checkedIn`] });
                    }
                }

                if (members.length === 0) {
                    setScanResult({
                        status: 'error',
                        message: 'Empty Record Found',
                        barcode
                    });
                } else if (members.length === 1) {
                    // Direct check-in for single
                    const mem = members[0];
                    if (mem.status) {
                        setScanResult({ status: 'duplicate', message: `${mem.name} already checked in!`, attendee: { name: mem.name, eventName: data.event_name } });
                    } else {
                        await updateDoc(docRef, { [mem.field]: true, [`${mem.field}_at`]: serverTimestamp() });
                        setScanResult({ status: 'success', message: `${mem.name} Checked In!`, attendee: { name: mem.name, eventName: data.event_name } });
                    }
                } else {
                    // Multiple Members - Show Selection Modal
                    setModalData({ id: barcode, eventName: data.event_name, members });
                }
            } else {
                setScanResult({
                    status: 'error',
                    message: 'Attendee not found.',
                    barcode
                });
            }
        } catch (err) {
            console.error("Scan process error:", err);
            setScanResult({ status: 'error', message: 'Error processing check-in.' });
        }
    };

    const checkInMember = async (memberIndex) => {
        try {
            const mem = modalData.members[memberIndex];
            await updateDoc(doc(db, ATTENDEE_COLLECTION, modalData.id), {
                [mem.field]: true,
                [`${mem.field}_at`]: serverTimestamp()
            });
            // Update local state to show it's done
            const newMems = [...modalData.members];
            newMems[memberIndex].status = true;
            setModalData({ ...modalData, members: newMems });
            // Optional: If you want to show a global success, or just let them keep clicking
        } catch (e) {
            alert("Error checking in " + modalData.members[memberIndex].name);
        }
    };

    const resetScan = () => {
        setScanResult(null);
        setModalData(null);
        startScanning();
    };

    if (modalData) {
        return (
            <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center">
                <h2 className="text-2xl font-bold mb-2">Select Attendee</h2>
                <p className="text-slate-400 mb-6">{modalData.eventName}</p>
                <div className="space-y-3 w-full max-w-md">
                    {modalData.members.map((m, i) => (
                        <button
                            key={i}
                            disabled={m.status}
                            onClick={() => checkInMember(i)}
                            className={`w-full p-4 rounded-xl flex justify-between items-center font-bold text-lg ${m.status ? 'bg-green-900/50 text-green-400 cursor-default' : 'bg-slate-700 hover:bg-indigo-600 transition-colors'}`}
                        >
                            <span>{m.name}</span>
                            {m.status && <CheckCircle size={20} />}
                        </button>
                    ))}
                </div>
                <button onClick={resetScan} className="mt-8 py-3 px-8 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700">Scan Next</button>
            </div>
        );
    }



    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-6 text-indigo-400">Event Scanner</h1>

            {/* Scanner View */}
            {!scanResult && (
                <div className="w-full max-w-md space-y-4">
                    <div id="reader" className="w-full bg-black rounded-lg overflow-hidden border-4 border-slate-700 min-h-[300px]"></div>

                    {!scanning ? (
                        <button onClick={startScanning} className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold flex items-center justify-center gap-2">
                            <Camera /> Start Scanner
                        </button>
                    ) : (
                        <button onClick={stopScanning} className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold">
                            Stop Scanner
                        </button>
                    )}

                    {cameras.length > 1 && !scanning && (
                        <select
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2"
                            onChange={(e) => setCurrentCameraId(e.target.value)}
                            value={currentCameraId || ''}
                        >
                            {cameras.map(cam => (
                                <option key={cam.id} value={cam.id}>{cam.label}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {/* Result View */}
            {scanResult && (
                <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300 ${scanResult.status === 'success' ? 'bg-green-600' :
                    scanResult.status === 'duplicate' ? 'bg-red-600' : 'bg-yellow-600'
                    }`}>
                    <div className="bg-white/10 p-6 rounded-full mb-6 backdrop-blur-sm">
                        {scanResult.status === 'success' && <CheckCircle size={64} />}
                        {scanResult.status === 'duplicate' && <AlertCircle size={64} />}
                        {scanResult.status === 'error' && <Lock size={64} />}
                    </div>

                    <h2 className="text-4xl font-bold mb-4">{scanResult.message}</h2>

                    {scanResult.attendee && (
                        <div className="bg-black/20 p-6 rounded-xl w-full max-w-sm mb-8">
                            <p className="text-sm opacity-75 uppercase tracking-wider mb-1">Name</p>
                            <p className="text-2xl font-bold mb-4">{scanResult.attendee.name}</p>
                            <p className="text-sm opacity-75 uppercase tracking-wider mb-1">Event</p>
                            <p className="text-xl font-medium">{scanResult.attendee.eventName}</p>
                        </div>
                    )}

                    <button
                        onClick={resetScan}
                        className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                    >
                        <RefreshCw /> Scan Next
                    </button>
                </div>
            )}

            {error && <div className="mt-4 text-red-400 bg-red-900/20 p-3 rounded">{error}</div>}
        </div>
    );
}
