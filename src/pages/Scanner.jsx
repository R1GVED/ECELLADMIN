import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, getDocs, query, where, collection, runTransaction } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { AlertCircle, Camera, CheckCircle, RefreshCw, ZoomIn, Lock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ATTENDEE_COLLECTION = "rsvp_innovate_2026";

export default function Scanner() {
    const [scanResult, setScanResult] = useState(null);
    const [error, setError] = useState(null);
    const [scanning, setScanning] = useState(false);
    const navigate = useNavigate();
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

    const handleScan = async (scannedBarcode) => {
        try {
            // Strip the IFI2026- prefix if present
            const barcode = scannedBarcode.startsWith("IFI2026-")
                ? scannedBarcode.replace("IFI2026-", "")
                : scannedBarcode;

            // Strategy 1: Direct Document ID Lookup
            let docRef = doc(db, ATTENDEE_COLLECTION, barcode);
            let docSnap = await getDoc(docRef);
            let parentDocId = barcode;
            let foundData = null;

            if (docSnap.exists()) {
                foundData = docSnap.data();
            } else {
                // Strategy 2: Query by Root ticketId (if barcode is ticketId but not DocID)
                // Note: User data suggests ticketId might be unique.
                const q = query(collection(db, ATTENDEE_COLLECTION), where("ticketId", "==", barcode));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    foundData = querySnap.docs[0].data();
                    parentDocId = querySnap.docs[0].id;
                }
            }

            // Strategy 3: Brute-force Members Array Search (Fallback)
            // Limitations: Slow for large collections, but necessary without array-contains-object query structure
            if (!foundData) {
                const allDocs = await getDocs(collection(db, ATTENDEE_COLLECTION));
                for (const d of allDocs.docs) {
                    const dData = d.data();
                    if (Array.isArray(dData.members)) {
                        const match = dData.members.find(m => m.ticketId === barcode);
                        if (match) {
                            foundData = dData;
                            parentDocId = d.id;
                            break;
                        }
                    }
                }
            }

            if (foundData) {
                // Now parse the found document (same logic as Dashboard)
                const members = [];
                const eventName = foundData.event || foundData.eventName || "Event";

                // Check Root (Leader)
                if (foundData.ticketId === barcode || foundData.name) {
                    // If barcode matches leader ticket OR if we found doc by some other means and want to offer leader check-in
                    // Logic: If scanned specific member ticket, only show that member?
                    // Current logic: Show Selection if multiple, or simple check-in if single match.

                    // Let's build the list of ALL possible people in this doc to allow selection, 
                    // OR intelligently highlight the one that was scanned.

                    // Add Leader
                    if (foundData.name) {
                        const isTarget = (foundData.ticketId === barcode || parentDocId === barcode);
                        members.push({
                            name: foundData.name + " (Leader)",
                            field: 'checkedIn',
                            status: !!foundData.checkedIn,
                            isLeader: true,
                            index: -1,
                            isTarget: isTarget
                        });
                    }
                }

                // Add Members
                if (Array.isArray(foundData.members)) {
                    foundData.members.forEach((m, idx) => {
                        const isTarget = m.ticketId === barcode;
                        members.push({
                            name: m.name + " (Member)",
                            field: 'member', // signal to use array update
                            status: !!m.checkedIn,
                            isLeader: false,
                            index: idx,
                            isTarget: isTarget
                        });
                    });
                }

                // Filter? 
                // If we found the doc via a specific Member Ticket ID, we should probably auto-select that member?
                const targetMember = members.find(m => m.isTarget);

                if (targetMember) {
                    // Exact match found! 
                    if (targetMember.status) {
                        setScanResult({
                            status: 'duplicate',
                            message: `${targetMember.name} already checked in!`,
                            attendee: { name: targetMember.name, eventName: eventName }
                        });
                    } else {
                        // Perform Check In
                        await performCheckIn(parentDocId, targetMember, foundData);
                        setScanResult({
                            status: 'success',
                            message: `${targetMember.name} Checked In!`,
                            attendee: { name: targetMember.name, eventName: eventName }
                        });
                    }
                } else {
                    // Scan matched the Doc/Team but not a specific ticket? Or fallback to Team View.
                    setModalData({ id: parentDocId, eventName: eventName, members });
                }

            } else {
                setScanResult({
                    status: 'error',
                    message: 'Attendee NOT found.',

                    barcode
                });
            }
        } catch (err) {
            console.error("Scan process error:", err);
            setScanResult({ status: 'error', message: 'Error processing check-in.' });
        }
    };

    const performCheckIn = async (docId, memberObj, fullDocData) => {
        const docRef = doc(db, ATTENDEE_COLLECTION, docId);

        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            if (!sfDoc.exists()) throw "Document does not exist!";

            const data = sfDoc.data();

            if (memberObj.isLeader) {
                transaction.update(docRef, {
                    checkedIn: true,
                    checkInTime: serverTimestamp()
                });
            } else {
                const updatedMembers = [...(data.members || [])];
                if (updatedMembers[memberObj.index]) {
                    updatedMembers[memberObj.index] = {
                        ...updatedMembers[memberObj.index],
                        checkedIn: true,
                        checkInTime: new Date().toISOString()
                    };
                    transaction.update(docRef, { members: updatedMembers });
                } else {
                    throw "Member not found";
                }
            }
        });
    };

    const checkInMember = async (memberIndex) => {
        try {
            const mem = modalData.members[memberIndex];
            // We need fullDocData for array update, but we can assume modalData has context or re-fetch?
            // Re-fetch to be safe and simple
            const docRef = doc(db, ATTENDEE_COLLECTION, modalData.id);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                await performCheckIn(modalData.id, mem, snap.data());

                // Update local state
                const newMems = [...modalData.members];
                newMems[memberIndex].status = true;
                setModalData({ ...modalData, members: newMems });
            }
        } catch (e) {
            alert("Error checking in " + modalData.members[memberIndex].name);
            console.error(e);
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

            <div className="w-full max-w-md flex items-center justify-between mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                >
                    <ArrowLeft size={24} className="text-slate-300" />
                </button>
                <h1 className="text-2xl font-bold text-indigo-400">Event Scanner</h1>
                <div className="w-10"></div> {/* Spacer for centering */}
            </div>

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
