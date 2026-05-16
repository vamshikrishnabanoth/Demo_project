import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const EmptyState = ({ 
    icon: Icon = AlertCircle, 
    title = "Void Detected", 
    message = "No data found in this sector of the arena.",
    action = null 
}) => {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-16 text-center glass-panel rounded-[3rem] border-dashed border-2 border-white/5 bg-white/[0.01]"
        >
            <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center text-white/20 mb-8 border border-white/5">
                <Icon size={48} strokeWidth={1} />
            </div>
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4">{title}</h3>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs max-w-xs leading-loose italic">
                {message}
            </p>
            
            {action && (
                <div className="mt-10">
                    {action}
                </div>
            )}
        </motion.div>
    );
};

export default EmptyState;
