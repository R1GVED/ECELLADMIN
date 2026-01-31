import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Users, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ATTENDEE_COLLECTION = "rsvp_innovate_2026";

export default function PublicAttendance() {
    const [attendees, setAttendees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const q = query(collection(db, ATTENDEE_COLLECTION));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const parsedList = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const docId = doc.id;

                // Helper to push attendee
                const add = (name, status) => {
                    if (name) {
                        parsedList.push({
                            id: `${docId}_${name}`, // Proper React Key
                            uniqueId: `${docId}_${name}`,
                            name: name,
                            eventName: data.event_name || data.eventName || "Innovate 2026",
                            checkedIn: !!status
                        });
                    }
                };

                // Parsing Logic matching Dashboard
                if (data.name) {
                    add(data.name, data.checkedIn);
                } else {
                    add(data['Team Leader Name'], data.leader_checkedIn);
                    for (let i = 1; i <= 5; i++) {
                        add(data[`Team Member ${i}`], data[`member_${i}_checkedIn`]);
                        add(data[`Member ${i} Name`], data[`member_${i}_checkedIn`]);
                    }
                }
            });

            // Client-side sort
            parsedList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            setAttendees(parsedList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching public list:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredAttendees = attendees.filter(a =>
        a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.eventName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getEventColor = (eventName) => {
        const lower = (eventName || "").toLowerCase();
        if (lower.includes('both')) return 'text-green-400';
        if (lower.includes('finbiz')) return 'text-yellow-400';
        if (lower.includes('illuminate')) return 'text-blue-400';
        return 'text-slate-400';
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-indigo-400 flex items-center gap-2">
                        <Users /> Public Attendee List
                    </h1>
                    <button
                        onClick={() => navigate('/login')}
                        className="text-slate-400 hover:text-white text-sm underline"
                    >
                        Back to Login
                    </button>
                </header>

                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search attendees..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-700 text-slate-300">
                                <tr>
                                    <th className="p-4 font-semibold">Name</th>
                                    <th className="p-4 font-semibold">Event</th>
                                    <th className="p-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="3" className="p-8 text-center text-slate-500">Loading...</td></tr>
                                ) : filteredAttendees.length === 0 ? (
                                    <tr><td colSpan="3" className="p-8 text-center text-slate-500">No attendees found.</td></tr>
                                ) : (
                                    filteredAttendees.map((attendee, idx) => (
                                        <tr key={attendee.id || idx} className="hover:bg-slate-700/50 transition-colors">
                                            <td className="p-4 font-medium text-white">{attendee.name}</td>
                                            <td className={`p-4 text-sm font-semibold ${getEventColor(attendee.eventName)}`}>
                                                {attendee.eventName || 'N/A'}
                                            </td>
                                            <td className="p-4">
                                                {attendee.checkedIn ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">
                                                        Checked In
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-600 text-slate-300">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
