import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import CertificateCanvas from '../components/CertificateCanvas';
import { Download, Search, CheckCircle, AlertTriangle, Linkedin, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';

export default function CertificateClaim() {
    const [step, setStep] = useState(1); // 1: Login, 2: Verify, 3: Download
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [userData, setUserData] = useState(null);
    const [config, setConfig] = useState(null);

    // Correction State
    const [isCorrecting, setIsCorrecting] = useState(false);
    const [correctedName, setCorrectedName] = useState("");
    const [correctedEmail, setCorrectedEmail] = useState("");
    const [correctedTeam, setCorrectedTeam] = useState("");

    const canvasRef = useRef(null);

    useEffect(() => {
        // Realtime Certificate Config
        const docRef = doc(db, "certificate_templates", "innovate_2026_cert");
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setConfig(snap.data());
            } else {
                setError("Certificate validation is not yet active.");
            }
        }, (err) => {
            console.error("Config Listener Error", err);
        });

        return () => unsubscribe();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // 1. Search RSVP Collection
            const rsvpQ = query(collection(db, "rsvp_innovate_2026"), where("email", "==", email));
            const rsvpSnap = await getDocs(rsvpQ);

            if (!rsvpSnap.empty) {
                const docData = rsvpSnap.docs[0].data();
                setUserData({
                    id: rsvpSnap.docs[0].id,
                    collection: "rsvp_innovate_2026",
                    name: docData.name,
                    email: docData.email,
                    team: docData.team || "Individual",
                    role: "Participant", // Default
                    ...docData
                });
                setCorrectedName(docData.name);
                setCorrectedEmail(docData.email);
                setCorrectedTeam(docData.team || "Individual");
                setStep(2);
                setLoading(false);
                return;
            }

            // 2. Search Unstop Collection (Nested)
            const unstopQ = query(collection(db, "events", "innovate-for-impact", "attendees"), where("Candidate's Email", "==", email));
            const unstopSnap = await getDocs(unstopQ);

            if (!unstopSnap.empty) {
                const docData = unstopSnap.docs[0].data();
                // Map Unstop fields
                const name = docData["Candidate's Name"];
                const team = docData["Team Name"] || "Individual";
                const emailVal = docData["Candidate's Email"];

                setUserData({
                    id: unstopSnap.docs[0].id,
                    collection: "unstop",
                    name: name,
                    email: emailVal,
                    team: team,
                    role: docData["Candidate role"] || "Participant",
                    ...docData
                });
                setCorrectedName(name);
                setCorrectedEmail(emailVal);
                setCorrectedTeam(team);
                setStep(2);
            } else {
                setError("No registration found with this email. Please check your spelling.");
            }

        } catch (err) {
            console.error(err);
            if (err.message && err.message.includes("offline")) {
                setError("You appear to be offline. Please check your internet connection and try again.");
            } else {
                setError("An error occurred. Please try again.");
            }
        }
        setLoading(false);
    };

    const handleUpdateDetails = async () => {
        if (!correctedName.trim()) return;

        setLoading(true);
        try {
            const updates = {};

            if (userData.collection === 'unstop') {
                updates["Candidate's Name"] = correctedName;
                updates["Candidate's Email"] = correctedEmail;
                updates["Team Name"] = correctedTeam;
            } else {
                updates.name = correctedName;
                updates.email = correctedEmail;
                updates.team = correctedTeam;
            }

            // Perform Update
            if (userData.collection === 'unstop') {
                const docRef = doc(db, "events", "innovate-for-impact", "attendees", userData.id);
                await updateDoc(docRef, updates);
            } else {
                const docRef = doc(db, userData.collection, userData.id);
                await updateDoc(docRef, updates);
            }

            // Update Local State
            setUserData({
                ...userData,
                name: correctedName,
                email: correctedEmail,
                team: correctedTeam
            });

            // If email changed, update the login state for download filename consistency
            setEmail(correctedEmail);

            setIsCorrecting(false);
            // Stay on Step 2 to verify, or move to Step 3? User clicked "Save Changes", maybe just stay to verify?
            // User flow: Login -> Review -> Edit -> Save -> Review -> Generate.
            // So we stay on Step 2.
        } catch (err) {
            console.error(err);
            alert("Failed to update details: " + err.message);
        }
        setLoading(false);
    };

    const downloadJPG = () => {
        try {
            const canvas = document.querySelector('canvas');
            if (!canvas) return;

            const link = document.createElement('a');
            link.download = `Certificate_${userData.name.replace(/\s+/g, '_')}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        } catch (err) {
            console.error(err);
            alert("Error downloading image. This might be due to a CORS issue with the certificate template image. Please check console.");
        }
    };

    const downloadPDF = () => {
        try {
            const canvas = document.querySelector('canvas');
            if (!canvas) return;

            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
            pdf.save(`Certificate_${userData.name.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error(err);
            alert("Error generating PDF. This might be due to a CORS issue. Please check console.");
        }
    };

    const handleShareLinkedIn = async () => {
        const text = `I just received my certificate for participation in Innovate 2026! 🚀`;

        // 1. Try Native Web Share API (Mobile/Standard) - Supports Image
        if (navigator.share) {
            try {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
                    const file = new File([blob], 'certificate.jpg', { type: 'image/jpeg' });

                    await navigator.share({
                        title: 'Innovate 2026 Certificate',
                        text: text,
                        files: [file]
                    });
                    return; // Success
                }
            } catch (err) {
                console.log("Web Share API failed or cancelled", err);
                // Fallback continues...
            }
        }

        // 2. Fallback: Open LinkedIn Share URL (No Image attachment possible via URL)
        // We notify user to download first
        const confirm = window.confirm("To include the image on LinkedIn, please download it first, then attach it to your post.\n\nClick OK to open LinkedIn.");
        if (confirm) {
            const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        }
    };

    if (!config) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading configuration...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-12 px-4">

            <div className="max-w-md w-full mb-8 text-center">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
                    Certificate Portal
                </h1>
                <p className="text-slate-400">Get your Innovate 2026 Participation Certificate</p>
            </div>

            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-4xl transition-all">

                {/* STEP 1: LOGIN */}
                {step === 1 && (
                    <form onSubmit={handleLogin} className="max-w-sm mx-auto space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Registered Email Address</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all transform active:scale-95 shadow-lg shadow-indigo-600/20"
                        >
                            {loading ? "Searching..." : "Find My Certificate"}
                        </button>
                    </form>
                )}

                {/* STEP 2: VERIFY */}
                {step === 2 && userData && (
                    <div className="text-center max-w-lg mx-auto animate-fadeIn">
                        <div className="mb-6">
                            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Registration Found!</h2>
                            <p className="text-slate-400">Please verify your details. These will be printed on your certificate.</p>
                        </div>

                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 mb-6 text-left space-y-4">

                            {/* NAME */}
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">Name</label>
                                {isCorrecting ? (
                                    <input
                                        type="text"
                                        value={correctedName}
                                        onChange={e => setCorrectedName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 mt-1 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        maxLength={40}
                                    />
                                ) : (
                                    <div className="text-lg font-medium text-white">{userData.name}</div>
                                )}
                            </div>

                            {/* EMAIL (Read-only for identification, or allow edit if easy? User asked to fix mail id) */}
                            {/* Actually, if they change email, they might lose access if we re-query by email. 
                                But user explicitly asked: "fix the mail id". 
                                I will allow editing it, but warn them. */}
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">Email</label>
                                {isCorrecting ? (
                                    <input
                                        type="email"
                                        value={correctedEmail}
                                        onChange={e => setCorrectedEmail(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 mt-1 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                ) : (
                                    <div className="text-slate-300">{userData.email || userData["Candidate's Email"]}</div>
                                )}
                            </div>

                            {/* TEAM */}
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">Team / Organization</label>
                                {isCorrecting ? (
                                    <input
                                        type="text"
                                        value={correctedTeam}
                                        onChange={e => setCorrectedTeam(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 mt-1 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        maxLength={50}
                                    />
                                ) : (
                                    <div className="text-slate-300">{userData.team || "Individual"}</div>
                                )}
                            </div>

                            {!isCorrecting && (
                                <button
                                    onClick={() => setIsCorrecting(true)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-2"
                                >
                                    Edit Details
                                </button>
                            )}

                            {isCorrecting && (
                                <p className="text-xs text-yellow-500 mt-2">
                                    * Ensure all details are correct. This is what will appear on your certificate.
                                </p>
                            )}
                        </div>

                        <div className="flex gap-4">
                            {isCorrecting ? (
                                <>
                                    <button
                                        onClick={() => setIsCorrecting(false)}
                                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUpdateDetails}
                                        disabled={loading}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-green-600/20"
                                    >
                                        {loading ? "Saving..." : "Save Changes"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setStep(3)}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                >
                                    Generate Certificate <CheckCircle size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 3: PREVIEW & DOWNLOAD */}
                {step === 3 && userData && (
                    <div className="flex flex-col items-center animate-fadeIn">
                        <div className="mb-6 overflow-x-auto w-full flex justify-center">
                            <CertificateCanvas
                                templateUrl={config.imageUrl}
                                fields={config.fields}
                                data={userData}
                                width={800}
                                height={600}
                                className="max-w-full h-auto rounded-lg"
                                scale={window.innerWidth < 600 ? 0.4 : 0.8} // Responsive scale
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                            <button
                                onClick={downloadJPG}
                                className="py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Download size={18} /> Download JPG
                            </button>
                            <button
                                onClick={downloadPDF}
                                className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                            >
                                <Download size={18} /> Download PDF
                            </button>
                            <button
                                onClick={handleShareLinkedIn}
                                className="col-span-1 sm:col-span-2 py-3 px-6 bg-[#0077b5] hover:bg-[#006396] text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                            >
                                <Linkedin size={18} /> Share on LinkedIn
                            </button>
                        </div>

                        <button
                            onClick={() => { setStep(1); setUserData(null); }}
                            className="mt-8 text-slate-500 hover:text-slate-300 text-sm underline"
                        >
                            Start Over
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
