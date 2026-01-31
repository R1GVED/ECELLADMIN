import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, QrCode } from 'lucide-react';

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                    <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Innovate For Impact
                    </span>
                </h1>
                <p className="text-slate-400 text-lg">Event Management System</p>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
                {/* Public Attendee List */}
                <Link
                    to="/public"
                    className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:bg-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/10"
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="p-4 bg-blue-900/30 rounded-xl mb-4 group-hover:bg-blue-900/50 transition-colors">
                            <Users size={40} className="text-blue-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Public Attendee List</h2>
                        <p className="text-slate-400 text-sm">View the list of all registered attendees</p>
                    </div>
                </Link>

                {/* Admin Login */}
                <Link
                    to="/login"
                    className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:bg-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/10"
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="p-4 bg-indigo-900/30 rounded-xl mb-4 group-hover:bg-indigo-900/50 transition-colors">
                            <Shield size={40} className="text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Admin Login</h2>
                        <p className="text-slate-400 text-sm">Access the admin dashboard to manage attendees</p>
                    </div>
                </Link>

                {/* Open Scanner */}
                <Link
                    to="/scanner"
                    className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:bg-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/10"
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="p-4 bg-green-900/30 rounded-xl mb-4 group-hover:bg-green-900/50 transition-colors">
                            <QrCode size={40} className="text-green-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Open Scanner</h2>
                        <p className="text-slate-400 text-sm">Scan QR codes to check-in attendees</p>
                    </div>
                </Link>
            </div>

            {/* Footer */}
            <div className="mt-16 text-center">
                <p className="text-slate-500 text-sm">E-Cell Admin Portal</p>
            </div>
        </div>
    );
}
