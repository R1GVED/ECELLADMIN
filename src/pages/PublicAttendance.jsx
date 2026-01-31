import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { Users, Search, Mars, Venus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ATTENDEE_COLLECTION = "rsvp_innovate_2026";

export default function PublicAttendance() {
    const [activeTab, setActiveTab] = useState('rsvp'); // 'rsvp' | 'unstop'

    // RSVP State
    const [attendeeGroups, setAttendeeGroups] = useState([]);

    // Unstop State
    const [unstopGroups, setUnstopGroups] = useState([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        signInAnonymously(auth).catch(err => console.error("Auth failed:", err));
    }, []);

    useEffect(() => {
        // RSVP Listener
        const q = query(collection(db, ATTENDEE_COLLECTION));
        const unsub = onSnapshot(q, (snapshot) => {
            const rawList = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const docId = doc.id;

                const add = (name, status, isLeader, teamName, memberIndex) => {
                    if (name) {
                        rawList.push({
                            id: `${docId}_${name}`,
                            uniqueId: `${docId}_${name}`,
                            name: name,
                            eventName: data.event_name || data.eventName || "Innovate 2026",
                            checkedIn: !!status,
                            isLeader: !!isLeader,
                            team: teamName || data.team_name || "Individual",
                            originalDocId: docId
                        });
                    }
                };

                if (data.name) {
                    add(data.name, data.checkedIn, false, data.team_name);
                } else {
                    add(data['Team Leader Name'], data.leader_checkedIn, true, data['Team Name']);
                    for (let i = 1; i <= 5; i++) {
                        const mName = data[`Team Member ${i}`] || data[`Member ${i} Name`];
                        const mStatus = data[`member_${i}_checkedIn`];
                        if (mName) add(mName, mStatus, false, data['Team Name']);
                    }
                }
            });

            // Grouping Logic for RSVP
            const groups = {};
            rawList.forEach(p => {
                const teamKey = p.team || "Individual";
                if (!groups[teamKey]) {
                    groups[teamKey] = {
                        id: teamKey,
                        teamName: teamKey,
                        members: []
                    };
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

    // Filter Logic based on active Tab
    const filteredGroups = activeTab === 'rsvp'
        ? attendeeGroups.map(g => ({
            ...g,
            members: g.members.filter(m =>
                m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.teamName.toLowerCase().includes(searchTerm.toLowerCase())
            )
        })).filter(g => g.members.length > 0)
        : unstopGroups.map(g => ({
            ...g,
            members: g.members.filter(m =>
                String(m["Candidate's Name"] || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(g.teamName || "").toLowerCase().includes(searchTerm.toLowerCase())
            )
        })).filter(g => g.members.length > 0);

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

                {/* Tab Nav */}
                <div className="flex space-x-4 border-b border-slate-700 pb-2 mb-6">
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

                <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-700 text-slate-300">
                                <tr>
                                    <th className="p-4 font-semibold">Name</th>
                                    {activeTab === 'rsvp' && <th className="p-4 font-semibold">Team</th>}
                                    {activeTab === 'unstop' && <th className="p-4 font-semibold">Team / Org</th>}
                                    <th className="p-4 font-semibold">Status</th>
                                </tr>
                            </thead>

                            {/* RSVP RENDER */}
                            {activeTab === 'rsvp' && filteredGroups.map(group => (
                                <tbody key={group.id} className="divide-y divide-slate-700 border-b-8 border-slate-900 last:border-0 relative">
                                    {group.members.map(member => (
                                        <tr key={member.uniqueId} className={`transition-colors border-b border-slate-700/50 ${member.isLeader ? 'bg-yellow-900/20' : 'hover:bg-slate-700/50'}`}>
                                            <td className="p-4 font-medium text-white">
                                                {member.name}
                                                {member.isLeader && (
                                                    <span className="text-xs block font-bold text-yellow-400 mt-0.5">TEAM LEADER</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-300 text-sm">
                                                {member.team}
                                            </td>
                                            <td className="p-4">
                                                {member.checkedIn ? (
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
                                    ))}
                                </tbody>
                            ))}

                            {/* UNSTOP RENDER */}
                            {activeTab === 'unstop' && filteredGroups.map(group => (
                                <tbody key={group.id} className="divide-y divide-slate-700 border-b-8 border-slate-900 last:border-0 relative">
                                    {group.members.map(u => {
                                        const genderRaw = String(u["Candidate's Gender"] || "").toLowerCase();
                                        const isMale = genderRaw === 'manual' || genderRaw === 'm' || genderRaw === 'male';
                                        const isFemale = genderRaw === 'f' || genderRaw === 'female';

                                        const textColor = isMale ? 'text-blue-300' : isFemale ? 'text-pink-300' : 'text-white';
                                        const icon = isMale ? <Mars size={14} className="ml-2 inline text-blue-400" /> : isFemale ? <Venus size={14} className="ml-2 inline text-pink-400" /> : null;

                                        const isLeader = u["Candidate role"] === "Team Leader";
                                        const rowBg = isLeader ? "bg-yellow-900/20 hover:bg-yellow-900/30" : (isMale ? 'bg-blue-900/10' : isFemale ? 'bg-pink-900/10' : 'hover:bg-slate-700/50');

                                        return (
                                            <tr key={u.id} className={`${rowBg} transition-colors border-b border-slate-700/50`}>
                                                <td className="p-4">
                                                    <div className={`${textColor} font-medium flex items-center`}>
                                                        {u["Candidate's Name"]}
                                                        {icon}
                                                    </div>
                                                    {isLeader && <span className="text-xs font-bold text-yellow-400 block">TEAM LEADER</span>}
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-slate-300 text-sm">{u["Team Name"]}</div>
                                                    <div className="text-xs text-slate-500">{u["Candidate's Organisation"]}</div>
                                                </td>
                                                <td className="p-4">
                                                    {u.checkedIn ? (
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
                                        );
                                    })}
                                </tbody>
                            ))}

                            {filteredGroups.length === 0 && (
                                <tbody>
                                    <tr><td colSpan="4" className="p-8 text-center text-slate-500">No attendees found.</td></tr>
                                </tbody>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
