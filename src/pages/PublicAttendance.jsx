import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Users, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ATTENDEE_COLLECTION = "rsvp_innovate_2026";

export default function PublicAttendance() {
    const [attendeeGroups, setAttendeeGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const q = query(collection(db, ATTENDEE_COLLECTION));
        const unsub = onSnapshot(q, (snapshot) => {
            const rawList = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const docId = doc.id;

                const add = (name, status, isLeader, teamName) => {
                    if (name) {
                        rawList.push({
                            id: `${docId}_${name}`,
                            uniqueId: `${docId}_${name}`,
                            name: name,
                            checkedIn: !!status,
                            isLeader: !!isLeader,
                            team: teamName || data.team_name || "Individual",
                        });
                    }
                };

                if (data.name) {
                    add(data.name, data.checkedIn, true, data.team);
                }
                if (Array.isArray(data.members)) {
                    data.members.forEach(m => {
                        add(m.name, m.checkedIn, false, data.team);
                    });
                }
            });

            // Grouping Logic
            const groups = {};
            rawList.forEach(p => {
                const teamKey = p.team || "Individual";
                if (!groups[teamKey]) {
                    groups[teamKey] = { id: teamKey, teamName: teamKey, members: [] };
                }
                groups[teamKey].members.push(p);
            });

            const groupList = Object.values(groups);
            groupList.sort((a, b) => a.teamName.localeCompare(b.teamName));

            // Sort members: Leader first, then A-Z
            groupList.forEach(g => {
                g.members.sort((a, b) => {
                    if (a.isLeader && !b.isLeader) return -1;
                    if (!a.isLeader && b.isLeader) return 1;
                    return a.name.localeCompare(b.name);
                });
            });

            setAttendeeGroups(groupList);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const filteredGroups = attendeeGroups.map(g => ({
        ...g,
        members: g.members.filter(m =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.teamName.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(g => g.members.length > 0);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-indigo-400 flex items-center gap-2">
                        <Users /> Public Attendee List
                    </h1>
                    <button
                        onClick={() => navigate('/home')}
                        className="text-slate-400 hover:text-white text-sm underline"
                    >
                        Back to Home
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
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-700 text-slate-300">
                                <tr>
                                    <th className="p-4 font-semibold">Name</th>
                                    <th className="p-4 font-semibold">Team</th>
                                    <th className="p-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            {filteredGroups.map(group => (
                                <tbody key={group.id} className="divide-y divide-slate-700 border-b-8 border-slate-900 last:border-0">
                                    {group.members.map(member => (
                                        <tr key={member.uniqueId} className={`transition-colors border-b border-slate-700/50 ${member.isLeader ? 'bg-yellow-900/20' : 'hover:bg-slate-700/50'}`}>
                                            <td className="p-4 font-medium text-white">
                                                {member.name}
                                                {member.isLeader && (
                                                    <span className="text-xs block font-bold text-yellow-400 mt-0.5">TEAM LEADER</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-300 text-sm">{member.team}</td>
                                            <td className="p-4">
                                                {member.checkedIn ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">Checked In</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-600 text-slate-300">Pending</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            ))}
                            {filteredGroups.length === 0 && (
                                <tbody>
                                    <tr><td colSpan="3" className="p-8 text-center text-slate-500">No attendees found.</td></tr>
                                </tbody>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
