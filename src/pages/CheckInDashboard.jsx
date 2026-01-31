import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, writeBatch, deleteDoc, serverTimestamp, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import QRCode from 'qrcode'; // using npm package
import { LogOut, UserPlus, Trash2, Edit2, QrCode, ClipboardList, Save, Upload, Mars, Venus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ATTENDEE_COLLECTION = "rsvp_innovate_2026";

export default function CheckInDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('rsvp'); // 'rsvp' | 'unstop'
    const [attendeeGroups, setAttendeeGroups] = useState([]);
    const [unstopGroups, setUnstopGroups] = useState([]);

    // UI States
    const [qrModal, setQrModal] = useState({ show: false, name: "", barcode: "", dataUrl: "" });
    const [editModal, setEditModal] = useState({ show: false, id: "", name: "", eventName: "" });

    // Stats
    const currentList = activeTab === 'rsvp'
        ? attendeeGroups.flatMap(g => g.members)
        : unstopGroups.flatMap(g => g.members);

    const stats = {
        total: currentList.length,
        checkedIn: currentList.filter(a => a.checkedIn).length,
        pending: currentList.filter(a => !a.checkedIn).length
    };

    // Listeners
    useEffect(() => {
        const q = query(collection(db, ATTENDEE_COLLECTION));
        const unsub = onSnapshot(q, (snap) => {
            const groups = [];

            snap.docs.forEach(doc => {
                const data = doc.data();
                const docId = doc.id;
                const eventName = data.event || data.eventName || "Innovate 2026";
                const teamName = data.team || "Individual";
                const groupMembers = [];

                // 1. Leader (Root fields)
                if (data.name) {
                    groupMembers.push({
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
                            groupMembers.push({
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

                if (groupMembers.length > 0) {
                    groups.push({
                        id: docId,
                        teamName: teamName,
                        members: groupMembers
                    });
                }
            });

            groups.sort((a, b) => a.teamName.localeCompare(b.teamName));
            setAttendeeGroups(groups);
        });

        // Unstop Listener
        const unstopQ = query(collection(db, "events", "innovate-for-impact", "attendees"));
        const unstopUnsub = onSnapshot(unstopQ, (snap) => {
            const rawList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Group by Team ID
            const groups = {};
            rawList.forEach(attendee => {
                const teamKey = attendee["Team ID"] || attendee["Team Name"] || "Individual";
                const teamDisplay = attendee["Team Name"] || "Individual";

                if (!groups[teamKey]) {
                    groups[teamKey] = {
                        teamName: teamDisplay,
                        id: teamKey,
                        members: []
                    };
                }
                groups[teamKey].members.push(attendee);
            });

            const groupList = Object.values(groups);
            groupList.sort((a, b) => a.teamName.localeCompare(b.teamName));

            // Sort members within group by name
            groupList.forEach(g => {
                g.members.sort((a, b) => (a["Candidate's Name"] || "").localeCompare(b["Candidate's Name"] || ""));
            });

            setUnstopGroups(groupList);
        });

        return () => { unsub(); unstopUnsub(); };
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
            // UNSTOP LOGIC
            if (activeTab === 'unstop') {
                const docRef = doc(db, "events", "innovate-for-impact", "attendees", attendee.id);
                await updateDoc(docRef, {
                    checkedIn: !attendee.checkedIn,
                    checkInTime: !attendee.checkedIn ? serverTimestamp() : null
                });
                return;
            }

            // RSVP LOGIC
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
                const members = data.members || [];

                if (members[attendee.memberIndex]) {
                    members[attendee.memberIndex].checkedIn = !attendee.checkedIn;
                    members[attendee.memberIndex].checkInTime = !attendee.checkedIn ? new Date() : null;

                    await updateDoc(docRef, { members });
                }
            }
        } catch (err) {
            console.error(err);
            alert("Error updating status");
        }
    };

    const toggleCheckInSafe = async (attendee) => {
        const action = attendee.checkedIn ? "Check OUT" : "Check IN";
        if (!confirm(`Are you sure you want to ${action} ${attendee.name}?`)) return;

        try {
            if (activeTab === 'unstop') {
                const docRef = doc(db, "events", "innovate-for-impact", "attendees", attendee.id);
                await updateDoc(docRef, {
                    checkedIn: !attendee.checkedIn,
                    checkInTime: !attendee.checkedIn ? serverTimestamp() : null
                });
                return;
            }

            const docRef = doc(db, ATTENDEE_COLLECTION, attendee.id);
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(docRef);
                if (!sfDoc.exists()) throw "Document does not exist!";
                const data = sfDoc.data();

                if (attendee.isLeader) {
                    const newStatus = !data.checkedIn;
                    transaction.update(docRef, {
                        checkedIn: newStatus,
                        checkInTime: newStatus ? serverTimestamp() : null
                    });
                } else {
                    const members = data.members || [];
                    if (members[attendee.memberIndex]) {
                        members[attendee.memberIndex].checkedIn = !members[attendee.memberIndex].checkedIn;
                        members[attendee.memberIndex].checkInTime = members[attendee.memberIndex].checkedIn ? new Date() : null;
                        transaction.update(docRef, { members });
                    } else {
                        throw "Member not found";
                    }
                }
            });
        } catch (err) {
            console.error(err);
            alert("Error updating status: " + err);
        }
    };



    const handleExportRSVP = () => {
        const headers = ["Name", "Team", "Role", "Ticket ID", "Checked In", "Check-in Time"];
        const rows = [];

        attendeeGroups.forEach(group => {
            group.members.forEach(member => {
                rows.push([
                    `"${member.name}"`,
                    `"${member.team}"`,
                    `"${member.role}"`,
                    `"${member.barcode}"`,
                    member.checkedIn ? "Yes" : "No",
                    member.checkInTime ? `"${new Date(member.checkInTime.seconds ? member.checkInTime.seconds * 1000 : member.checkInTime).toLocaleString()}"` : ""
                ].join(","));
            });
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `rsvp_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <header className="sticky top-0 z-30 bg-slate-800 border-b border-slate-700 shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-indigo-400">Event Check-in Admin</h1>
                    <div className="flex items-center gap-4">
                        <button onClick={handleLogout} className="text-sm font-medium text-red-400 hover:text-red-300 flex items-center gap-2">
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">



                <div className="space-y-8">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-900/50 border border-blue-700/50 p-6 rounded-xl shadow-lg">
                            <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-1">Total</h3>
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
                        {activeTab === 'rsvp' ? (
                            <>
                                <AddAttendeeForm />
                                <BulkAddForm />
                            </>
                        ) : (
                            <UnstopUploadForm />
                        )}
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex space-x-4 border-b border-slate-700 pb-2">
                        <button
                            onClick={() => setActiveTab('rsvp')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'rsvp' ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            RSVP Check-in
                        </button>
                        <button
                            onClick={() => setActiveTab('unstop')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'unstop' ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Unstop Data
                        </button>
                    </div>

                    {/* Content Area */}
                    {activeTab === 'rsvp' ? (
                        <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-white">Attendee List</h2>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-slate-400">{stats.total} records</span>
                                    <button
                                        onClick={handleExportRSVP}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                                    >
                                        <Save size={14} /> Export CSV
                                    </button>
                                </div>
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
                                    {attendeeGroups.map(group => (
                                        <tbody key={group.id} className="divide-y divide-slate-700 border-b-8 border-slate-900 last:border-0 relative">
                                            {/* Optional Group Header if needed, but visually grouped by border is enough */}
                                            {group.members.map(attendee => (
                                                <tr
                                                    key={attendee.uniqueId}
                                                    className={`transition-colors border-b border-slate-700/50 ${attendee.isLeader
                                                        ? 'bg-yellow-900/20 hover:bg-yellow-900/30'
                                                        : 'hover:bg-slate-700/30'
                                                        }`}
                                                >
                                                    <td className="px-6 py-4 font-medium text-white">
                                                        {attendee.name}
                                                        <span className={`text-xs block font-bold ${attendee.isLeader ? 'text-yellow-400' : 'text-slate-500'}`}>
                                                            {attendee.isLeader ? 'TEAM LEADER' : 'TEAM MEMBER'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 font-medium">
                                                        {attendee.team}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-sm text-slate-400">{attendee.barcode}</td>
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => toggleCheckInSafe(attendee)}
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
                                        </tbody>
                                    ))}
                                    {attendeeGroups.length === 0 && <tbody><tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No attendees found.</td></tr></tbody>}
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-white">Unstop Registrations</h2>
                                <span className="text-sm text-slate-400">{stats.total} records</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Name</th>
                                            <th className="px-6 py-3">Contact</th>
                                            <th className="px-6 py-3">Team Info</th>
                                            <th className="px-6 py-3">Organization</th>
                                            <th className="px-6 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    {unstopGroups.map(group => (
                                        <tbody key={group.id} className="divide-y divide-slate-700 border-b-8 border-slate-900 last:border-0 relative">
                                            {group.members.map(u => {
                                                const genderRaw = String(u["Candidate's Gender"] || "").toLowerCase();
                                                const isMale = genderRaw === 'male' || genderRaw === 'm';
                                                const isFemale = genderRaw === 'female' || genderRaw === 'f';

                                                const textColor = isMale ? 'text-blue-300' : isFemale ? 'text-pink-300' : 'text-white';
                                                const icon = isMale ? <Mars size={14} className="ml-2 inline text-blue-400" /> : isFemale ? <Venus size={14} className="ml-2 inline text-pink-400" /> : null;

                                                let rowBg = isMale ? 'bg-blue-900/10 hover:bg-blue-900/20' : isFemale ? 'bg-pink-900/10 hover:bg-pink-900/20' : 'hover:bg-slate-700/30';

                                                const isLeader = u["Candidate role"] === "Team Leader";
                                                if (isLeader) {
                                                    rowBg = "bg-yellow-900/20 hover:bg-yellow-900/30";
                                                }

                                                return (
                                                    <tr key={u.id} className={`${rowBg} transition-colors border-b border-slate-700/50`}>
                                                        <td className="px-6 py-4">
                                                            <div className={`${textColor} font-medium flex items-center`}>
                                                                {u["Candidate's Name"]}
                                                                {icon}
                                                            </div>
                                                            <div className="text-xs text-slate-500">{u["Candidate's Gender"]}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-slate-300 text-sm">{u["Candidate's Email"]}</div>
                                                            <div className="text-slate-500 text-xs">{u["Candidate's Mobile"]}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-indigo-400 font-medium">{u["Team Name"]}</div>
                                                            <div className="text-xs text-slate-500">{u["Candidate role"]}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-400 text-sm truncate max-w-xs" title={u["Candidate's Organisation"]}>
                                                            {u["Candidate's Organisation"]}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() => toggleCheckInSafe(u)}
                                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${u.checkedIn ? 'bg-green-600' : 'bg-slate-600'}`}
                                                                >
                                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${u.checkedIn ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                </button>
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${u["Reg. Status"] === "Complete" ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400"}`}>
                                                                    {u["Reg. Status"]}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    ))}
                                    {unstopGroups.length === 0 && (
                                        <tbody>
                                            <tr>
                                                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                                    No unstop data found.
                                                </td>
                                            </tr>
                                        </tbody>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}
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

function UnstopUploadForm() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setStatus("Reading file...");

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const text = evt.target.result;
                const rows = text.split('\n');

                // Simple CSV parser that handles basic quotes
                // headers: Team ID, Team Name, Candidate role, Candidate's Name, ...
                const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

                const data = [];
                for (let i = 1; i < rows.length; i++) {
                    if (!rows[i].trim()) continue;



                    // Specific CSV format object
                    const rowData = {};

                    // Manual CSV parsing loop for robustness
                    let currentVal = '';
                    let inQuote = false;
                    let colIndex = 0;
                    const line = rows[i];

                    for (let charIndex = 0; charIndex < line.length; charIndex++) {
                        const char = line[charIndex];
                        if (char === '"') {
                            inQuote = !inQuote;
                        } else if (char === ',' && !inQuote) {
                            if (colIndex < headers.length) {
                                rowData[headers[colIndex]] = currentVal.trim().replace(/^"|"$/g, '');
                            }
                            currentVal = '';
                            colIndex++;
                        } else {
                            currentVal += char;
                        }
                    }
                    if (colIndex < headers.length) {
                        rowData[headers[colIndex]] = currentVal.trim().replace(/^"|"$/g, '');
                    }

                    if (Object.keys(rowData).length > 0) {
                        data.push(rowData);
                    }
                }

                setStatus(`Parsed ${data.length} records. Uploading...`);

                // Batch upload
                const chunkSize = 400; // Firestore limit is 500
                for (let i = 0; i < data.length; i += chunkSize) {
                    const chunk = data.slice(i, i + chunkSize);
                    const batch = writeBatch(db);

                    chunk.forEach(record => {
                        // Create a composite ID or let Firestore generate one. 
                        // Using Reg Code or Email + Team ID makes it idempotent if available, 
                        // but unstop export might not have unique IDs strictly.
                        // We will use doc() to auto-gen ID for simplicity unless "Ref Code" is unique

                        const newDocRef = doc(collection(db, "events", "innovate-for-impact", "attendees"));
                        batch.set(newDocRef, {
                            ...record,
                            uploadedAt: serverTimestamp()
                        });
                    });

                    await batch.commit();
                    setStatus(`Uploaded ${Math.min(i + chunkSize, data.length)} / ${data.length} records...`);
                }

                setStatus("Upload Complete!");
                e.target.value = null; // Reset input
            } catch (err) {
                console.error(err);
                setStatus("Error: " + err.message);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);
    };

    const handleClearData = async () => {
        if (!confirm("CRITICAL WARNING: This will PERMANENTLY DELETE ALL Unstop attendee data. This action cannot be undone. Are you sure?")) return;

        setLoading(true);
        setStatus("Fetching records to delete...");

        try {
            const q = query(collection(db, "events", "innovate-for-impact", "attendees"));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setStatus("No records to delete.");
                setLoading(false);
                return;
            }

            const total = snapshot.docs.length;
            setStatus(`Deleting ${total} records...`);

            const chunkSize = 400; // Batch limit
            const docs = snapshot.docs;

            for (let i = 0; i < total; i += chunkSize) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + chunkSize);

                chunk.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                setStatus(`Deleted ${Math.min(i + chunkSize, total)} / ${total} records...`);
            }

            setStatus("All Unstop data cleared successfully.");
        } catch (err) {
            console.error(err);
            setStatus("Error clearing data: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl col-span-2">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Upload size={20} className="text-indigo-400" />
                Import Unstop Data
            </h3>

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={loading}
                        className="block w-full text-sm text-slate-400
                            file:mr-4 file:py-2.5 file:px-4
                            file:rounded-lg file:border-0
                            file:text-sm file:font-semibold
                            file:bg-indigo-600 file:text-white
                            hover:file:bg-indigo-700
                            cursor-pointer disabled:opacity-50"
                    />
                </div>
                <button
                    onClick={handleClearData}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Trash2 size={16} />
                    Clear All Data
                </button>
                {status && (
                    <span className={`text-sm font-medium ${status.includes("Error") ? "text-red-400" : "text-green-400"}`}>
                        {status}
                    </span>
                )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
                Expected Headers: Team ID, Team Name, Candidate role, Candidate's Name, Email, Mobile, Gender, etc.
            </p>
        </div>
    );
}

// Helpers
async function deleteAttendee(id) {
    if (!confirm("This will delete the ENTIRE TEAM. Continue?")) return;
    await deleteDoc(doc(db, ATTENDEE_COLLECTION, id));
}

async function updateAttendee(data) {
    // Complex update logic needed for array
}
