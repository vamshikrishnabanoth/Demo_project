import React, { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Presentation, ShieldCheck, ChevronRight } from 'lucide-react';


export default function RoleSelection() {
    const { setRole } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleRoleSelect = async (role) => {
        try {
            await setRole(role);
            if (role === 'teacher') navigate('/teacher-dashboard');
            if (role === 'student') navigate('/student-dashboard');
            if (role === 'admin') navigate('/admin-dashboard');
        } catch (err) {
            console.error(err);
            alert('Error setting role');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden font-inter p-6">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--bg-accent)]/5 rounded-full blur-[120px] -mr-80 -mt-80"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px] -ml-80 -mb-80"></div>

            <div className="relative z-10 text-center space-y-4 mb-16 flex flex-col items-center">
                <div className="bg-white p-2 rounded-2xl mb-4 shadow-xl">
                    <img src="/logo.png" alt="KMIT Logo" className="h-16 w-auto" />
                </div>
                <h1 className="text-5xl font-black text-[var(--text-primary)] italic uppercase tracking-tighter">
                    Choose Your <span className="text-[var(--text-accent)]">Role</span>
                </h1>
                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-[0.4em] text-[10px]">Select your role to get started</p>
                <div className="w-24 h-1 bg-gradient-to-r from-transparent via-[var(--bg-accent)] to-transparent mx-auto mt-6"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full relative z-10">
                {/* Teacher Role */}
                <button
                    onClick={() => handleRoleSelect('teacher')}
                    className="group relative bg-[var(--bg-secondary)] border border-[var(--border-color)] p-10 rounded-[3rem] hover:bg-[var(--glass-bg)] transition-all duration-500 overflow-hidden text-left shadow-xl"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-600/20 transition-colors"></div>
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-indigo-600/20 group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                        <Presentation size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-[var(--text-primary)] italic uppercase tracking-tight mb-2">Educator</h2>
                    <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed mb-8">Create quizzes, run live sessions, and track student performance.</p>
                    <div className="flex items-center gap-2 text-[var(--text-accent)] font-black italic uppercase tracking-widest text-[10px] group-hover:translate-x-2 transition-transform">
                        Enter Portal <ChevronRight size={14} />
                    </div>
                </button>

                {/* Student Role */}
                <button
                    onClick={() => handleRoleSelect('student')}
                    className="group relative bg-[var(--bg-secondary)] border border-[var(--bg-accent)]/30 p-10 rounded-[3rem] hover:bg-[var(--bg-accent)]/5 transition-all duration-500 overflow-hidden text-left scale-105 shadow-2xl shadow-[var(--bg-accent)]/20"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--bg-accent)]/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[var(--bg-accent)]/20 transition-colors"></div>
                    <div className="w-16 h-16 bg-[var(--bg-accent)] rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-[var(--bg-accent)]/20 group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                        <GraduationCap size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-[var(--text-primary)] italic uppercase tracking-tight mb-2">Challenger</h2>
                    <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed mb-8">Join live quizzes, climb the leaderboard, and track your progress.</p>
                    <div className="flex items-center gap-2 text-white font-black italic uppercase tracking-widest text-[10px] group-hover:translate-x-2 transition-transform bg-[var(--bg-accent)] w-fit px-4 py-2 rounded-full">
                        Join the Arena <ChevronRight size={14} />
                    </div>
                </button>

                {/* Admin Role */}
                <button
                    onClick={() => handleRoleSelect('admin')}
                    className="group relative bg-[var(--bg-secondary)] border border-[var(--border-color)] p-10 rounded-[3rem] hover:bg-[var(--glass-bg)] transition-all duration-500 overflow-hidden text-left shadow-xl"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-600/20 transition-colors"></div>
                    <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-slate-900/20 group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                        <ShieldCheck size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-[var(--text-primary)] italic uppercase tracking-tight mb-2">Systems</h2>
                    <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed mb-8">Manage users, monitor the platform, and control settings.</p>
                    <div className="flex items-center gap-2 text-[var(--text-secondary)] font-black italic uppercase tracking-widest text-[10px] group-hover:translate-x-2 transition-transform">
                        Admin Panel <ChevronRight size={14} />
                    </div>
                </button>
            </div>

            <p className="mt-16 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-[0.5em] opacity-50 relative z-10">
                Your role will be saved to your account.
            </p>
        </div>
    );
}
