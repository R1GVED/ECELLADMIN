import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, QrCode, Users } from 'lucide-react';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

const googleProvider = new GoogleAuthProvider();

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

    async function handleGoogleLogin() {
        try {
            setError("");
            setLoading(true);
            await signInWithPopup(auth, googleProvider);
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError("Google sign-in failed. Please try again.");
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

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div>
                    <div className="relative flex justify-center"><span className="px-2 bg-gray-900/50 text-sm text-gray-500">Or continue with</span></div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all mb-6"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {loading ? "Signing in..." : "Continue with Google"}
                </button>

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
