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
            className="flex flex-col items-center justify-center p-16 text-center ws-card rounded-[2rem] border-dashed border-2 border-[var(--border-color)] bg-[var(--bg-primary)]"
        >
            <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-[1.5rem] flex items-center justify-center text-[var(--text-secondary)] mb-8 border border-[var(--border-color)]">
                <Icon size={48} strokeWidth={1} />
            </div>
            <h3 className="text-3xl font-black text-[var(--text-primary)] italic uppercase tracking-tighter mb-4">{title}</h3>
            <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs max-w-xs leading-loose italic">
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
