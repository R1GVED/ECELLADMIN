import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase'; // Ensure storage is exported from firebase.js
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CertificateCanvas from '../components/CertificateCanvas';
import DraggableField from '../components/DraggableField';
import { Save, Upload, Type, Move, Image as ImageIcon, Plus, CheckCircle, Download, X } from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function CertificateAdmin() {
    const [loading, setLoading] = useState(false);
    const [templateUrl, setTemplateUrl] = useState("");
    const [fields, setFields] = useState([]);
    const [selectedFieldId, setSelectedFieldId] = useState(null);
    const [configName, setConfigName] = useState("innovate_2026_cert");
    const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved" | "error"
    const [lastSavedTime, setLastSavedTime] = useState(null);

    // Load existing config
    useEffect(() => {
        const docRef = doc(db, "certificate_templates", configName);
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setTemplateUrl(data.imageUrl || "");
                setFields(data.fields || []);
            }
        }, (err) => {
            console.error("Error loading config:", err);
            // Don't alert on offline error, just log it. Persistence will handle retries.
        });

        return () => unsubscribe();
    }, [configName]);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file type
        if (file.type === 'application/pdf') {
            alert("PDF templates cannot be directly edited. Please convert to JPG/PNG.");
            return;
        }

        // Compress and Convert to Base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize if too large (max 1600px width keeps it well under 1MB usually)
                const MAX_WIDTH = 1600;
                if (width > MAX_WIDTH) {
                    height = (MAX_WIDTH / width) * height;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // Draw white background first (for transparency safety)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                // This typically reduces a 5MB image to ~200-400KB
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                if (compressedBase64.length > 1048000) {
                    alert("Image is still too large even after compression. Please use a smaller image.");
                    return;
                }

                setTemplateUrl(compressedBase64);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const addField = (type) => {
        const newField = {
            id: Date.now(),
            key: type.toLowerCase(),
            label: type,
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            fontSize: 24,
            fontWeight: 'bold',
            color: '#000000',
            fontFamily: 'Arial'
        };
        setFields([...fields, newField]);
        setSelectedFieldId(newField.id);
    };

    const updateField = (id, updates) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const deleteField = (id) => {
        setFields(fields.filter(f => f.id !== id));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    const saveConfig = async (url = templateUrl, currentFields = fields) => {
        if (!url) {
            alert("Please select a template image first.");
            return;
        }
        setLoading(true);
        setSaveStatus("saving");
        try {
            const now = new Date();
            await setDoc(doc(db, "certificate_templates", configName), {
                imageUrl: url,
                fields: currentFields,
                updatedAt: now
            }, { merge: true });

            setSaveStatus("saved");
            setLastSavedTime(now.toLocaleTimeString());

            // Reset "Saved" status after 3 seconds
            setTimeout(() => setSaveStatus(""), 3000);

        } catch (err) {
            console.error(err);
            setSaveStatus("error");
            alert("Failed to save configuration: " + err.message);
        }
        setLoading(false);
    };

    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState({});

    // Import jsPDF dynamically or at top if not present. 
    // Since we are replacing content, I'll add the imports at the top in a separate block or assume they are added.
    // Wait, I need to do the imports first. 
    // Actually, I can replace the whole return statement and add functions before it.

    // ... (keeping existing functions)

    const handlePreviewChange = (key, value) => {
        setPreviewData(prev => ({ ...prev, [key]: value }));
    };

    const downloadPreviewStub = async (format) => {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;

        try {
            if (format === 'jpg') {
                const link = document.createElement('a');
                link.download = `Certificate_${previewData.name || 'Admin'}.jpg`;
                link.href = canvas.toDataURL('image/jpeg', 0.9);
                link.click();
            } else if (format === 'pdf') {
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const { jsPDF } = await import('jspdf'); // Dynamic import to be safe if not at top
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
                pdf.save(`Certificate_${previewData.name || 'Admin'}.pdf`);
            }
        } catch (err) {
            console.error("Download error", err);
            alert("Error downloading: " + err.message);
        }
    };

    const selectedField = fields.find(f => f.id === selectedFieldId);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center">
            {/* Modal for Manual Generation */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

                        {/* Header */}
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <CheckCircle className="text-green-500" /> Manual Generator
                                </h2>
                                <p className="text-slate-400 text-sm">Generate and download a specific certificate immediately.</p>
                            </div>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                            {/* Controls */}
                            <div className="w-full lg:w-1/3 p-6 overflow-y-auto border-r border-slate-700 bg-slate-800">
                                <h3 className="uppercase text-xs font-bold text-slate-500 mb-4 tracking-wider">Field Values</h3>
                                <div className="space-y-4">
                                    {/* Extract unique keys from fields to generate inputs */}
                                    {[...new Set(fields.map(f => f.key))].map(key => (
                                        <div key={key}>
                                            <label className="block text-sm font-medium text-slate-300 mb-1 capitalize">{key}</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder={`Enter ${key}...`}
                                                value={previewData[key] || ''}
                                                onChange={(e) => handlePreviewChange(key, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 space-y-3">
                                    <button
                                        onClick={() => downloadPreviewStub('jpg')}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                    >
                                        <Download size={18} /> Download JPG
                                    </button>
                                    <button
                                        onClick={() => downloadPreviewStub('pdf')}
                                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                                    >
                                        <Download size={18} /> Download PDF
                                    </button>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="flex-1 bg-slate-900 p-8 flex items-center justify-center overflow-auto">
                                <div className="relative shadow-2xl">
                                    <CertificateCanvas
                                        templateUrl={templateUrl}
                                        fields={fields}
                                        data={previewData}
                                        width={CANVAS_WIDTH}
                                        height={CANVAS_HEIGHT}
                                        scale={0.8}
                                        className="rounded-lg"
                                        id="preview-canvas"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">

                {/* Visual Editor Area */}
                <div className="flex-1 flex flex-col items-center">
                    <h1 className="text-3xl font-bold mb-6 text-indigo-400">Certificate Designer</h1>

                    <div
                        className="relative bg-white shadow-2xl border border-slate-700 overflow-hidden"
                        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
                    >
                        {templateUrl ? (
                            <img
                                src={templateUrl}
                                alt="Certificate Template"
                                className="w-full h-full object-cover pointer-events-none select-none"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon size={64} className="mb-4 opacity-50" />
                                <p>Upload a template image to start</p>
                            </div>
                        )}

                        {fields.map(field => (
                            <DraggableField
                                key={field.id}
                                field={field}
                                onUpdate={(id, pos) => updateField(id, pos)}
                                containerWidth={CANVAS_WIDTH}
                                containerHeight={CANVAS_HEIGHT}
                                isSelected={selectedFieldId === field.id}
                                onSelect={setSelectedFieldId}
                            />
                        ))}
                    </div>

                    <div className="mb-6 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h3 className="text-indigo-400 font-bold uppercase text-xs tracking-wider mb-4 border-b border-slate-700 pb-2">1. Template Source</h3>

                        <div className="space-y-4">
                            <p className="text-xs text-slate-400">
                                Select a Certificate Template image from your computer. It will be instantly previewed.
                            </p>

                            <label className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold px-4 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors shadow-lg shadow-white/10">
                                <ImageIcon size={20} className="text-indigo-600" />
                                <span>Select Image / PDF</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    onChange={handleImageUpload}
                                    disabled={loading}
                                />
                            </label>

                            {templateUrl && (
                                <div className="text-xs text-green-400 flex items-center justify-center gap-1 bg-green-900/20 py-2 rounded">
                                    <Save size={12} /> Ready to Save
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="flex gap-4">
                            <button
                                onClick={() => saveConfig()}
                                disabled={loading}
                                className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${saveStatus === 'saved'
                                    ? 'bg-green-600 text-white shadow-green-500/20'
                                    : saveStatus === 'error'
                                        ? 'bg-red-600 text-white shadow-red-500/20'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                                    }`}
                            >
                                <Save size={20} />
                                {loading ? "Saving..." : saveStatus === 'saved' ? "Saved Successfully!" : "Save Configuration"}
                            </button>

                            <button
                                onClick={() => setShowPreview(true)}
                                className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                            >
                                <CheckCircle size={20} /> Test / Generate
                            </button>
                        </div>

                        {lastSavedTime && (
                            <div className="text-slate-500 text-sm flex items-center gap-2">
                                <CheckCircle size={14} className="text-green-500" />
                                Last saved at {lastSavedTime}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Controls */}
                <div className="w-full lg:w-80 space-y-6">

                    {/* Tools Panel */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Plus size={20} className="text-green-400" /> Add Field
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {['Name', 'Team', 'Role', 'Date', 'ID'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => addField(type)}
                                    className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg text-sm font-medium transition-colors text-left flex items-center gap-2"
                                >
                                    <Type size={16} className="text-slate-400" />
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Field Properties Panel */}
                    {selectedField ? (
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl animate-fadeIn">
                            <h3 className="text-lg font-bold mb-4 text-indigo-300">Edit "{selectedField.label}"</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold">Data Key</label>
                                    <select
                                        value={selectedField.key}
                                        onChange={(e) => updateField(selectedField.id, { key: e.target.value, label: e.target.options[e.target.selectedIndex].text })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-sm text-white"
                                    >
                                        <option value="name">Participant Name</option>
                                        <option value="team">Team Name</option>
                                        <option value="role">Role (Leader/Member)</option>
                                        <option value="date">Date</option>
                                        <option value="barcode">Ticket ID</option>
                                        <option value="custom">Custom Text</option>
                                    </select>
                                </div>

                                {selectedField.key === 'custom' && (
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold">Custom Text</label>
                                        <input
                                            type="text"
                                            value={selectedField.label}
                                            onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-sm text-white"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold">Position X</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedField.x || 0)}
                                            onChange={(e) => updateField(selectedField.id, { x: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-sm text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold">Position Y</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedField.y || 0)}
                                            onChange={(e) => updateField(selectedField.id, { y: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-sm text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold">Size (px)</label>
                                        <input
                                            type="number"
                                            value={selectedField.fontSize || 12}
                                            onChange={(e) => updateField(selectedField.id, { fontSize: parseInt(e.target.value) || 12 })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-sm text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold">Color</label>
                                        <input
                                            type="color"
                                            value={selectedField.color}
                                            onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg h-10 mt-1 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold">Font Weight</label>
                                    <select
                                        value={selectedField.fontWeight}
                                        onChange={(e) => updateField(selectedField.id, { fontWeight: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-sm text-white"
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="bold">Bold</option>
                                    </select>
                                </div>

                                <button
                                    onClick={() => deleteField(selectedField.id)}
                                    className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 py-2 rounded-lg text-sm font-medium transition-colors mt-4 border border-red-900/50"
                                >
                                    Delete Field
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 text-center text-slate-500">
                            Select a field to edit its properties
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
