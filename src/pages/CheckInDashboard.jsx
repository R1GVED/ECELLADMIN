import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, writeBatch, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import QRCode from 'qrcode'; // using npm package
import { LogOut, UserPlus, Trash2, Edit2, QrCode, ClipboardList, Save, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ATTENDEE_COLLECTION = "rsvp_innovate_2026";

export default function CheckInDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [attendees, setAttendees] = useState([]);

    // UI States
    const [qrModal, setQrModal] = useState({ show: false, name: "", barcode: "", dataUrl: "" });
    const [editModal, setEditModal] = useState({ show: false, id: "", name: "", eventName: "" });
    const [debugMode, setDebugMode] = useState(false);
    const [rawDocs, setRawDocs] = useState([]);

    // Stats
    const stats = {
        total: attendees.length,
        checkedIn: attendees.filter(a => a.checkedIn).length,
        pending: attendees.filter(a => !a.checkedIn).length
    };

    // Listeners
    useEffect(() => {
        const q = query(collection(db, ATTENDEE_COLLECTION));
        const unsub = onSnapshot(q, (snap) => {
            const parsedList = [];

            // Capture raw docs for debug
            if (snap.size > 0) {
                const debugData = snap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }));
                setRawDocs(debugData);
            }

            snap.docs.forEach(doc => {
                const data = doc.data();
                const docId = doc.id;
                const eventName = data.event || data.eventName || "Innovate 2026";
                const teamName = data.team || "Individual";

                // 1. Leader (Root fields)
                if (data.name) {
                    parsedList.push({
                        id: docId, // Firestore Document ID
                        uniqueId: `${docId}_leader`, // React Key
                        name: data.name,
                        eventName: eventName,
                        barcode: data.ticketId || docId,
                        role: `Leader - ${teamName}`,
                        checkedIn: !!data.checkedIn,
                        isLeader: true,
                        // Helper for UI
                        team: teamName
                    });
                }

                // 2. Members (Nested Array)
                if (Array.isArray(data.members)) {
                    data.members.forEach((member, index) => {
                        if (member.name) {
                            parsedList.push({
                                id: docId, // Parent Doc ID (same for all members)
                                uniqueId: `${docId}_member_${index}`, // React Key
                                name: member.name,
                                eventName: eventName,
                                barcode: member.ticketId || "N/A",
                                role: `Member - ${teamName}`,
                                checkedIn: !!member.checkedIn,
                                isLeader: false,
                                memberIndex: index,
                                team: teamName
                            });
                        }
                    });
                }
            });

            parsedList.sort((a, b) => a.name?.localeCompare(b.name));
            setAttendees(parsedList);
        });

        return () => { unsub(); };
    }, []);


    // Actions
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const generateQR = async (attendee) => {
        try {
            const codeToEncode = attendee.barcode && attendee.barcode !== "N/A" ? attendee.barcode : attendee.id;
            const url = await QRCode.toDataURL(codeToEncode);
            setQrModal({ show: true, name: attendee.name, barcode: codeToEncode, dataUrl: url });
        } catch (err) {
            console.error(err);
        }
    };

    const toggleCheckIn = async (attendee) => {
        const action = attendee.checkedIn ? "Check OUT" : "Check IN";
        if (!confirm(`Are you sure you want to ${action} ${attendee.name}?`)) return;

        try {
            const docRef = doc(db, ATTENDEE_COLLECTION, attendee.id);

            // Case 1: Leader Check-in (Root Fields)
            if (attendee.isLeader) {
                await updateDoc(docRef, {
                    checkedIn: !attendee.checkedIn,
                    checkInTime: !attendee.checkedIn ? serverTimestamp() : null
                });
            }
            // Case 2: Member Check-in (Array Field)
            else {
                // Must read fresh data to modify array safely
                const snap = await getDoc(docRef);
                if (!snap.exists()) return;

                const data = snap.data();
                const updatedMembers = [...(data.members || [])];

                // Ensure index exists
                if (updatedMembers[attendee.memberIndex]) {
                    const currentStatus = !!updatedMembers[attendee.memberIndex].checkedIn;

                    updatedMembers[attendee.memberIndex] = {
                        ...updatedMembers[attendee.memberIndex],
                        checkedIn: !currentStatus,
                        checkInTime: !currentStatus ? new Date().toISOString() : null // Store string or timestamp
                    };

                    await updateDoc(docRef, { members: updatedMembers });
                }
            }
        } catch (err) {
            console.error(err);
            alert("Check-in failed: " + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <header className="sticky top-0 z-30 bg-slate-800 border-b border-slate-700 shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-indigo-400">Event Check-in Admin</h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setDebugMode(!debugMode)}
                            className="text-xs border border-yellow-600 text-yellow-500 px-2 py-1 rounded hover:bg-yellow-900/20"
                        >
                            {debugMode ? "Hide Debug" : "Debug Data"}
                        </button>
                        <button onClick={handleLogout} className="text-sm font-medium text-red-400 hover:text-red-300 flex items-center gap-2">
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">

                {debugMode && (
                    <div className="bg-black p-4 rounded-xl border border-yellow-600 mb-8 overflow-x-auto">
                        <h3 className="text-yellow-500 font-bold mb-2">Debugger - Fetched {rawDocs.length} Raw Docs</h3>
                        <pre className="text-xs text-green-400 font-mono">
                            {JSON.stringify(rawDocs, null, 2)}
                        </pre>
                    </div>
                )}

                <div className="space-y-8">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-900/50 border border-blue-700/50 p-6 rounded-xl shadow-lg">
                            <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-1">Total Passes</h3>
                            <p className="text-4xl font-extrabold text-white">{stats.total}</p>
                        </div>
                        <div className="bg-green-900/50 border border-green-700/50 p-6 rounded-xl shadow-lg">
                            <h3 className="text-sm font-bold text-green-300 uppercase tracking-wider mb-1">Checked In</h3>
                            <p className="text-4xl font-extrabold text-white">{stats.checkedIn}</p>
                        </div>
                        <div className="bg-yellow-900/50 border border-yellow-700/50 p-6 rounded-xl shadow-lg">
                            <h3 className="text-sm font-bold text-yellow-300 uppercase tracking-wider mb-1">Pending</h3>
                            <p className="text-4xl font-extrabold text-white">{stats.pending}</p>
                        </div>
                    </div>

                    {/* Add Functionality */}
                    <div className="grid lg:grid-cols-2 gap-8">
                        <AddAttendeeForm />
                        <BulkAddForm />
                    </div>

                    {/* List */}
                    <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-white">Attendee List</h2>
                            <span className="text-sm text-slate-400">{attendees.length} records</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Name</th>
                                        <th className="px-6 py-3">Team</th>
                                        <th className="px-6 py-3">Code</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {attendees.map(attendee => (
                                        <tr
                                            key={attendee.uniqueId}
                                            className={`transition-colors border-b border-slate-700/50 ${attendee.isLeader
                                                ? 'bg-blue-900/20 hover:bg-blue-900/30'
                                                : 'bg-yellow-900/10 hover:bg-yellow-900/20'
                                                }`}
                                        >
                                            <td className="px-6 py-4 font-medium text-white">
                                                {attendee.name}
                                                <span className={`text-xs block font-bold ${attendee.isLeader ? 'text-blue-400' : 'text-yellow-500'}`}>
                                                    {attendee.isLeader ? 'TEAM LEADER' : 'TEAM MEMBER'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300 font-medium">
                                                {attendee.team}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-sm text-slate-400">{attendee.barcode}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleCheckIn(attendee)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${attendee.checkedIn ? 'bg-green-600' : 'bg-slate-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${attendee.checkedIn ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 flex justify-center space-x-2">
                                                <button onClick={() => generateQR(attendee)} className="p-2 text-indigo-400 hover:bg-indigo-900/50 rounded-lg transition-colors" title="View QR"><QrCode size={18} /></button>
                                                <button onClick={() => setEditModal({ show: true, ...attendee })} className="p-2 text-blue-400 hover:bg-blue-900/50 rounded-lg transition-colors" title="Edit"><Edit2 size={18} /></button>
                                                <button onClick={() => deleteAttendee(attendee.id)} className="p-2 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors" title="Delete Parent Doc"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {attendees.length === 0 && <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No attendees found. Try 'Debug Data' button above.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </main>

            {/* QR Modal */}
            {qrModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-white mb-1">{qrModal.name}</h3>
                            <p className="text-sm font-mono text-slate-400 mb-6">{qrModal.barcode}</p>
                            <div className="bg-white p-4 rounded-xl inline-block mb-6">
                                <img src={qrModal.dataUrl} alt="QR Code" className="w-48 h-48" />
                            </div>
                            <button onClick={() => setQrModal({ ...qrModal, show: false })} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Edit Attendee</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                                <input className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={editModal.name} onChange={e => setEditModal({ ...editModal, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Event Name</label>
                                <input className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={editModal.eventName} onChange={e => setEditModal({ ...editModal, eventName: e.target.value })} />
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button onClick={() => setEditModal({ ...editModal, show: false })} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">Cancel</button>
                                <button onClick={() => alert("Edit not fully supported for nested members yet.")} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- SUB COMPONENTS ---

function AddAttendeeForm() {
    // Hidden for now since manual add needs to handle new structure
    return null;
}

function BulkAddForm() {
    // Hidden for now
    return null;
}

// Helpers
async function deleteAttendee(id) {
    if (!confirm("This will delete the ENTIRE TEAM. Continue?")) return;
    await deleteDoc(doc(db, ATTENDEE_COLLECTION, id));
}

async function updateAttendee(data) {
    // Complex update logic needed for array
}
