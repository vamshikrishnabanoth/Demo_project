import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ShieldCheck, Download, Copy, Sparkles, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

export default function PerkQRCodeModal({ isOpen, onClose, perk, user }) {
    const [qrDataUrl, setQrDataUrl] = useState('');
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !perk) return;

        const qrPayload = JSON.stringify({
            token: perk.uniqueId || `PRK-${Date.now()}`,
            perkId: perk.id,
            perkName: perk.name,
            studentName: user?.name || user?.username || 'Student',
            studentUsername: user?.username || '',
            studentBranch: user?.studentBranch || 'N/A',
            section: user?.section || 'N/A',
            year: user?.year || 'N/A',
            redeemedAt: perk.redeemedAt || new Date().toISOString(),
            status: 'VALID_ACADEMIC_PASS',
            issuer: 'KAHOOT_ACADEMIC_SYSTEM'
        });

        QRCode.toDataURL(qrPayload, {
            width: 260,
            margin: 2,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        })
            .then(url => setQrDataUrl(url))
            .catch(err => {
                console.error('Error generating QR code:', err);
            });
    }, [isOpen, perk, user]);

    if (!isOpen || !perk) return null;

    const handleCopyToken = () => {
        if (perk.uniqueId) {
            navigator.clipboard.writeText(perk.uniqueId);
            toast.success('Pass Token copied to clipboard!');
        }
    };

    const handleDownloadPass = () => {
        if (!qrDataUrl) return;
        const link = document.createElement('a');
        link.download = `${(perk.name || 'Academic_Perk').replace(/\s+/g, '_')}_Pass.png`;
        link.href = qrDataUrl;
        link.click();
        toast.success('QR Code Pass downloaded!');
    };

    const formattedDate = perk.redeemedAt 
        ? new Date(perk.redeemedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : new Date().toLocaleDateString();

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 15 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="bg-white border-2 border-amber-400/40 rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center overflow-hidden"
                >
                    {/* Top Glow & Close Button */}
                    <div className="absolute -top-20 -left-20 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -top-20 -right-20 w-48 h-48 bg-violet-400/20 rounded-full blur-3xl pointer-events-none" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-3">
                        <CheckCircle size={12} />
                        <span>Verified Academic Pass</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-slate-900 leading-tight">
                        {perk.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                        Present this QR Code to faculty or admin to claim
                    </p>

                    {/* QR Code Container */}
                    <div className="my-5 p-4 bg-slate-50 border-2 border-dashed border-amber-400/60 rounded-3xl flex flex-col items-center justify-center shadow-inner">
                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt="Perk QR Code"
                                className="w-52 h-52 object-contain rounded-2xl shadow-sm bg-white p-2 border border-slate-200"
                            />
                        ) : (
                            <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs font-bold">
                                Generating QR Code...
                            </div>
                        )}

                        {/* Token & Student Details */}
                        <div className="mt-3 w-full space-y-1">
                            <div 
                                onClick={handleCopyToken}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100/70 hover:bg-amber-100 text-amber-900 font-mono font-black text-xs rounded-xl cursor-pointer transition-colors border border-amber-300"
                                title="Click to copy token"
                            >
                                <span>{perk.uniqueId || 'PRK-AUTHENTICATED'}</span>
                                <Copy size={12} />
                            </div>
                            <p className="text-[11px] font-black text-slate-700">
                                Student: <span className="font-bold text-slate-900">{user?.name || user?.username}</span>
                                {user?.studentBranch ? ` (${user.studentBranch}${user.section ? `-${user.section}` : ''})` : ''}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">
                                Redeemed: {formattedDate}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            type="button"
                            onClick={handleDownloadPass}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer border border-slate-300"
                        >
                            <Download size={15} />
                            <span>Save Pass</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all cursor-pointer"
                        >
                            <ShieldCheck size={15} />
                            <span>Done</span>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
