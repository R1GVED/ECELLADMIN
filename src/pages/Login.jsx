import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, QrCode, Users } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth'; // Removed GoogleAuthProvider, signInWithPopup
import { auth } from '../firebase';

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            setError("");
            setLoading(true);
            await login(email, password);
            navigate("/dashboard"); // Goes to dashboard (Admin)
        } catch {
            setError("Failed to log in. Please check your credentials.");
        }
        setLoading(false);
    }

    async function handleScannerLogin() {
        try {
            setLoading(true);
            await signInAnonymously(auth);
            navigate("/scanner");
        } catch (err) {
            console.error(err);
            setError("Could not start scanner.");
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 shadow-2xl w-full max-w-md transform transition-all duration-300 hover:scale-[1.01]">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Event Portal</h2>
                    <p className="text-gray-400 mt-2 text-sm">Sign in to manage E-Cell Events</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-2 text-sm">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-gray-300 text-sm font-medium ml-1">Email Address</label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-400 transition-colors" size={20} />
                            <input
                                type="email"
                                required
                                className="w-full bg-black/30 border border-gray-600 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-500"
                                placeholder="admin@ecelldypiu.in"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-gray-300 text-sm font-medium ml-1">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-400 transition-colors" size={20} />
                            <input
                                type="password"
                                required
                                className="w-full bg-black/30 border border-gray-600 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-500"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? "Signing in..." : "Login as Admin"}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div>
                    <div className="relative flex justify-center"><span className="px-2 bg-gray-900 text-sm text-gray-500">Or Access As</span></div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleScannerLogin}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors"
                    >
                        <QrCode size={18} /> Start Scanner
                    </button>
                    <button
                        onClick={() => navigate('/public')}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors border border-slate-600"
                    >
                        <Users size={18} /> Public Attendee List
                    </button>
                </div>
            </div>
        </div>
    );
}
