import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { LogOut, Save, Plus, Trash2, Calendar, Award, Users, Clock, Info, CheckCircle, Smartphone } from 'lucide-react';

const EVENT_ID = "innovate-for-impact";

export default function EventEditor() {
    const { logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("general");
    const [data, setData] = useState({
        title: "Innovate for Impact",
        tagline: "",
        description: "",
        venue: "",
        registrationLink: "",
        dates: { start: "", end: "" },
        timeline: [],
        sponsors: [],
        prizes: []
    });

    useEffect(() => {
        async function fetchData() {
            const docRef = doc(db, "events", EVENT_ID);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setData(docSnap.data());
            }
            setLoading(false);
        }
        fetchData();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "events", EVENT_ID), data, { merge: true });
            alert("Changes saved successfully!");
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("Failed to save changes.");
        }
        setSaving(false);
    };

    const handleChange = (field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const handleNestedChange = (parent, field, value) => {
        setData(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }));
    };

    // Helper to manage array fields (Timeline, Sponsors, Prizes)
    const addItem = (field, template) => {
        setData(prev => ({ ...prev, [field]: [...(prev[field] || []), template] }));
    };

    const updateItem = (field, index, subField, value) => {
        const newArray = [...(data[field] || [])];
        newArray[index] = { ...newArray[index], [subField]: value };
        setData(prev => ({ ...prev, [field]: newArray }));
    };

    const removeItem = (field, index) => {
        const newArray = [...(data[field] || [])];
        newArray.splice(index, 1);
        setData(prev => ({ ...prev, [field]: newArray }));
    };

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-800">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-gray-900 text-white flex flex-col shadow-xl z-10">
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-xl font-bold tracking-tight">E-Cell Admin</h1>
                    <p className="text-xs text-gray-500 mt-1">Event Manager</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {['general', 'timeline', 'sponsors', 'prizes'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            {tab === 'general' && <Info size={18} />}
                            {tab === 'timeline' && <Clock size={18} />}
                            {tab === 'sponsors' && <Users size={18} />}
                            {tab === 'prizes' && <Award size={18} />}
                            <span className="capitalize">{tab}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 p-6 flex justify-between items-center shadow-sm">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Innovate for Impact</h2>
                        <p className="text-sm text-gray-500">Editing event details</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Save size={18} />}
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </header>

                {/* Scrollable Form Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50">
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

                        {/* General Tab */}
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Event Title</label>
                                        <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={data.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Tagline</label>
                                        <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={data.tagline || ""} onChange={(e) => handleChange("tagline", e.target.value)} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Description</label>
                                    <textarea rows={5} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={data.description || ""} onChange={(e) => handleChange("description", e.target.value)} />
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Venue</label>
                                        <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={data.venue || ""} onChange={(e) => handleChange("venue", e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Registration Link</label>
                                        <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={data.registrationLink || ""} onChange={(e) => handleChange("registrationLink", e.target.value)} />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Start Date</label>
                                        <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={data.dates?.start || ""} onChange={(e) => handleNestedChange("dates", "start", e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">End Date</label>
                                        <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={data.dates?.end || ""} onChange={(e) => handleNestedChange("dates", "end", e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Timeline Tab */}
                        {activeTab === 'timeline' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">Event Schedule</h3>
                                    <button onClick={() => addItem('timeline', { time: "", activity: "" })} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">+ Add Slot</button>
                                </div>
                                {(!data.timeline || data.timeline.length === 0) && <p className="text-gray-400 italic">No timeline added yet.</p>}
                                <div className="space-y-4">
                                    {data.timeline?.map((item, index) => (
                                        <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg border border-gray-100 group">
                                            <div className="flex-1 grid md:grid-cols-3 gap-4">
                                                <input placeholder="Time (e.g. 10:00 AM)" className="border border-gray-300 rounded px-3 py-2 text-sm" value={item.time} onChange={(e) => updateItem('timeline', index, 'time', e.target.value)} />
                                                <input placeholder="Activity Name" className="md:col-span-2 border border-gray-300 rounded px-3 py-2 text-sm" value={item.activity} onChange={(e) => updateItem('timeline', index, 'activity', e.target.value)} />
                                            </div>
                                            <button onClick={() => removeItem('timeline', index)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Sponsors Tab */}
                        {activeTab === 'sponsors' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">Sponsors & Partners</h3>
                                    <button onClick={() => addItem('sponsors', { name: "", logoUrl: "", type: "Sponsor" })} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">+ Add Sponsor</button>
                                </div>
                                {(!data.sponsors || data.sponsors.length === 0) && <p className="text-gray-400 italic">No sponsors added yet.</p>}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {data.sponsors?.map((item, index) => (
                                        <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-100 relative group">
                                            <button onClick={() => removeItem('sponsors', index)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                            <div className="space-y-3">
                                                <input placeholder="Sponsor Name" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" value={item.name} onChange={(e) => updateItem('sponsors', index, 'name', e.target.value)} />
                                                <input placeholder="Logo URL" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" value={item.logoUrl} onChange={(e) => updateItem('sponsors', index, 'logoUrl', e.target.value)} />
                                                <input placeholder="Type (e.g. Gold, Media Partner)" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" value={item.type} onChange={(e) => updateItem('sponsors', index, 'type', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Prizes Tab */}
                        {activeTab === 'prizes' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">Prize Pool</h3>
                                    <button onClick={() => addItem('prizes', { position: "", reward: "" })} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">+ Add Prize</button>
                                </div>
                                {(!data.prizes || data.prizes.length === 0) && <p className="text-gray-400 italic">No prizes added yet.</p>}
                                <div className="space-y-4">
                                    {data.prizes?.map((item, index) => (
                                        <div key={index} className="flex gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                                            <div className="flex-1 grid md:grid-cols-2 gap-4">
                                                <input placeholder="Position (e.g. 1st Place)" className="border border-gray-300 rounded px-3 py-2 text-sm font-medium" value={item.position} onChange={(e) => updateItem('prizes', index, 'position', e.target.value)} />
                                                <input placeholder="Reward (e.g. ₹10,000 + Credits)" className="border border-gray-300 rounded px-3 py-2 text-sm" value={item.reward} onChange={(e) => updateItem('prizes', index, 'reward', e.target.value)} />
                                            </div>
                                            <button onClick={() => removeItem('prizes', index)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
